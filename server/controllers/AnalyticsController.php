<?php
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../../backend/middleware/json_response.php';

class AnalyticsController {

    private mysqli $db;

    public function __construct() {
        if (session_status() === PHP_SESSION_NONE) session_start();
        global $db;
        $this->db = $db;
    }

    public function dashboard(): void {
        if (!isset($_SESSION['user_id'])) {
            json_response(['status' => 'error', 'message' => 'Unauthorized'], 401);
            return;
        }

        $data = [
            'user_name'          => $_SESSION['name'] ?? 'User',
            'total_courses'      => $this->count('courses'),
            'total_professors'   => $this->count('employees', 'WHERE is_faculty = 1'),
            'total_depts'        => $this->count('departments'),
            'total_enrolled'     => $this->count('enrollments'),
            'total_students'     => $this->count('students'),
            'total_classes'      => $this->count('classes'),
            'gender_data'        => $this->genderBreakdown(),
            'dept_stats'         => $this->deptStats(),
            'top_courses'        => $this->topCourses(),
            'active_classes'     => $this->activeClasses(),
            'recent_enrollments' => $this->recentEnrollments(),
        ];

        $data['avg_per_class'] = ($data['total_enrolled'] > 0 && $data['total_classes'] > 0)
            ? round($data['total_enrolled'] / $data['total_classes'], 1)
            : '—';

        json_response(['status' => 'success', 'data' => $data]);
    }

    private function count(string $table, string $where = ''): int {
        $result = $this->db->query("SELECT COUNT(*) FROM {$table} {$where}");
        return (int)$result->fetch_row()[0];
    }

    private function genderBreakdown(): array {
        $rows = [];
        $res  = $this->db->query("SELECT gender, COUNT(*) as total FROM students GROUP BY gender");
        while ($r = $res->fetch_assoc()) $rows[] = $r;
        return $rows;
    }

    private function deptStats(): array {
        $rows = [];
        $res  = $this->db->query("
            SELECT d.name, COUNT(en.student_id) as total
            FROM departments d
            LEFT JOIN employees e    ON d.department_id = e.department_id
            LEFT JOIN classes c      ON e.employee_id   = c.instructor_id
            LEFT JOIN enrollments en ON c.class_id      = en.class_id
            GROUP BY d.department_id
            ORDER BY total DESC
            LIMIT 6
        ");
        while ($r = $res->fetch_assoc()) $rows[] = $r;
        return $rows;
    }

    private function topCourses(): array {
        $rows = [];
        $res  = $this->db->query("
            SELECT co.course_code, co.name, COUNT(en.student_id) as total
            FROM courses co
            JOIN classes cl     ON co.course_id = cl.course_id
            JOIN enrollments en ON cl.class_id  = en.class_id
            GROUP BY co.course_id
            ORDER BY total DESC
            LIMIT 6
        ");
        while ($r = $res->fetch_assoc()) $rows[] = $r;
        return $rows;
    }

    private function activeClasses(): array {
        $rows = [];
        $res  = $this->db->query("
            SELECT c.class_id, co.name AS course_name, co.course_code,
                   e.first_name, e.last_name, c.semester, c.year
            FROM classes c
            JOIN courses co   ON c.course_id     = co.course_id
            JOIN employees e  ON c.instructor_id  = e.employee_id
            ORDER BY c.class_id DESC
            LIMIT 6
        ");
        while ($r = $res->fetch_assoc()) $rows[] = $r;
        return $rows;
    }

    private function recentEnrollments(): array {
        $rows = [];
        $res  = $this->db->query("
            SELECT s.first_name, s.last_name, co.course_code, en.enroll_date
            FROM enrollments en
            JOIN students s ON en.student_id = s.student_id
            JOIN classes cl ON en.class_id   = cl.class_id
            JOIN courses co ON cl.course_id  = co.course_id
            ORDER BY en.enroll_date DESC
            LIMIT 8
        ");
        while ($r = $res->fetch_assoc()) $rows[] = $r;
        return $rows;
    }
}