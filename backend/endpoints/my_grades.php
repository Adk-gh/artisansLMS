<?php
error_reporting(0);
ini_set('display_errors', 0);

require_once __DIR__ . '/../../server/config/db.php';
require_once __DIR__ . '/../middleware/json_response.php';

if (session_status() === PHP_SESSION_NONE) session_start();

// Auth check
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'student') {
    json_response(['status' => 'error', 'message' => 'Unauthorized'], 401);
}

$student_id = (int)$_SESSION['user_id'];
$conn = getConnection();

// Helper: Convert letter grades to numbers for averages
function letterToNumber($grade) {
    if (empty($grade)) return null;
    $grade = strtoupper(trim($grade));
    $map = [
        'A+' => 100, 'A' => 95, 'A-' => 90, 'B+' => 85, 'B' => 80, 
        'B-' => 75, 'C+' => 70, 'C' => 65, 'C-' => 60, 'D' => 55, 'F' => 50, 'INC' => 0
    ];
    return is_numeric($grade) ? (float)$grade : ($map[$grade] ?? 0);
}

// 1. Fetch Enrolled Classes
$enrolled = $conn->query("
    SELECT c.class_id, co.course_code, co.name AS course_name, e.first_name, e.last_name
    FROM enrollments en
    JOIN classes c ON en.class_id = c.class_id
    JOIN courses co ON c.course_id = co.course_id
    JOIN employees e ON c.instructor_id = e.employee_id
    WHERE en.student_id = $student_id
");

$classes_payload = [];
$overall_scores = [];

while ($class = $enrolled->fetch_assoc()) {
    $cid = $class['class_id'];

    // 2. Fetch Assignments for this class
    $a_stmt = $conn->prepare("
        SELECT a.title, a.due_date, s.grade, s.feedback, s.submit_date
        FROM assignments a
        LEFT JOIN submissions s ON a.assignment_id = s.assignment_id AND s.student_id = ?
        WHERE a.class_id = ?
    ");
    $a_stmt->bind_param('ii', $student_id, $cid);
    $a_stmt->execute();
    $a_res = $a_stmt->get_result();
    
    $assignments = [];
    $a_sum = 0; $a_count = 0;
    while ($a = $a_res->fetch_assoc()) {
        $num = letterToNumber($a['grade']);
        if ($num !== null) { $a_sum += $num; $a_count++; }
        $assignments[] = $a;
    }
    $a_avg = $a_count > 0 ? round($a_sum / $a_count, 1) : null;

    // 3. Fetch Quizzes for this class
    $q_stmt = $conn->prepare("
        SELECT q.title, q.due_date, qa.score, qa.total_points, qa.submitted_at, qa.status
        FROM quizzes q
        LEFT JOIN quiz_attempts qa ON q.quiz_id = qa.quiz_id AND qa.student_id = ? AND qa.status = 'submitted'
        WHERE q.class_id = ?
    ");
    $q_stmt->bind_param('ii', $student_id, $cid);
    $q_stmt->execute();
    $q_res = $q_stmt->get_result();

    $quizzes = [];
    $q_sum = 0; $q_count = 0;
    while ($q = $q_res->fetch_assoc()) {
        $pct = ($q['score'] !== null && $q['total_points'] > 0) ? round(($q['score'] / $q['total_points']) * 100, 1) : null;
        if ($pct !== null) { $q_sum += $pct; $q_count++; }
        $q['pct'] = $pct;
        $quizzes[] = $q;
    }
    $q_avg = $q_count > 0 ? round($q_sum / $q_count, 1) : null;

    // 4. Calculate Combined Grade (60% Tasks, 40% Quizzes)
    if ($a_avg !== null && $q_avg !== null) $combined = round(($a_avg * 0.6) + ($q_avg * 0.4), 1);
    else $combined = $a_avg ?? $q_avg;

    if ($combined !== null) $overall_scores[] = $combined;

    $classes_payload[] = [
        'info' => $class,
        'assignments' => $assignments,
        'quizzes' => $quizzes,
        'averages' => ['tasks' => $a_avg, 'quizzes' => $q_avg, 'combined' => $combined]
    ];
}

json_response([
    'status' => 'success',
    'summary' => [
        'overall_avg' => count($overall_scores) > 0 ? round(array_sum($overall_scores) / count($overall_scores), 1) : 0,
        'total_classes' => count($classes_payload)
    ],
    'classes' => $classes_payload
]);