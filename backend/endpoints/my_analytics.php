<?php
// Prevent any PHP warnings from corrupting the JSON output
error_reporting(0);
ini_set('display_errors', 0);

require_once __DIR__ . '/../../server/config/db.php';
require_once __DIR__ . '/../middleware/cors.php';
require_once __DIR__ . '/../middleware/json_response.php';

// session_start is usually inside auth_check or db config. 
// If not, ensure it's called once.
if (session_status() === PHP_SESSION_NONE) session_start();

// Check if logged in
if (!isset($_SESSION['user_id'])) {
    json_response(['status' => 'error', 'message' => 'Not authenticated'], 401);
}

$student_id = (int)$_SESSION['user_id'];
$conn = getConnection(); // Use your connection helper

// ── Helper ──────────────────────────────────────────────────────────────────
function letterToNumber($grade) {
    if ($grade === null || $grade === '') return 0;
    $grade = strtoupper(trim($grade));
    $map = [
        'A+' => 100, 'A' => 95, 'A-' => 90,
        'B+' => 85,  'B' => 80, 'B-' => 75,
        'C+' => 70,  'C' => 65, 'C-' => 60,
        'D'  => 55,  'F' => 50, 'INC' => 0,
    ];
    return is_numeric($grade) ? (float)$grade : ($map[$grade] ?? 0);
}

