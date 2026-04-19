<?php

class AssignmentController
{
    private $db;
    private $userId;
    private $role;
    private $isTeacher;

    /**
     * Constructor initializes the controller with necessary dependencies and permissions.
     */
    public function __construct($db, $userId, $role)
    {
        $this->db = $db;
        $this->userId = (int)$userId;
        $this->role = strtolower(trim($role));
        $this->isTeacher = in_array($this->role, ['teacher', 'admin']);

        // Ensure category column exists (Maintained for exact functional parity)
        $this->db->query("ALTER TABLE assignments ADD COLUMN IF NOT EXISTS category ENUM('assignment','activity') NOT NULL DEFAULT 'assignment'");
    }

    /**
     * 1. GET ALL TASKS & CLASSES
     */
    public function getTasks($classId)
    {
        $classId = (int)$classId;
        if (!$classId) {
            return ['status' => 'error', 'message' => 'Class ID missing'];
        }

        // Get current class info
        $cInfoRes = $this->db->query("SELECT co.course_code, co.name FROM classes c JOIN courses co ON c.course_id = co.course_id WHERE c.class_id = $classId");
        $cInfo = $cInfoRes ? $cInfoRes->fetch_assoc() : null;

        // Get ALL classes for the teacher (used for the Create/Reassign Modals)
        $teacherClasses = [];
        if ($this->isTeacher) {
            $cr = $this->db->query("SELECT cl.class_id, co.course_code, co.name, cl.semester, cl.year FROM classes cl JOIN courses co ON cl.course_id = co.course_id WHERE cl.instructor_id = {$this->userId} ORDER BY co.course_code");
            if ($cr) {
                while ($r = $cr->fetch_assoc()) {
                    $teacherClasses[] = $r;
                }
            }
        }

        $tasks = [];

        // Get Assignments
        $assignsRes = $this->db->query("SELECT * FROM assignments WHERE class_id = $classId ORDER BY due_date DESC");
        if ($assignsRes) {
            while ($a = $assignsRes->fetch_assoc()) {
                $aid = $a['assignment_id'];
                $a['type'] = 'assignment';
                $a['files'] = glob("../../uploads/assignments/task_{$aid}_*.*") ?: [];

                if ($this->isTeacher) {
                    $subsRes = $this->db->query("SELECT s.*, st.first_name, st.last_name FROM submissions s JOIN students st ON s.student_id = st.student_id WHERE s.assignment_id = $aid ORDER BY s.submit_date ASC");
                    $a['submissions'] = [];
                    $a['graded_count'] = 0;
                    if ($subsRes) {
                        while ($sub = $subsRes->fetch_assoc()) {
                            $sf = glob("../../uploads/submissions/sub_{$aid}_{$sub['student_id']}_*.*");
                            $sub['file'] = !empty($sf) ? $sf[0] : null;
                            if (!empty($sub['grade'])) {
                                $a['graded_count']++;
                            }
                            $a['submissions'][] = $sub;
                        }
                    }
                    $a['sub_count'] = count($a['submissions']);
                } else {
                    $mySubRes = $this->db->query("SELECT * FROM submissions WHERE assignment_id = $aid AND student_id = {$this->userId}");
                    $mySub = $mySubRes ? $mySubRes->fetch_assoc() : null;
                    if ($mySub) {
                        $sf = glob("../../uploads/submissions/sub_{$aid}_{$this->userId}_*.*");
                        $mySub['file'] = !empty($sf) ? $sf[0] : null;
                    }
                    $a['my_submission'] = $mySub;
                }
                $tasks[] = $a;
            }
        }

        // Get Quizzes
        $quizRes = $this->db->query("SELECT * FROM quizzes WHERE class_id = $classId ORDER BY due_date DESC");
        if ($quizRes) {
            while ($q = $quizRes->fetch_assoc()) {
                $qid = $q['quiz_id'];
                $q['type'] = 'quiz';
                $q['category'] = 'quiz';
                
                $qCountRes = $this->db->query("SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = $qid");
                $q['q_count'] = $qCountRes ? (int)$qCountRes->fetch_row()[0] : 0;
                
                $totalPtsRes = $this->db->query("SELECT SUM(points) FROM quiz_questions WHERE quiz_id = $qid");
                $q['total_pts'] = $totalPtsRes ? (int)$totalPtsRes->fetch_row()[0] : 0;

                if ($this->isTeacher) {
                    $attemptRes = $this->db->query("SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = $qid AND status = 'submitted'");
                    $q['attempt_count'] = $attemptRes ? (int)$attemptRes->fetch_row()[0] : 0;
                } else {
                    $myAttemptRes = $this->db->query("SELECT * FROM quiz_attempts WHERE quiz_id = $qid AND student_id = {$this->userId} AND status = 'submitted' LIMIT 1");
                    $q['my_attempt'] = $myAttemptRes ? $myAttemptRes->fetch_assoc() : null;
                }
                $tasks[] = $q;
            }
        }

        return [
            'status' => 'success',
            'is_teacher' => $this->isTeacher,
            'class_info' => $cInfo,
            'teacher_classes' => $teacherClasses,
            'tasks' => $tasks
        ];
    }

