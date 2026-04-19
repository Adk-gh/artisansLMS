<?php
// CRITICAL: Shield JSON from HTML errors
error_reporting(0);
ini_set('display_errors', 0);

// CRITICAL: Force the browser to read the output as JSON
header('Content-Type: application/json');

// 1. Include dependencies
require_once __DIR__ . '/../../server/config/db.php';
require_once __DIR__ . '/../../server/controllers/MessagesController.php';

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
$userName = $_SESSION['user_name'] ?? 'User';

// Using the same function pattern as your working collaboration script
$conn = getConnection(); 

if (!$conn) {
    echo json_encode(['status' => 'error', 'message' => 'Database connection failed']);
    exit;
}

// 4. Instantiate the Controller
$controller = new MessagesController($conn);

// 5. Route the Request
$action = $_GET['action'] ?? 'get_initial_data'; // Default action
$response = [];

switch ($action) {
    case 'get_initial_data':
        $response = [
            'status' => 'success',
            'data' => $controller->getInitialChatData($userId, $role, $userName)
        ];
        break;

    default:
        $response = ['status' => 'error', 'message' => 'Invalid action'];
        break;
}

// 6. Clean output buffer and return JSON safely
if (ob_get_length()) ob_clean();
echo json_encode($response);
exit;