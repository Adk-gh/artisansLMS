<?php
// export_student_performance.php
// ─────────────────────────────────────────────────────────────────────────────
// READ-ONLY public API — exposes student performance data to external systems.
//
// Base URL  : /artisansLMS/backend/api/export_student_performance.php
//
// Endpoints :
//   GET ?action=get_overview          — system-wide summary stats
//   GET ?action=get_students          — all students with avg grade + submission stats
//   GET ?action=get_students&student_id=5  — single student detail
//   GET ?action=get_courses           — performance broken down by course
//   GET ?action=get_instructors       — instructor performance summary
//
// Auth : X-API-Key header  OR  ?api_key= query param
// ─────────────────────────────────────────────────────────────────────────────

error_reporting(0);
ini_set('display_errors', 0);

require_once __DIR__ . '/../../server/config/db.php';
require_once __DIR__ . '/../middleware/json_response.php';

define('PERF_API_KEY', getenv('PERF_API_KEY') ?: 'local_perf_key');

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: X-API-Key, Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_response(['status' => 'error', 'message' => 'Method not allowed. Use GET.'], 405);
}

$provided_key = trim(
    $_SERVER['HTTP_X_API_KEY']
    ?? $_SERVER['HTTP_X_Api_Key']
    ?? $_GET['api_key']
    ?? ''
);

if ($provided_key !== trim(PERF_API_KEY)) {
    json_response(['status' => 'error', 'message' => 'Unauthorized. Invalid or missing API key.'], 401);
}

$conn   = getConnection();
$action = trim($_GET['action'] ?? '');

// ── 1. System-wide Overview ───────────────────────────────────────────────────
if ($action === 'get_overview') {

    $avg_grade = round(
        $conn->query("SELECT AVG(CAST(grade AS DECIMAL(10,2))) FROM submissions WHERE grade REGEXP '^[0-9]+$'")->fetch_row()[0] ?? 0, 1
    );
    $total_expected  = (int)$conn->query("SELECT COUNT(*) FROM enrollments e JOIN assignments a ON e.class_id = a.class_id")->fetch_row()[0];
    $total_submitted = (int)$conn->query("SELECT COUNT(*) FROM submissions")->fetch_row()[0];
    $quiz_attempts   = (int)$conn->query("SELECT COUNT(*) FROM quiz_attempts WHERE status='submitted'")->fetch_row()[0];
    $quiz_passed     = (int)$conn->query("SELECT COUNT(*) FROM quiz_attempts WHERE status='submitted' AND total_points > 0 AND (score/total_points) >= 0.75")->fetch_row()[0];
    $total_students  = (int)$conn->query("SELECT COUNT(DISTINCT student_id) FROM enrollments")->fetch_row()[0];
    $total_classes   = (int)$conn->query("SELECT COUNT(*) FROM classes")->fetch_row()[0];
    $total_tasks     = (int)$conn->query("SELECT COUNT(*) FROM assignments")->fetch_row()[0];
    $total_quizzes   = (int)$conn->query("SELECT COUNT(*) FROM quizzes")->fetch_row()[0];

    json_response([
        'status' => 'success',
        'data'   => [
            'avg_grade'        => $avg_grade,
            'submission_rate'  => $total_expected > 0 ? round(($total_submitted / $total_expected) * 100, 1) : 0,
            'quiz_pass_rate'   => $quiz_attempts   > 0 ? round(($quiz_passed    / $quiz_attempts)  * 100, 1) : 0,
            'total_students'   => $total_students,
            'total_classes'    => $total_classes,
            'total_tasks'      => $total_tasks,
            'total_quizzes'    => $total_quizzes,
            'total_submitted'  => $total_submitted,
            'total_expected'   => $total_expected,
            'quiz_attempts'    => $quiz_attempts,
            'quiz_passed'      => $quiz_passed,
        ]
    ]);
}