    /**
     * 2. CREATE TASK (Teacher)
     */
    public function createTask($postData, $fileData)
    {
        if (!$this->isTeacher) {
            return ['status' => 'error', 'message' => 'Unauthorized access.'];
        }

        $type  = $postData['task_type'] ?? 'assignment';
        $title = $this->db->real_escape_string(trim($postData['title'] ?? ''));
        $desc  = $this->db->real_escape_string(trim($postData['description'] ?? ''));
        $due   = $this->db->real_escape_string($postData['due_date'] ?? '');

        // Extract and sanitize class IDs
        $classIds = [];
        if (isset($postData['class_ids'])) {
            if (is_array($postData['class_ids'])) {
                $classIds = array_map('intval', $postData['class_ids']);
            } else {
                $classIds = array_map('intval', explode(',', $postData['class_ids']));
            }
        }

        if (!$title || !$due || empty($classIds)) {
            return ['status' => 'error', 'message' => 'Missing required fields.'];
        }

        if ($type === 'quiz') {
            $tl   = (int)($postData['time_limit'] ?? 0);
            $rand = isset($postData['randomize']) && $postData['randomize'] == '1' ? 1 : 0;
            $qs   = json_decode($postData['questions_json'] ?? '[]', true) ?: [];

            foreach ($classIds as $cid) {
                $this->db->query("INSERT INTO quizzes (class_id,title,description,due_date,time_limit,randomize) VALUES ($cid,'$title','$desc','$due',$tl,$rand)");
                $qid = $this->db->insert_id;
                
                foreach ($qs as $q) {
                    $qt   = $this->db->real_escape_string($q['text'] ?? '');
                    $qtyp = $this->db->real_escape_string($q['type'] ?? 'multiple_choice');
                    $qcor = $this->db->real_escape_string($q['correct'] ?? 'A');
                    $qpts = max(1, (int)($q['points'] ?? 1));
                    
                    $this->db->query("INSERT INTO quiz_questions (quiz_id,question_text,question_type,correct_answer,points) VALUES ($qid,'$qt','$qtyp','$qcor',$qpts)");
                    $qqid = $this->db->insert_id;
                    
                    if ($qtyp === 'multiple_choice' && !empty($q['choices'])) {
                        foreach ($q['choices'] as $k => $v) {
                            $k = $this->db->real_escape_string($k);
                            $v = $this->db->real_escape_string($v);
                            $this->db->query("INSERT INTO quiz_choices (question_id,choice_key,choice_text) VALUES ($qqid,'$k','$v')");
                        }
                    }
                }
            }
        } else {
            $cat = ($type === 'activity') ? 'activity' : 'assignment';
            foreach ($classIds as $cid) {
                $this->db->query("INSERT INTO assignments (class_id,title,description,due_date,category) VALUES ($cid,'$title','$desc','$due','$cat')");
                $aid = $this->db->insert_id;
                
                // Handle optional reference file upload
                if (isset($fileData['ref_file']) && $fileData['ref_file']['error'] === UPLOAD_ERR_OK) {
                    $dir = '../../uploads/assignments/';
                    if (!is_dir($dir)) mkdir($dir, 0777, true);
                    $sf = preg_replace("/[^a-zA-Z0-9.-]/", "_", basename($fileData['ref_file']['name']));
                    move_uploaded_file($fileData['ref_file']['tmp_name'], $dir . "task_{$aid}_{$sf}");
                }
            }
        }

        return ['status' => 'success', 'message' => 'Task created successfully!'];
    }

