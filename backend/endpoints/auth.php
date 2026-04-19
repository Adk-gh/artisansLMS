<?php
// CRITICAL: Shield JSON from HTML errors
error_reporting(0);
ini_set('display_errors', 0);

// Force the browser to read the output as JSON
header('Content-Type: application/json');

// Ensure session is started before any controller logic
if (session_status() === PHP_SESSION_NONE) session_start();

require_once __DIR__ . '/../../server/controllers/AuthController.php';

// FIX: We removed the missing middleware file and built the function directly in here!
if (!function_exists('json_response')) {
    function json_response($data, $status = 200) {
        http_response_code($status);
        echo json_encode($data);
        exit;
    }
}

$method = $_SERVER['REQUEST_METHOD'];
$body   = [];

if ($method === 'POST') {
    $raw  = file_get_contents('php://input');
    $body = json_decode($raw, true) ?? [];
}

// Support both checkSession (from app.js) and other actions
$action = $_GET['action'] ?? $body['action'] ?? '';

$controller = new AuthController();

switch ($action) {
    case 'check':
    case 'checkSession': // Added to match app.js
        $controller->checkSession();
        break;
    case 'login':
        $controller->login($body);
        break;
    case 'register':
        $controller->register($body);
        break;
    case 'logout':
        $controller->logout();
        break;
    default:
        json_response(['status' => 'error', 'message' => 'Invalid action: ' . $action]);
}