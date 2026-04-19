<?php
error_reporting(0);
ini_set('display_errors', 0);

require_once __DIR__ . '/../../server/config/db.php';
require_once __DIR__ . '/../middleware/json_response.php';

if (session_status() === PHP_SESSION_NONE) session_start();

if (!isset($_SESSION['user_id']) || ($_SESSION['role'] !== 'admin' && $_SESSION['role'] !== 'teacher')) {
    json_response(['status' => 'error', 'message' => 'Unauthorized access'], 401);
}

$conn = getConnection();
$action = $_GET['action'] ?? '';

if ($action === 'get_dashboard_data') {
    $data = [];

    // ── Summary Stats ──
    $data['summary'] = [
        'avg_grade'           => round($conn->query("SELECT AVG(CAST(grade AS DECIMAL(10,2))) FROM submissions WHERE grade REGEXP '^[0-9]+$'")->fetch_row()[0] ?? 0, 1),
        'total_expected'      => (int)$conn->query("SELECT COUNT(*) FROM enrollments e JOIN assignments a ON e.class_id = a.class_id")->fetch_row()[0],
        'total_submitted'     => (int)$conn->query("SELECT COUNT(*) FROM submissions")->fetch_row()[0],
        'total_quiz_attempts' => (int)$conn->query("SELECT COUNT(*) FROM quiz_attempts WHERE status='submitted'")->fetch_row()[0],
        'total_quiz_passed'   => (int)$conn->query("SELECT COUNT(*) FROM quiz_attempts WHERE status='submitted' AND total_points > 0 AND (score/total_points) >= 0.75")->fetch_row()[0],
        'total_students'      => (int)$conn->query("SELECT COUNT(DISTINCT student_id) FROM enrollments")->fetch_row()[0],
        'total_classes'       => (int)$conn->query("SELECT COUNT(*) FROM classes")->fetch_row()[0],
        'total_tasks'         => (int)$conn->query("SELECT COUNT(*) FROM assignments")->fetch_row()[0],
        'total_quizzes'       => (int)$conn->query("SELECT COUNT(*) FROM quizzes")->fetch_row()[0],
    ];

    $data['summary']['submission_rate'] = $data['summary']['total_expected'] > 0
        ? round(($data['summary']['total_submitted'] / $data['summary']['total_expected']) * 100, 1) : 0;
    $data['summary']['quiz_pass_rate'] = $data['summary']['total_quiz_attempts'] > 0
        ? round(($data['summary']['total_quiz_passed'] / $data['summary']['total_quiz_attempts']) * 100, 1) : 0;

    // ── Course Stats ──
    $course_stats_arr = [];
    $course_stats = $conn->query("
        SELECT co.course_id, co.course_code, co.name,
            COUNT(DISTINCT s.submission_id)  AS sub_count,
            AVG(CASE WHEN s.grade REGEXP '^[0-9]+$' THEN CAST(s.grade AS DECIMAL(10,2)) ELSE NULL END) AS avg_g,
            COUNT(DISTINCT qa.attempt_id)    AS quiz_attempts,
            SUM(CASE WHEN qa.status='submitted' AND qa.total_points > 0 AND (qa.score/qa.total_points) >= 0.75 THEN 1 ELSE 0 END) AS quiz_passed
        FROM classes c
        JOIN courses co        ON c.course_id     = co.course_id
        LEFT JOIN assignments a  ON c.class_id      = a.class_id
        LEFT JOIN submissions s  ON a.assignment_id = s.assignment_id
        LEFT JOIN quizzes q      ON c.class_id      = q.class_id
        LEFT JOIN quiz_attempts qa ON q.quiz_id     = qa.quiz_id
        GROUP BY co.course_id
        ORDER BY co.course_code ASC
    ");
    if ($course_stats) {
        while ($row = $course_stats->fetch_assoc()) {
            $row['avg_g']     = round($row['avg_g'] ?? 0, 1);
            $row['quiz_rate'] = $row['quiz_attempts'] > 0
                ? round(($row['quiz_passed'] / $row['quiz_attempts']) * 100) : null;
            $course_stats_arr[] = $row;
        }
    }
    $data['courses'] = $course_stats_arr;

    // ── Faculty Workload ──
    $loads_arr = [];
    $loads = $conn->query("
        SELECT e.first_name, e.last_name, COUNT(c.class_id) AS class_count
        FROM employees e
        JOIN classes c ON e.employee_id = c.instructor_id
        GROUP BY e.employee_id
        ORDER BY class_count DESC
        LIMIT 5
    ");
    if ($loads) while ($l = $loads->fetch_assoc()) $loads_arr[] = $l;
    $data['faculty_load'] = $loads_arr;

    // ── Top Students ──
    $top_students_arr = [];
    $top_students = $conn->query("
        SELECT s.first_name, s.last_name,
            AVG(CAST(sub.grade AS DECIMAL(10,2))) AS avg_grade,
            COUNT(sub.submission_id) AS sub_count
        FROM students s
        JOIN submissions sub ON s.student_id = sub.student_id
        WHERE sub.grade REGEXP '^[0-9]+$'
        GROUP BY s.student_id
        HAVING sub_count >= 1
        ORDER BY avg_grade DESC
        LIMIT 5
    ");
    if ($top_students) {
        while ($st = $top_students->fetch_assoc()) {
            $st['avg_grade'] = round($st['avg_grade'], 1);
            $top_students_arr[] = $st;
        }
    }
    $data['top_students'] = $top_students_arr;

// ── Instructor Performance ──
$instructor_perf_arr = [];
$inst_perf = $conn->query("
    SELECT
        e.employee_id,
        e.first_name,
        e.last_name,
        d.name                          AS dept_name,
        COALESCE(cl.class_count, 0)     AS class_count,
        COALESCE(cl.task_count, 0)      AS task_count,
        COALESCE(cl.quiz_count, 0)      AS quiz_count,
        COALESCE(sub.total_submitted, 0) AS total_submitted,
        COALESCE(enr.total_enrolled, 0)  AS total_enrolled,
        COALESCE(sub.avg_grade, 0)       AS avg_grade,
        COALESCE(qa.quiz_attempts, 0)    AS quiz_attempts,
        COALESCE(qa.quiz_passed, 0)      AS quiz_passed
    FROM employees e
    LEFT JOIN departments d ON e.department_id = d.department_id

    -- Class, task, quiz counts
    LEFT JOIN (
        SELECT
            c.instructor_id,
            COUNT(DISTINCT c.class_id)        AS class_count,
            COUNT(DISTINCT a.assignment_id)   AS task_count,
            COUNT(DISTINCT q.quiz_id)         AS quiz_count
        FROM classes c
        LEFT JOIN assignments a ON a.class_id = c.class_id
        LEFT JOIN quizzes q     ON q.class_id = c.class_id
        GROUP BY c.instructor_id
    ) cl ON cl.instructor_id = e.employee_id

    -- Submission stats (count + avg grade)
    LEFT JOIN (
        SELECT
            c.instructor_id,
            COUNT(DISTINCT s.submission_id) AS total_submitted,
            AVG(CASE WHEN s.grade REGEXP '^[0-9]+\$'
                THEN CAST(s.grade AS DECIMAL(10,2))
                ELSE NULL END)              AS avg_grade
        FROM classes c
        JOIN assignments a  ON a.class_id      = c.class_id
        JOIN submissions s  ON s.assignment_id = a.assignment_id
        GROUP BY c.instructor_id
    ) sub ON sub.instructor_id = e.employee_id

    -- Approved enrollments (for expected submission count)
    LEFT JOIN (
        SELECT c.instructor_id, COUNT(DISTINCT en.enrollment_id) AS total_enrolled
        FROM classes c
        JOIN enrollments en ON en.class_id = c.class_id AND en.status = 'Approved'
        GROUP BY c.instructor_id
    ) enr ON enr.instructor_id = e.employee_id

    -- Quiz attempt stats
    LEFT JOIN (
        SELECT
            c.instructor_id,
            COUNT(DISTINCT qa.attempt_id) AS quiz_attempts,
            SUM(CASE WHEN qa.status = 'submitted'
                AND qa.total_points > 0
                AND (qa.score / qa.total_points) >= 0.75
                THEN 1 ELSE 0 END)        AS quiz_passed
        FROM classes c
        JOIN quizzes q        ON q.class_id  = c.class_id
        JOIN quiz_attempts qa ON qa.quiz_id  = q.quiz_id
        WHERE qa.status = 'submitted'
        GROUP BY c.instructor_id
    ) qa ON qa.instructor_id = e.employee_id

    WHERE e.is_faculty = 1
    ORDER BY avg_grade DESC, class_count DESC
");

if ($inst_perf) {
    while ($row = $inst_perf->fetch_assoc()) {
        $row['avg_grade']    = round($row['avg_grade'], 1);
        // Expected = enrolled students × tasks posted
        $expected            = (int)$row['total_enrolled'] * (int)$row['task_count'];
        $row['expected_submissions'] = $expected;
        $row['submission_rate'] = $expected > 0
            ? round(((int)$row['total_submitted'] / $expected) * 100, 1) : 0;
        $row['quiz_pass_rate'] = (int)$row['quiz_attempts'] > 0
            ? round(((int)$row['quiz_passed'] / (int)$row['quiz_attempts']) * 100, 1) : null;
        $instructor_perf_arr[] = $row;
    }
}
$data['instructor_performance'] = $instructor_perf_arr;

    json_response(["status" => "success", "data" => $data]);
} else {
    json_response(["status" => "error", "message" => "Invalid action."], 400);
}