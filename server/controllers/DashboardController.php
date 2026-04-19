<?php

class DashboardController
{
    private $db;
    private $userId;
    private $role;

    public function __construct($db, $userId, $role)
    {
        $this->db = $db;
        $this->userId = (int)$userId;
        $this->role = strtolower(trim($role));
    }

    /**
     * Fetch all statistics for the dashboard overview.
     */
    public function getStats()
    {
        $response = [
            'status' => 'success',
            'stats' => [],
            'gender_data' => [],
            'dept_stats' => [],
            'top_courses' => [],
            'recent_enrollments' => [],
            'active_classes' => []
        ];

        // 1. Quick Stats
        $response['stats']['total_courses']    = (int)$this->db->query("SELECT COUNT(*) FROM courses")->fetch_row()[0];
        $response['stats']['total_professors'] = (int)$this->db->query("SELECT COUNT(*) FROM employees WHERE is_faculty = 1")->fetch_row()[0];
        $response['stats']['total_depts']      = (int)$this->db->query("SELECT COUNT(*) FROM departments")->fetch_row()[0];
        $response['stats']['total_enrolled']   = (int)$this->db->query("SELECT COUNT(*) FROM enrollments")->fetch_row()[0];
        $response['stats']['total_students']   = (int)$this->db->query("SELECT COUNT(*) FROM students")->fetch_row()[0];
        $response['stats']['total_classes']    = (int)$this->db->query("SELECT COUNT(*) FROM classes")->fetch_row()[0];

        // 2. Gender breakdown
        $genderRes = $this->db->query("SELECT gender, COUNT(*) as total FROM students GROUP BY gender");
        if ($genderRes) {
            while ($g = $genderRes->fetch_assoc()) {
                $response['gender_data'][] = $g;
            }
        }

        // 3. Students per dept
        $deptRes = $this->db->query("
            SELECT d.name, COUNT(en.student_id) as total
            FROM departments d
            LEFT JOIN employees e  ON d.department_id = e.department_id
            LEFT JOIN classes c    ON e.employee_id   = c.instructor_id
            LEFT JOIN enrollments en ON c.class_id    = en.class_id
            GROUP BY d.department_id
            ORDER BY total DESC LIMIT 6
        ");
        if ($deptRes) {
            while ($d = $deptRes->fetch_assoc()) {
                $response['dept_stats'][] = $d;
            }
        }

        // 4. Top courses
        $courseRes = $this->db->query("
            SELECT co.course_code, co.name, COUNT(en.student_id) as total
            FROM courses co
            JOIN classes cl     ON co.course_id = cl.course_id
            JOIN enrollments en ON cl.class_id  = en.class_id
            GROUP BY co.course_id
            ORDER BY total DESC LIMIT 6
        ");
        if ($courseRes) {
            while ($c = $courseRes->fetch_assoc()) {
                $response['top_courses'][] = $c;
            }
        }

        // 5. Active classes
        $classesRes = $this->db->query("
            SELECT c.class_id, co.name AS course_name, co.course_code,
                   e.first_name, e.last_name, c.semester, c.year
            FROM classes c
            JOIN courses co   ON c.course_id    = co.course_id
            JOIN employees e  ON c.instructor_id = e.employee_id
            ORDER BY c.class_id DESC LIMIT 6
        ");
        if ($classesRes) {
            while ($cls = $classesRes->fetch_assoc()) {
                $response['active_classes'][] = $cls;
            }
        }

        // 6. Recent enrollments
        $recentRes = $this->db->query("
            SELECT s.first_name, s.last_name, co.course_code, en.enroll_date
            FROM enrollments en
            JOIN students s ON en.student_id = s.student_id
            JOIN classes cl ON en.class_id   = cl.class_id
            JOIN courses co ON cl.course_id  = co.course_id
            ORDER BY en.enroll_date DESC LIMIT 8
        ");
        if ($recentRes) {
            while ($re = $recentRes->fetch_assoc()) {
                $response['recent_enrollments'][] = $re;
            }
        }

        return $response;
    }
}