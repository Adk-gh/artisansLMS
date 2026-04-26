<?php
error_reporting(0);
ini_set('display_errors', 0);
header('Content-Type: application/json');

require_once __DIR__ . '/../../server/config/db.php';
require_once __DIR__ . '/../middleware/json_response.php';

if (session_status() === PHP_SESSION_NONE) session_start();

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['status' => 'error', 'message' => 'Unauthorized']);
    exit;
}

$conn       = getConnection();
$teacher_id = (int)$_SESSION['user_id'];

// ── 1. Teacher info ──────────────────────────────────────────────────────────
$teacher = [];
$stmt = $conn->prepare("
    SELECT e.first_name, e.last_name, e.email, e.gender,
           p.title AS position, d.name AS department
    FROM employees e
    LEFT JOIN positions   p ON p.position_id   = e.position_id
    LEFT JOIN departments d ON d.department_id = e.department_id
    WHERE e.employee_id = ?
    LIMIT 1
");
if ($stmt) {
    $stmt->bind_param('i', $teacher_id);
    $stmt->execute();
    $teacher = $stmt->get_result()->fetch_assoc() ?? [];
    $stmt->close();
}

// ── 2. Teacher's classes ─────────────────────────────────────────────────────
$classes = [];
$stmt = $conn->prepare("
    SELECT c.class_id, c.semester, c.year, c.max_enrollment,
           co.course_code, co.name AS course_name,
           (SELECT COUNT(*) FROM enrollments WHERE class_id = c.class_id) AS student_count,
           (SELECT COUNT(*) FROM assignments WHERE class_id = c.class_id) AS task_count,
           (SELECT COUNT(*) FROM quizzes     WHERE class_id = c.class_id) AS quiz_count
    FROM classes c
    JOIN courses co ON co.course_id = c.course_id
    WHERE c.instructor_id = ?
    ORDER BY c.year DESC, c.semester DESC
");
if ($stmt) {
    $stmt->bind_param('i', $teacher_id);
    $stmt->execute();
    $res = $stmt->get_result();
    while ($row = $res->fetch_assoc()) $classes[] = $row;
    $stmt->close();
}

// ── 3. Pending submissions ───────────────────────────────────────────────────
$pending_submissions = [];
$stmt = $conn->prepare("
    SELECT s.submission_id, s.submit_date, s.grade,
           a.title AS task_title, a.class_id,
           co.course_code,
           st.first_name, st.last_name
    FROM submissions s
    JOIN assignments a  ON a.assignment_id = s.assignment_id
    JOIN classes     cl ON cl.class_id     = a.class_id
    JOIN courses     co ON co.course_id    = cl.course_id
    JOIN students    st ON st.student_id   = s.student_id
    WHERE cl.instructor_id = ?
      AND (s.grade IS NULL OR s.grade = '')
    ORDER BY s.submit_date DESC
    LIMIT 10
");
if ($stmt) {
    $stmt->bind_param('i', $teacher_id);
    $stmt->execute();
    $res = $stmt->get_result();
    while ($row = $res->fetch_assoc()) $pending_submissions[] = $row;
    $stmt->close();
}

// ── 4. Upcoming due dates (no 'type' column — safe version) ──────────────────
$upcoming = [];
$stmt = $conn->prepare("
    SELECT a.assignment_id, a.title, a.due_date, a.class_id,
           co.course_code,
           (SELECT COUNT(*) FROM submissions WHERE assignment_id = a.assignment_id) AS sub_count,
           (SELECT COUNT(*) FROM enrollments WHERE class_id = a.class_id)           AS enroll_count
    FROM assignments a
    JOIN classes cl ON cl.class_id  = a.class_id
    JOIN courses co ON co.course_id = cl.course_id
    WHERE cl.instructor_id = ?
      AND a.due_date >= CURDATE()
      AND a.due_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
    ORDER BY a.due_date ASC
    LIMIT 8
");
if ($stmt) {
    $stmt->bind_param('i', $teacher_id);
    $stmt->execute();
    $res = $stmt->get_result();
    while ($row = $res->fetch_assoc()) $upcoming[] = $row;
    $stmt->close();
}

// ── 5. Recent quiz results ────────────────────────────────────────────────────
$quiz_results = [];
$stmt = $conn->prepare("
    SELECT q.quiz_id, q.title, q.due_date, q.class_id,
           co.course_code,
           COUNT(qa.attempt_id)                                  AS attempt_count,
           ROUND(AVG(qa.score), 1)                               AS avg_score,
           MAX(qa.total_points)                                   AS total_points,
           SUM(CASE WHEN qa.percentage >= 75 THEN 1 ELSE 0 END)  AS pass_count
    FROM quizzes q
    JOIN classes     cl ON cl.class_id  = q.class_id
    JOIN courses     co ON co.course_id = cl.course_id
    LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.quiz_id
                               AND qa.status = 'submitted'
    WHERE cl.instructor_id = ?
      AND q.due_date < NOW()
    GROUP BY q.quiz_id, q.title, q.due_date, q.class_id, co.course_code
    ORDER BY q.due_date DESC
    LIMIT 5
");
if ($stmt) {
    $stmt->bind_param('i', $teacher_id);
    $stmt->execute();
    $res = $stmt->get_result();
    while ($row = $res->fetch_assoc()) $quiz_results[] = $row;
    $stmt->close();
}

// ── 6. Recent student activity ───────────────────────────────────────────────
$activity = [];
$stmt = $conn->prepare("
    SELECT s.submit_date, s.grade,
           a.title AS task_title,
           co.course_code,
           st.first_name, st.last_name
    FROM submissions s
    JOIN assignments a  ON a.assignment_id = s.assignment_id
    JOIN classes     cl ON cl.class_id     = a.class_id
    JOIN courses     co ON co.course_id    = cl.course_id
    JOIN students    st ON st.student_id   = s.student_id
    WHERE cl.instructor_id = ?
    ORDER BY s.submit_date DESC
    LIMIT 8
");
if ($stmt) {
    $stmt->bind_param('i', $teacher_id);
    $stmt->execute();
    $res = $stmt->get_result();
    while ($row = $res->fetch_assoc()) $activity[] = $row;
    $stmt->close();
}

// ── 7. Summary stats ─────────────────────────────────────────────────────────
$total_students = 0;
$stmt = $conn->prepare("
    SELECT COUNT(DISTINCT e.student_id) 
    FROM enrollments e 
    JOIN classes c ON c.class_id = e.class_id 
    WHERE c.instructor_id = ?
");
if ($stmt) {
    $stmt->bind_param('i', $teacher_id);
    $stmt->execute();
    $total_students = (int)$stmt->get_result()->fetch_row()[0];
    $stmt->close();
}

$total_quizzes = 0;
$stmt = $conn->prepare("
    SELECT COUNT(*) 
    FROM quizzes q 
    JOIN classes c ON c.class_id = q.class_id 
    WHERE c.instructor_id = ?
");
if ($stmt) {
    $stmt->bind_param('i', $teacher_id);
    $stmt->execute();
    $total_quizzes = (int)$stmt->get_result()->fetch_row()[0];
    $stmt->close();
}

ob_clean();
echo json_encode([
    'status'              => 'success',
    'teacher'             => $teacher,
    'classes'             => $classes,
    'pending_submissions' => $pending_submissions,
    'upcoming'            => $upcoming,
    'quiz_results'        => $quiz_results,
    'activity'            => $activity,
    'stats'               => [
        'total_classes'  => count($classes),
        'total_students' => $total_students,
        'total_pending'  => count($pending_submissions),
        'total_quizzes'  => $total_quizzes,
    ]
]);
exit;