// ── 2. All Students Performance ───────────────────────────────────────────────
elseif ($action === 'get_students') {

    $student_id = isset($_GET['student_id']) ? (int)$_GET['student_id'] : 0;
    $where      = $student_id > 0 ? "WHERE s.student_id = $student_id" : '';

    $res = $conn->query("
        SELECT
            s.student_id,
            s.first_name,
            s.last_name,
            CONCAT(s.first_name, ' ', s.last_name)   AS full_name,
            s.email,

            -- Enrollment info
            COUNT(DISTINCT e.class_id)                AS enrolled_classes,

            -- Submission stats
            COUNT(DISTINCT sub.submission_id)         AS total_submitted,
            COUNT(DISTINCT a.assignment_id)           AS total_assigned,
            ROUND(AVG(
                CASE WHEN sub.grade REGEXP '^[0-9]+\$'
                THEN CAST(sub.grade AS DECIMAL(10,2))
                ELSE NULL END
            ), 1)                                     AS avg_grade,

            -- Quiz stats
            COUNT(DISTINCT qa.attempt_id)             AS quiz_attempts,
            SUM(CASE
                WHEN qa.status = 'submitted'
                AND qa.total_points > 0
                AND (qa.score / qa.total_points) >= 0.75
                THEN 1 ELSE 0 END)                    AS quiz_passed,
            ROUND(AVG(
                CASE WHEN qa.status = 'submitted' AND qa.total_points > 0
                THEN (qa.score / qa.total_points) * 100
                ELSE NULL END
            ), 1)                                     AS avg_quiz_score

        FROM students s
        LEFT JOIN enrollments   e   ON e.student_id    = s.student_id
        LEFT JOIN assignments   a   ON a.class_id      = e.class_id
        LEFT JOIN submissions   sub ON sub.assignment_id = a.assignment_id
                                   AND sub.student_id   = s.student_id
        LEFT JOIN quizzes       q   ON q.class_id      = e.class_id
        LEFT JOIN quiz_attempts qa  ON qa.quiz_id      = q.quiz_id
                                   AND qa.student_id   = s.student_id
        $where
        GROUP BY s.student_id
        ORDER BY avg_grade DESC, total_submitted DESC
    ");

    if (!$res) {
        json_response(['status' => 'error', 'message' => $conn->error], 500);
    }

    $students = [];
    while ($row = $res->fetch_assoc()) {
        $row['student_id']       = (int)$row['student_id'];
        $row['enrolled_classes'] = (int)$row['enrolled_classes'];
        $row['total_submitted']  = (int)$row['total_submitted'];
        $row['total_assigned']   = (int)$row['total_assigned'];
        $row['quiz_attempts']    = (int)$row['quiz_attempts'];
        $row['quiz_passed']      = (int)$row['quiz_passed'];
        $row['avg_grade']        = $row['avg_grade']      !== null ? (float)$row['avg_grade']      : null;
        $row['avg_quiz_score']   = $row['avg_quiz_score'] !== null ? (float)$row['avg_quiz_score'] : null;

        // Submission rate
        $row['submission_rate']  = $row['total_assigned'] > 0
            ? round(($row['total_submitted'] / $row['total_assigned']) * 100, 1) : 0;

        // Quiz pass rate
        $row['quiz_pass_rate']   = $row['quiz_attempts'] > 0
            ? round(($row['quiz_passed'] / $row['quiz_attempts']) * 100, 1) : null;

        // Performance label
        $avg = $row['avg_grade'];
        $row['performance_label'] = $avg === null ? 'No grades yet'
            : ($avg >= 85 ? 'Excellent' : ($avg >= 75 ? 'Good' : ($avg >= 60 ? 'Needs Improvement' : 'At Risk')));

        $students[] = $row;
    }

    if ($student_id > 0 && count($students) === 0) {
        json_response(['status' => 'error', 'message' => 'Student not found.'], 404);
    }

    json_response(['status' => 'success', 'count' => count($students), 'data' => $students]);
}

// ── 3. Performance by Course ──────────────────────────────────────────────────
elseif ($action === 'get_courses') {

    $res = $conn->query("
        SELECT
            co.course_id,
            co.course_code,
            co.name                                   AS course_name,
            d.name                                    AS department_name,

            COUNT(DISTINCT sub.submission_id)         AS total_submissions,
            ROUND(AVG(
                CASE WHEN sub.grade REGEXP '^[0-9]+\$'
                THEN CAST(sub.grade AS DECIMAL(10,2))
                ELSE NULL END
            ), 1)                                     AS avg_grade,

            COUNT(DISTINCT qa.attempt_id)             AS quiz_attempts,
            SUM(CASE
                WHEN qa.status = 'submitted'
                AND qa.total_points > 0
                AND (qa.score / qa.total_points) >= 0.75
                THEN 1 ELSE 0 END)                    AS quiz_passed

        FROM classes c
        JOIN   courses      co ON co.course_id    = c.course_id
        LEFT JOIN departments d  ON d.department_id  = co.department_id
        LEFT JOIN assignments a  ON a.class_id       = c.class_id
        LEFT JOIN submissions sub ON sub.assignment_id = a.assignment_id
        LEFT JOIN quizzes    q   ON q.class_id       = c.class_id
        LEFT JOIN quiz_attempts qa ON qa.quiz_id     = q.quiz_id
        GROUP BY co.course_id
        ORDER BY co.course_code ASC
    ");

    $courses = [];
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $row['course_id']         = (int)$row['course_id'];
            $row['total_submissions'] = (int)$row['total_submissions'];
            $row['quiz_attempts']     = (int)$row['quiz_attempts'];
            $row['quiz_passed']       = (int)$row['quiz_passed'];
            $row['avg_grade']         = $row['avg_grade'] !== null ? (float)$row['avg_grade'] : null;
            $row['quiz_pass_rate']    = $row['quiz_attempts'] > 0
                ? round(($row['quiz_passed'] / $row['quiz_attempts']) * 100, 1) : null;
            $courses[] = $row;
        }
    }

    json_response(['status' => 'success', 'count' => count($courses), 'data' => $courses]);
}

