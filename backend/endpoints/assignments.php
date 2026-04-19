<?php
// CRITICAL: Shield JSON from HTML errors
error_reporting(0);
ini_set('display_errors', 0);
header('Content-Type: application/json');

// 1. Include dependencies
require_once __DIR__ . '/../../server/config/db.php';
require_once __DIR__ . '/../../server/controllers/AssignmentController.php';

// 2. Initialize Session and Authenticate
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['status' => 'error', 'message' => 'Not authenticated']);
    exit;
}

// 3. Extract User Info & Get DB Connection
$userId = (int)$_SESSION['user_id'];
$role = $_SESSION['role'] ?? 'student';
$conn = getConnection();

// 4. Instantiate the Controller
$controller = new AssignmentController($conn, $userId, $role);

// 5. Route the Request
$action = $_REQUEST['action'] ?? '';
$response = [];

switch ($action) {
    case 'get_tasks':
        $classId = $_GET['class_id'] ?? 0;
        $response = $controller->getTasks($classId);
        break;

    case 'create_task':
        // Pass both POST data and FILES array to the controller
        $response = $controller->createTask($_POST, $_FILES);
        break;

    case 'submit_assignment':
        $response = $controller->submitAssignment($_POST, $_FILES);
        break;

    case 'grade_submission':
        $response = $controller->gradeSubmission($_POST);
        break;

    case 'delete_task':
        $response = $controller->deleteTask($_POST);
        break;

    default:
        $response = ['status' => 'error', 'message' => 'Invalid action or missing parameters.'];
        break;
}

// 6. Clean output buffer and return JSON
ob_clean();
echo json_encode($response);
exit;