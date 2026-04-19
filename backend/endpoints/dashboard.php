<?php
// CRITICAL: Turn off HTML error output so JSON doesn't get corrupted
error_reporting(0);
ini_set('display_errors', 0);

// CRITICAL: Force the browser to read the output as JSON
header('Content-Type: application/json');

// 1. Include dependencies
require_once __DIR__ . '/../../server/config/db.php';
require_once __DIR__ . '/../../server/controllers/DashboardController.php';

// 2. Initialize Session and Authenticate
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['status' => 'error', 'message' => 'Unauthorized']);
    exit;
}

// 3. Extract User Info & Get DB Connection
$userId = (int)$_SESSION['user_id'];
$role = $_SESSION['role'] ?? 'student';
$conn = getConnection();

// 4. Instantiate the Controller
$controller = new DashboardController($conn, $userId, $role);

// 5. Route the Request 
// (We default to 'get_stats' here so your existing JS fetch doesn't need to change!)
$action = $_GET['action'] ?? 'get_stats';
$response = [];

switch ($action) {
    case 'get_stats':
        $response = $controller->getStats();
        break;

    default:
        $response = ['status' => 'error', 'message' => 'Invalid action'];
        break;
}

// 6. Clean output buffer and return JSON safely
ob_clean();
echo json_encode($response);
exit;