// ── 4. Instructor Performance ─────────────────────────────────────────────────
elseif ($action === 'get_instructors') {

    $res = $conn->query("
        SELECT
            e.employee_id                             AS instructor_id,
            e.first_name,
            e.last_name,
            CONCAT(e.first_name, ' ', e.last_name)   AS full_name,
            d.name                                    AS department_name,

            COUNT(DISTINCT c.class_id)                AS class_count,
            COUNT(DISTINCT a.assignment_id)           AS task_count,
            COUNT(DISTINCT q.quiz_id)                 AS quiz_count,
            COUNT(DISTINCT sub.submission_id)         AS total_submitted,
            COUNT(DISTINCT en.enrollment_id)          AS total_enrolled,

            ROUND(AVG(
                CASE WHEN sub.grade REGEXP '^[0-9]+\$'
                THEN CAST(sub.grade AS DECIMAL(10,2))
                ELSE NULL END
            ), 1)                                     AS avg_grade,

            COUNT(DISTINCT qa.attempt_id)             AS quiz_attempts,
            SUM(CASE
                WHEN qa.status = 'submitted'
                AND qa.total_points > 0
                AND (qa.score / qa.total_points) >= 0.75
                THEN 1 ELSE 0 END)                    AS quiz_passed

        FROM employees e
        LEFT JOIN departments  d   ON d.department_id  = e.department_id
        LEFT JOIN classes      c   ON c.instructor_id  = e.employee_id
        LEFT JOIN assignments  a   ON a.class_id       = c.class_id
        LEFT JOIN submissions  sub ON sub.assignment_id = a.assignment_id
        LEFT JOIN enrollments  en  ON en.class_id      = c.class_id AND en.status = 'Approved'
        LEFT JOIN quizzes      q   ON q.class_id       = c.class_id
        LEFT JOIN quiz_attempts qa ON qa.quiz_id       = q.quiz_id AND qa.status = 'submitted'
        WHERE e.is_faculty = 1
        GROUP BY e.employee_id
        ORDER BY avg_grade DESC, class_count DESC
    ");

    $instructors = [];
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $row['instructor_id']   = (int)$row['instructor_id'];
            $row['class_count']     = (int)$row['class_count'];
            $row['task_count']      = (int)$row['task_count'];
            $row['quiz_count']      = (int)$row['quiz_count'];
            $row['total_submitted'] = (int)$row['total_submitted'];
            $row['total_enrolled']  = (int)$row['total_enrolled'];
            $row['quiz_attempts']   = (int)$row['quiz_attempts'];
            $row['quiz_passed']     = (int)$row['quiz_passed'];
            $row['avg_grade']       = $row['avg_grade'] !== null ? (float)$row['avg_grade'] : null;

            $expected               = $row['total_enrolled'] * $row['task_count'];
            $row['submission_rate'] = $expected > 0
                ? round(($row['total_submitted'] / $expected) * 100, 1) : 0;
            $row['quiz_pass_rate']  = $row['quiz_attempts'] > 0
                ? round(($row['quiz_passed'] / $row['quiz_attempts']) * 100, 1) : null;

            $instructors[] = $row;
        }
    }

    json_response(['status' => 'success', 'count' => count($instructors), 'data' => $instructors]);
}

else {
    json_response([
        'status'  => 'error',
        'message' => 'Invalid action. Supported: get_overview, get_students, get_courses, get_instructors.',
    ], 400);
}