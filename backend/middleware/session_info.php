<?php
/**
 * session_info.php
 * Returns the current PHP session user info as JSON.
 * Used by sidebar.html to determine which nav sections to show.
 */
error_reporting(0);
ini_set('display_errors', 0);
header('Content-Type: application/json');

if (session_status() === PHP_SESSION_NONE) session_start();

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Not authenticated']);
    exit;
}

echo json_encode([
    'status'   => 'success',
    'user_id'  => $_SESSION['user_id'],
    'role'     => $_SESSION['role']     ?? 'student',
    'name'     => $_SESSION['name']     ?? '',
    'email'    => $_SESSION['email']    ?? '',
]);