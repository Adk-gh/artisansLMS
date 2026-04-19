<?php
function calculateQuizStats($db, $quizId) {
    $qCount = (int)$db->query("SELECT COUNT(*) FROM quiz_questions WHERE quiz_id=$quizId")->fetch_row()[0];
    $totalPts = (int)$db->query("SELECT SUM(points) FROM quiz_questions WHERE quiz_id=$quizId")->fetch_row()[0] ?? 0;
    return ['q_count'=>$qCount, 'total_pts'=>$totalPts];
}
