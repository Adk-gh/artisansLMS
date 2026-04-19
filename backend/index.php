<?php
require_once __DIR__ . '/middleware/cors.php';
require_once __DIR__ . '/middleware/json_response.php';

// Read route from GET or POST body
$route = $_GET['route'] ?? '';

if (!$route) {
    $body  = json_decode(file_get_contents('php://input'), true) ?? [];
    $route = $body['route'] ?? '';
}

match ($route) {
    'auth'        => require __DIR__ . '/endpoints/auth.php',
    'courses'     => require __DIR__ . '/endpoints/courses.php',
    'assignments' => require __DIR__ . '/endpoints/assignments.php',
    'quizzes'     => require __DIR__ . '/endpoints/quizzes.php',
    'grades'      => require __DIR__ . '/endpoints/grades.php',
    'messages'    => require __DIR__ . '/endpoints/messages.php',
    'resources'   => require __DIR__ . '/endpoints/resources.php',
    'enrollments' => require __DIR__ . '/endpoints/enrollments.php',
    'classes'     => require __DIR__ . '/endpoints/classes.php',
    'analytics'   => require __DIR__ . '/endpoints/analytics.php',
    'users'       => require __DIR__ . '/endpoints/users.php',
    'uploads'     => require __DIR__ . '/endpoints/uploads.php',
    default       => json_response(['status' => 'error', 'message' => 'Route not found'], 404)
};