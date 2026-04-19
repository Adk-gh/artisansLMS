<?php
require_once __DIR__ . '/../../server/controllers/AnalyticsController.php';

$action = $_GET['action'] ?? '';
$controller = new AnalyticsController();

switch ($action) {
    case 'dashboard':
        $controller->dashboard();
        break;
    default:
        json_response(['status' => 'error', 'message' => 'Invalid action']);
}