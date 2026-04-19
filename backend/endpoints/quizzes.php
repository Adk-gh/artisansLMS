<?php
error_reporting(0);
ini_set('display_errors', 0);

require_once __DIR__ . '/../../server/config/db.php';
require_once __DIR__ . '/../middleware/json_response.php';

if (session_status() === PHP_SESSION_NONE) session_start();

if (!isset($_SESSION['user_id'])) {
    json_response(['status' => 'error', 'message' => 'Not authenticated'], 401);
}

$current_user_id   = (int)$_SESSION['user_id'];
$current_user_role = $_SESSION['role'];
$is_teacher        = ($current_user_role === 'teacher' || $current_user_role === 'admin');
$class_id          = isset($_GET['class_id']) ? (int)$_GET['class_id'] : 0;

$conn = getConnection();

// Get Class Info
$stmt = $conn->prepare("SELECT c.course_id, co.course_code, co.name FROM classes c JOIN courses co ON c.course_id = co.course_id WHERE c.class_id = ?");
$stmt->bind_param('i', $class_id);
$stmt->execute();
$class_info = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$class_info) {
    json_response(['status' => 'error', 'message' => 'Class not found']);
}

// Get Quizzes
$quizzes_res = $conn->query("SELECT * FROM quizzes WHERE class_id = '$class_id' ORDER BY due_date DESC");
$quizzes = [];

while ($qz = $quizzes_res->fetch_assoc()) {
    $qz_id     = $qz['quiz_id'];
    $q_count   = (int)$conn->query("SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = '$qz_id'")->fetch_row()[0];
    $total_pts = (int)$conn->query("SELECT SUM(points) FROM quiz_questions WHERE quiz_id = '$qz_id'")->fetch_row()[0] ?? 0;
    
    $due_ts  = strtotime($qz['due_date']);
    $is_past = $due_ts < strtotime('today');

    $status     = '';
    $sub_count  = 0;
    $my_attempt = null;

    if ($is_teacher) {
        $sub_count    = (int)$conn->query("SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = '$qz_id' AND status='submitted'")->fetch_row()[0];
        $graded_count = (int)$conn->query("SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = '$qz_id' AND status='submitted' AND score IS NOT NULL")->fetch_row()[0];
        
        if (!$is_past) $status = 'active';
        elseif ($sub_count > 0 && $graded_count >= $sub_count) $status = 'graded';
        elseif ($sub_count > 0) $status = 'pending';
        else $status = 'overdue';
    } else {
        $my_attempt = $conn->query("SELECT score, total_points FROM quiz_attempts WHERE quiz_id = '$qz_id' AND student_id = '$current_user_id' AND status='submitted' LIMIT 1")->fetch_assoc();
        
        if ($my_attempt) $status = 'done';
        elseif ($is_past) $status = 'overdue';
        else $status = 'upcoming';
    }

    // Attach computed data to the quiz array
    $qz['q_count']    = $q_count;
    $qz['total_pts']  = $total_pts;
    $qz['due_ts']     = $due_ts * 1000; // Multiply by 1000 for JS Date compatibility
    $qz['is_past']    = $is_past;
    $qz['status']     = $status;
    $qz['sub_count']  = $sub_count;
    $qz['my_attempt'] = $my_attempt;
    
    $quizzes[] = $qz;
}

json_response([
    'status'     => 'success',
    'is_teacher' => $is_teacher,
    'class_info' => $class_info,
    'quizzes'    => $quizzes
]);