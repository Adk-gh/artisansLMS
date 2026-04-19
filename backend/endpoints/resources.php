<?php
// 1. Tell the browser we are sending JSON, not HTML
header('Content-Type: application/json');

// 2. Check for missing parameters
if (!isset($_GET['action']) || $_GET['action'] !== 'get_modules') {
    echo json_encode(['status' => 'error', 'message' => 'Invalid action']);
    exit;
}

if (!isset($_GET['class_id'])) {
    echo json_encode(['status' => 'error', 'message' => 'Missing class_id']);
    exit;
}

$class_id = intval($_GET['class_id']);

// ====================================================================
// MOCK DATA MODE (Set to false when your database table is ready)
// ====================================================================
$useMockData = true; 

if ($useMockData) {
    // Return fake data so the frontend UI stops spinning and loads!
    echo json_encode([
        'status' => 'success',
        'course_name' => 'Course #' . $class_id,
        'resources' => [
            [
                'file_name' => 'Syllabus_2026.pdf',
                'file_path' => '/artisansLMS/client/pages/uploads/syllabus.pdf',
                'description' => 'Course Overview and Grading'
            ],
            [
                'file_name' => 'Chapter1_Intro.pptx',
                'file_path' => '/artisansLMS/client/pages/uploads/ch1.pptx',
                'description' => 'Lecture Slides'
            ],
            [
                'file_name' => 'Dataset_Sample.xlsx',
                'file_path' => '/artisansLMS/client/pages/uploads/data.xlsx',
                'description' => 'Excel file for Assignment 1'
            ]
        ]
    ]);
    exit;
}

// ====================================================================
// DATABASE MODE 
// ====================================================================
// Update these to match your actual database credentials
$host = 'localhost';
$db   = 'artisans_lms'; // Your database name
$user = 'root';
$pass = '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Fetch the course name
    $stmtCourse = $pdo->prepare("SELECT name FROM classes WHERE class_id = ?");
    $stmtCourse->execute([$class_id]);
    $courseName = $stmtCourse->fetchColumn();

    // Fetch the resources (Update table/column names to match your DB)
    $stmt = $pdo->prepare("
        SELECT file_name, file_path, description 
        FROM resources 
        WHERE class_id = ?
        ORDER BY created_at DESC
    ");
    $stmt->execute([$class_id]);
    $resources = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Send successful JSON response
    echo json_encode([
        'status' => 'success',
        'course_name' => $courseName ? $courseName : 'Unknown Course',
        'resources' => $resources
    ]);

} catch (PDOException $e) {
    // If the database crashes, return a JSON error (NOT an HTML error)
    echo json_encode([
        'status' => 'error',
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}
?>