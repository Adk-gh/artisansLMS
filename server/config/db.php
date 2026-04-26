<?php
function getConnection(): mysqli {
    // 1. If we are on local XAMPP, load the .env file. 
    // On Render, this file won't exist, so it safely skips this block!
    $envPath = __DIR__ . '/../../.env'; 
    if (file_exists($envPath)) {
        $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            if (strpos(trim($line), '#') === 0) continue;
            $parts = explode('=', $line, 2);
            if (count($parts) === 2) {
                putenv(trim($parts[0]) . '=' . trim($parts[1]));
            }
        }
    }

    // 2. Grab the variables (works for both XAMPP's .env AND Render's settings!)
    $host = getenv('DB_HOST');
    $user = getenv('DB_USER'); 
    $pass = getenv('DB_PASS');
    $db   = getenv('DB_NAME'); 
    $port = getenv('DB_PORT') ?: 3306; 

    mysqli_report(MYSQLI_REPORT_OFF);

    // 3. Connect to the database
    $conn = new mysqli($host, $user, $pass, $db, (int)$port);

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