    /**
     * 3. SUBMIT ASSIGNMENT (Student)
     */
    public function submitAssignment($postData, $fileData)
    {
        if ($this->isTeacher) {
            return ['status' => 'error', 'message' => 'Teachers cannot submit assignments'];
        }

        $aid = (int)($postData['assignment_id'] ?? 0);
        if (!$aid) {
            return ['status' => 'error', 'message' => 'Assignment ID missing'];
        }

        if (isset($fileData['student_file']) && $fileData['student_file']['error'] === UPLOAD_ERR_OK) {
            $dir = '../../uploads/submissions/';
            if (!is_dir($dir)) mkdir($dir, 0777, true);
            $safe = preg_replace("/[^a-zA-Z0-9._-]/", "_", basename($fileData['student_file']['name']));
            move_uploaded_file($fileData['student_file']['tmp_name'], $dir . "sub_{$aid}_{$this->userId}_{$safe}");
        }

        $existsRes = $this->db->query("SELECT submission_id FROM submissions WHERE assignment_id=$aid AND student_id={$this->userId}");
        if (!$existsRes || $existsRes->num_rows === 0) {
            $this->db->query("INSERT INTO submissions (assignment_id, student_id, submit_date) VALUES ($aid, {$this->userId}, NOW())");
        }

        return ['status' => 'success', 'message' => 'Assignment submitted successfully!'];
    }

    /**
     * 4. GRADE SUBMISSION (Teacher)
     */
    public function gradeSubmission($postData)
    {
        if (!$this->isTeacher) {
            return ['status' => 'error', 'message' => 'Unauthorized access.'];
        }

        $sid = (int)($postData['submission_id'] ?? 0);
        $grade = $this->db->real_escape_string($postData['grade'] ?? '');
        $feedback = $this->db->real_escape_string($postData['feedback'] ?? '');

        if (!$sid) {
            return ['status' => 'error', 'message' => 'Submission ID missing'];
        }

        $this->db->query("UPDATE submissions SET grade='$grade', feedback='$feedback' WHERE submission_id=$sid");
        
        return ['status' => 'success', 'message' => 'Grade saved successfully!'];
    }

    /**
     * 5. DELETE TASK (Teacher)
     */
    public function deleteTask($postData)
    {
        if (!$this->isTeacher) {
            return ['status' => 'error', 'message' => 'Unauthorized access.'];
        }

        $id = (int)($postData['task_id'] ?? 0);
        $type = $postData['task_type'] ?? '';

        if (!$id) {
            return ['status' => 'error', 'message' => 'Task ID missing'];
        }

        if ($type === 'quiz') {
            $this->db->query("DELETE FROM quiz_attempts WHERE quiz_id=$id");
            $this->db->query("DELETE FROM quiz_questions WHERE quiz_id=$id");
            $this->db->query("DELETE FROM quizzes WHERE quiz_id=$id");
        } else {
            $this->db->query("DELETE FROM submissions WHERE assignment_id=$id");
            $this->db->query("DELETE FROM assignments WHERE assignment_id=$id");
        }

        return ['status' => 'success', 'message' => 'Task deleted.'];
    }
}