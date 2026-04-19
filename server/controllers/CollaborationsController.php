<?php

class CollaborationsController
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
    }

    /**
     * STATE 1: GET SPECIFIC CLASS DETAILS (Chat Room Initialization)
     */
    public function getClassDetails($classId)
    {
        $classId = (int)$classId;

        // Verify access for students
        if (!$this->isTeacher) {
            $check = $this->db->query("SELECT 1 FROM enrollments WHERE class_id = $classId AND student_id = {$this->userId}");
            if (!$check || $check->num_rows === 0) {
                return ['status' => 'error', 'message' => 'Access denied to this class.'];
            }
        }

        $response = [
            'status' => 'success',
            'class_info' => null,
            'teacher' => null,
            'members' => [],
            'task_count' => 0,
            'quiz_count' => 0
        ];

        // Get class info
        $classInfoRes = $this->db->query("SELECT c.course_id, co.course_code, co.name, c.semester, c.year, c.instructor_id FROM classes c JOIN courses co ON c.course_id = co.course_id WHERE c.class_id = $classId");
        $classInfo = $classInfoRes ? $classInfoRes->fetch_assoc() : null;
        $response['class_info'] = $classInfo;

        if ($classInfo) {
            // Teacher info
            $teacherRes = $this->db->query("SELECT first_name, last_name, email FROM employees WHERE employee_id = {$classInfo['instructor_id']}");
            $response['teacher'] = $teacherRes ? $teacherRes->fetch_assoc() : null;
            
            // Members list
            $membersRes = $this->db->query("SELECT s.student_id, s.first_name, s.last_name FROM students s JOIN enrollments en ON s.student_id = en.student_id WHERE en.class_id = $classId ORDER BY s.last_name ASC");
            if ($membersRes) {
                while ($m = $membersRes->fetch_assoc()) {
                    $response['members'][] = $m;
                }
            }
            
            // Task & Quiz counts
            $taskCountRes = $this->db->query("SELECT COUNT(*) FROM assignments WHERE class_id = $classId");
            $response['task_count'] = $taskCountRes ? (int)$taskCountRes->fetch_row()[0] : 0;

            $quizCountRes = $this->db->query("SELECT COUNT(*) FROM quizzes WHERE class_id = $classId");
            $response['quiz_count'] = $quizCountRes ? (int)$quizCountRes->fetch_row()[0] : 0;
        }

        return $response;
    }

    /**
     * STATE 2: GET ALL CLASSES (Selection Grid)
     */
    public function getClasses()
    {
        $classes = [];
        
        if ($this->isTeacher) {
            $query = "SELECT c.class_id, co.course_code, co.name, c.semester, c.year, e.first_name, e.last_name 
                      FROM classes c JOIN courses co ON c.course_id = co.course_id 
                      JOIN employees e ON c.instructor_id = e.employee_id 
                      WHERE c.instructor_id = {$this->userId}";
        } else {
            $query = "SELECT c.class_id, co.course_code, co.name, c.semester, c.year, e.first_name, e.last_name 
                      FROM classes c JOIN courses co ON c.course_id = co.course_id 
                      JOIN enrollments en ON c.class_id = en.class_id 
                      JOIN employees e ON c.instructor_id = e.employee_id 
                      WHERE en.student_id = {$this->userId}";
        }
        
        $result = $this->db->query($query);
        if ($result) {
            while ($row = $result->fetch_assoc()) {
                $classes[] = $row;
            }
        }
        
        return ['status' => 'success', 'classes' => $classes];
    }
}