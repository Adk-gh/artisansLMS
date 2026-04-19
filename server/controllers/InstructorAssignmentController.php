<?php

class InstructorAssignmentController
{
    private $db;
    private $userId;
    private $role;
    private $isTeacher;

    public function __construct($db, $userId, $role)
    {
        $this->db = $db;
        $this->userId = (int)$userId;
        $this->role = strtolower(trim($role));
        $this->isTeacher = in_array($this->role, ['teacher', 'admin']);

        // Ensure category column
        $this->db->query("ALTER TABLE assignments ADD COLUMN IF NOT EXISTS category ENUM('assignment','activity') NOT NULL DEFAULT 'assignment'");
    }

    /**
     * 1. GET ALL TASKS & CLASSES
     */
    public function getAll()
    {
        if (!$this->isTeacher) {
            return ['status' => 'error', 'message' => 'Unauthorized access.'];
        }

        $classes = [];
        $assignmentsData = [];
        $quizzesData = [];

        // Classes
        $cr = $this->db->query("SELECT cl.class_id, co.course_code, co.name, cl.semester, cl.year FROM classes cl JOIN courses co ON cl.course_id = co.course_id WHERE cl.instructor_id = {$this->userId} ORDER BY co.course_code");
        if ($cr) {
            while ($r = $cr->fetch_assoc()) $classes[] = $r;
        }

        // Assignments
        $assigns = $this->db->query("
            SELECT a.*, co.course_code, co.name AS cname, cl.semester, cl.year, cl.class_id AS cid,
                (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.assignment_id) AS sub_count
            FROM assignments a
            JOIN classes cl ON a.class_id = cl.class_id
            JOIN courses co ON cl.course_id = co.course_id
            WHERE cl.instructor_id = {$this->userId}
            ORDER BY a.due_date DESC");
        if ($assigns) {
            while ($r = $assigns->fetch_assoc()) $assignmentsData[] = $r;
        }

        // Quizzes
        $quizzesRes = $this->db->query("
            SELECT q.*, co.course_code, co.name AS cname, cl.semester, cl.year, cl.class_id AS cid,
                (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.quiz_id) AS q_count,
                (SELECT COUNT(*) FROM quiz_attempts qa WHERE qa.quiz_id = q.quiz_id AND qa.status='submitted') AS attempt_count
            FROM quizzes q
            JOIN classes cl ON q.class_id = cl.class_id
            JOIN courses co ON cl.course_id = co.course_id
            WHERE cl.instructor_id = {$this->userId}
            ORDER BY q.due_date DESC");
        if ($quizzesRes) {
            while ($r = $quizzesRes->fetch_assoc()) $quizzesData[] = $r;
        }

        return [
            'status' => 'success', 
            'classes' => $classes, 
            'assignments' => $assignmentsData, 
            'quizzes' => $quizzesData
        ];
    }

    /**
     * 2. CREATE TASK
     */
    public function createTask($postData, $fileData)
    {
        if (!$this->isTeacher) return ['status' => 'error', 'message' => 'Unauthorized access.'];

        $type      = $postData['task_type'] ?? 'assignment';
        $title     = $this->db->real_escape_string(trim($postData['title'] ?? ''));
        $desc      = $this->db->real_escape_string(trim($postData['description'] ?? ''));
        $due       = $this->db->real_escape_string($postData['due_date'] ?? '');
        $classIds  = isset($postData['class_ids']) ? array_map('intval', explode(',', $postData['class_ids'])) : [];

        if (!$title || !$due || empty($classIds)) {
            return ['status' => 'error', 'message' => 'Missing fields.'];
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
                
                if (isset($fileData['ref_file']) && $fileData['ref_file']['error'] === UPLOAD_ERR_OK) {
                    $dir = '../../uploads/assignments/';
                    if (!is_dir($dir)) mkdir($dir, 0777, true);
                    $sf = preg_replace("/[^a-zA-Z0-9.-]/", "_", basename($fileData['ref_file']['name']));
                    move_uploaded_file($fileData['ref_file']['tmp_name'], $dir."task_{$aid}_{$sf}");
                }
            }
        }
        
        return ['status' => 'success', 'message' => 'Task created successfully.'];
    }

    /**
     * 3. REASSIGN TASK
     */
    public function reassignTask($postData)
    {
        if (!$this->isTeacher) return ['status' => 'error', 'message' => 'Unauthorized access.'];

        $taskType    = $postData['reassign_type'] ?? '';
        $taskId      = (int)($postData['reassign_id'] ?? 0);
        $newClassIds = isset($postData['new_class_ids']) ? array_map('intval', explode(',', $postData['new_class_ids'])) : [];

        if (!$taskId || empty($newClassIds)) {
            return ['status' => 'error', 'message' => 'Invalid data.'];
        }

        if ($taskType === 'quiz') {
            $oq = $this->db->query("SELECT * FROM quizzes WHERE quiz_id=$taskId")->fetch_assoc();
            $oqs = $this->db->query("SELECT * FROM quiz_questions WHERE quiz_id=$taskId");
            
            foreach ($newClassIds as $cid) {
                $escTitle = $this->db->real_escape_string($oq['title']);
                if ($this->db->query("SELECT quiz_id FROM quizzes WHERE class_id=$cid AND title='$escTitle'")->num_rows) continue;
                
                $t = $this->db->real_escape_string($oq['title']); 
                $d = $this->db->real_escape_string($oq['description']); 
                $du = $this->db->real_escape_string($oq['due_date']);
                
                $this->db->query("INSERT INTO quizzes (class_id,title,description,due_date,time_limit,randomize) VALUES ($cid,'$t','$d','$du',".(int)$oq['time_limit'].",".(int)$oq['randomize'].")");
                $newQid = $this->db->insert_id;
                
                $oqs->data_seek(0);
                while ($q = $oqs->fetch_assoc()) {
                    $this->db->query("INSERT INTO quiz_questions (quiz_id,question_text,question_type,correct_answer,points) VALUES ($newQid,'".$this->db->real_escape_string($q['question_text'])."','".$this->db->real_escape_string($q['question_type'])."','".$this->db->real_escape_string($q['correct_answer'])."',".(int)$q['points'].")");
                    $newQqid = $this->db->insert_id;
                    
                    $choices = $this->db->query("SELECT * FROM quiz_choices WHERE question_id=".(int)$q['question_id']);
                    while ($ch = $choices->fetch_assoc()) {
                        $this->db->query("INSERT INTO quiz_choices (question_id,choice_key,choice_text) VALUES ($newQqid,'".$this->db->real_escape_string($ch['choice_key'])."','".$this->db->real_escape_string($ch['choice_text'])."')");
                    }
                }
            }
        } else {
            $oa = $this->db->query("SELECT * FROM assignments WHERE assignment_id=$taskId")->fetch_assoc();
            
            foreach ($newClassIds as $cid) {
                $escTitle = $this->db->real_escape_string($oa['title']);
                if ($this->db->query("SELECT assignment_id FROM assignments WHERE class_id=$cid AND title='$escTitle'")->num_rows) continue;
                
                $this->db->query("INSERT INTO assignments (class_id,title,description,due_date,category) VALUES ($cid,'".$this->db->real_escape_string($oa['title'])."','".$this->db->real_escape_string($oa['description'])."','".$this->db->real_escape_string($oa['due_date'])."','".$this->db->real_escape_string($oa['category'])."')");
                $newAid = $this->db->insert_id;
                
                $files = glob('../../uploads/assignments/'."task_{$taskId}_*");
                if ($files) { 
                    foreach ($files as $src) { 
                        @copy($src, '../../uploads/assignments/'.preg_replace("/^task_{$taskId}_/", "task_{$newAid}_", basename($src))); 
                    } 
                }
            }
        }
        
        return ['status' => 'success', 'message' => 'Reassigned successfully.'];
    }

    /**
     * 4. DELETE TASK
     */
    public function deleteTask($postData)
    {
        if (!$this->isTeacher) return ['status' => 'error', 'message' => 'Unauthorized access.'];

        $id = (int)($postData['task_id'] ?? 0);
        $type = $postData['task_type'] ?? '';

        if (!$id) return ['status' => 'error', 'message' => 'Task ID missing'];

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