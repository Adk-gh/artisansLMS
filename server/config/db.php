<?php
function getConnection(): mysqli {
    $host   = 'localhost';
    $user   = 'root';
    $pass   = '';
    $dbname = 'itprofel3';

    mysqli_report(MYSQLI_REPORT_OFF);

    $conn = new mysqli($host, $user, $pass, $dbname);

    if ($conn->connect_error) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode([
            'status'  => 'error',
            'message' => 'Database connection failed: ' . $conn->connect_error
        ]);
        exit;
    }

    $conn->set_charset('utf8mb4');
    return $conn;
}