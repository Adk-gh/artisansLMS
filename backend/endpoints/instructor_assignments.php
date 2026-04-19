<?php
// CRITICAL: Shield JSON from HTML errors
error_reporting(0);
ini_set('display_errors', 0);

// Set JSON Header
header('Content-Type: application/json');

// 1. Include dependencies
require_once __DIR__ . '/../../server/config/db.php';
require_once __DIR__ . '/../../server/controllers/InstructorAssignmentController.php';

// (Optional) Retained the require for json_response middleware if other scripts rely on it
require_once __DIR__ . '/../middleware/json_response.php'; 

// 2. Initialize Session and Authenticate
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// 3. Security Check
if (!isset($_SESSION['user_id']) || !in_array(strtolower(trim($_SESSION['role'] ?? '')), ['teacher', 'admin'])) {
    if (function_exists('json_response')) {
        json_response(['status' => 'error', 'message' => 'Unauthorized'], 401);
    } else {
        http_response_code(401);
        echo json_encode(['status' => 'error', 'message' => 'Unauthorized']);
        exit;
    }
}

// 4. Extract User Info & Get DB Connection
$userId = (int)$_SESSION['user_id'];
$role = $_SESSION['role'] ?? 'teacher';
$conn = getConnection();

// 5. Instantiate the Controller
$controller = new InstructorAssignmentController($conn, $userId, $role);

// 6. Route the Request
$action = $_REQUEST['action'] ?? '';
$response = [];

switch ($action) {
    case 'get_all':
        $response = $controller->getAll();
        break;

    case 'create_task':
        $response = $controller->createTask($_POST, $_FILES);
        break;

    case 'reassign_task':
        $response = $controller->reassignTask($_POST);
        break;

    case 'delete_task':
        $response = $controller->deleteTask($_POST);
        break;

    default:
        $response = ['status' => 'error', 'message' => 'Invalid action or missing parameters.'];
        break;
}

// 7. Clean output buffer and return JSON
ob_clean();
if (function_exists('json_response')) {
    json_response($response);
} else {
    echo json_encode($response);
    exit;
}