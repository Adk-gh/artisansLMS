<?php
// CRITICAL: Shield JSON from HTML errors
error_reporting(0);
ini_set('display_errors', 0);

// CRITICAL: Force the browser to read the output as JSON
header('Content-Type: application/json');

// 1. Include dependencies
require_once __DIR__ . '/../../server/config/db.php';
require_once __DIR__ . '/../../server/controllers/CollaborationsController.php';

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
$controller = new CollaborationsController($conn, $userId, $role);

// 5. Route the Request
$action = $_GET['action'] ?? '';
$response = [];

switch ($action) {
    case 'get_class_details':
        $classId = $_GET['class_id'] ?? 0;
        $response = $controller->getClassDetails($classId);
        break;

    case 'get_classes':
        $response = $controller->getClasses();
        break;

    default:
        $response = ['status' => 'error', 'message' => 'Invalid action'];
        break;
}

// 6. Clean output buffer and return JSON safely
ob_clean();
echo json_encode($response);
exit;