// ── A. Assignments ───────────────────────────────────────────────────────────
$stmt = $conn->prepare("
    SELECT COUNT(a.assignment_id) AS total
    FROM assignments a
    JOIN enrollments e ON a.class_id = e.class_id
    WHERE e.student_id = ?
");
$stmt->bind_param('i', $student_id);
$stmt->execute();
$total_assignments = (int)($stmt->get_result()->fetch_assoc()['total'] ?? 0);
$stmt->close();

$stmt = $conn->prepare("SELECT grade FROM submissions WHERE student_id = ?");
$stmt->bind_param('i', $student_id);
$stmt->execute();
$subs_res = $stmt->get_result();

$total_submissions = (int)$subs_res->num_rows;
$assign_exp        = 0;
$assign_grade_sum  = 0;
$graded_subs       = 0;

while ($sub = $subs_res->fetch_assoc()) {
    $val        = letterToNumber($sub['grade']);
    $assign_exp += (50 + $val);
    if ($sub['grade'] !== null && $sub['grade'] !== '') {
        $assign_grade_sum += $val;
        $graded_subs++;
    }
}
$stmt->close();
$average_grade = $graded_subs > 0 ? round($assign_grade_sum / $graded_subs, 1) : 0;

// ── B. Quizzes ───────────────────────────────────────────────────────────────
$stmt = $conn->prepare("
    SELECT COUNT(q.quiz_id) AS total
    FROM quizzes q
    JOIN enrollments e ON q.class_id = e.class_id
    WHERE e.student_id = ?
");
$stmt->bind_param('i', $student_id);
$stmt->execute();
$total_quizzes_posted = (int)($stmt->get_result()->fetch_assoc()['total'] ?? 0);
$stmt->close();

$stmt = $conn->prepare("
    SELECT score, total_points
    FROM quiz_attempts
    WHERE student_id = ? AND status = 'submitted'
");
$stmt->bind_param('i', $student_id);
$stmt->execute();
$quiz_res = $stmt->get_result();

$total_quiz_attempts = (int)$quiz_res->num_rows;
$quiz_exp            = 0;
$quiz_pct_sum        = 0;
$quiz_pass_count     = 0;

while ($qa = $quiz_res->fetch_assoc()) {
    $pct           = $qa['total_points'] > 0 ? ($qa['score'] / $qa['total_points']) * 100 : 0;
    $quiz_exp     += (75 + $pct);
    $quiz_pct_sum += $pct;
    if ($pct >= 75) $quiz_pass_count++;
}
$stmt->close();
$average_quiz_pct = $total_quiz_attempts > 0 ? round($quiz_pct_sum  / $total_quiz_attempts, 1) : 0;
$quiz_pass_rate   = $total_quiz_attempts > 0 ? round(($quiz_pass_count / $total_quiz_attempts) * 100) : 0;

// ── C. Perfect score check ───────────────────────────────────────────────────
$stmt = $conn->prepare("
    SELECT COUNT(*) AS cnt
    FROM quiz_attempts
    WHERE student_id = ? AND status = 'submitted'
      AND score = total_points AND total_points > 0
");
$stmt->bind_param('i', $student_id);
$stmt->execute();
$perfect_score_count = (int)($stmt->get_result()->fetch_assoc()['cnt'] ?? 0);
$stmt->close();

// ── D. Computed values ───────────────────────────────────────────────────────
$total_exp       = $assign_exp + $quiz_exp;
$exp_per_level   = 500;
$level           = floor($total_exp / $exp_per_level) + 1;
$cur_level_exp   = $total_exp % $exp_per_level;
$exp_percent     = ($cur_level_exp / $exp_per_level) * 100;
$completion_rate = $total_assignments   > 0 ? round(($total_submissions   / $total_assignments)   * 100) : 0;
$quiz_completion = $total_quizzes_posted > 0 ? round(($total_quiz_attempts / $total_quizzes_posted) * 100) : 0;

// ── E. Badges ────────────────────────────────────────────────────────────────
$badges = [
    ['id' => 'first_blood', 'earned' => $total_submissions >= 1, 'icon' => 'fa-tint', 'color' => '#ef4444', 'title' => 'First Blood', 'desc' => 'Submitted your first assignment.', 'cat' => 'Tasks'],
    ['id' => 'quiz_taker', 'earned' => $total_quiz_attempts >= 1, 'icon' => 'fa-brain', 'color' => '#7c3aed', 'title' => 'Quiz Taker', 'desc' => 'Completed your first quiz.', 'cat' => 'Quizzes'],
    ['id' => 'scholar', 'earned' => $average_grade >= 90, 'icon' => 'fa-book-reader', 'color' => '#8b5cf6', 'title' => 'Scholar', 'desc' => 'Maintain an average task grade of 90+.', 'cat' => 'Tasks'],
    ['id' => 'quiz_ace', 'earned' => $average_quiz_pct >= 90 && $total_quiz_attempts >= 3, 'icon' => 'fa-trophy', 'color' => '#f59e0b', 'title' => 'Quiz Ace', 'desc' => 'Average quiz score of 90%+ across 3+ quizzes.', 'cat' => 'Quizzes'],
    ['id' => 'perfect_score', 'earned' => $perfect_score_count >= 1, 'icon' => 'fa-crown', 'color' => '#d97706', 'title' => 'Perfect Score', 'desc' => 'Got a 100% on any quiz.', 'cat' => 'Quizzes']
];

// ── F. Response ──────────────────────────────────────────────────────────────
json_response([
    'status' => 'success',
    'student' => [
        'id'   => $student_id,
        'name' => $_SESSION['user_name'] ?? 'Student',
    ],
    'exp' => [
        'total'         => $total_exp,
        'from_tasks'    => $assign_exp,
        'from_quizzes'  => $quiz_exp,
        'level'         => $level,
        'cur_level_exp' => (int)$cur_level_exp,
        'exp_per_level' => $exp_per_level,
        'exp_percent'   => round($exp_percent, 2),
        'exp_to_next'   => $exp_per_level - $cur_level_exp,
    ],
    'tasks' => [
        'total'            => $total_assignments,
        'submitted'        => $total_submissions,
        'completion_rate'  => $completion_rate,
        'average_grade'    => $average_grade,
    ],
    'quizzes' => [
        'total_posted'     => $total_quizzes_posted,
        'attempts'         => $total_quiz_attempts,
        'completion_rate'  => $quiz_completion,
        'average_pct'      => $average_quiz_pct,
        'pass_count'       => $quiz_pass_count,
        'pass_rate'        => $quiz_pass_rate,
    ],
    'badges' => $badges,
]);