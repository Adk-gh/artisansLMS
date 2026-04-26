<?php
header('Content-Type: application/json');
error_reporting(0);
ini_set('display_errors', 0);

if (!isset($_GET['action']) || $_GET['action'] !== 'get_modules') {
    echo json_encode(['status' => 'error', 'message' => 'Invalid action']);
    exit;
}

if (!isset($_GET['class_id'])) {
    echo json_encode(['status' => 'error', 'message' => 'Missing class_id']);
    exit;
}

$class_id = intval($_GET['class_id']);

require_once __DIR__ . '/../../server/config/db.php';
$conn = getConnection();

// Get course_id and course name from class
$res = $conn->query("
    SELECT cl.course_id, co.name AS course_name, co.course_code
    FROM classes cl
    JOIN courses co ON cl.course_id = co.course_id
    WHERE cl.class_id = $class_id
    LIMIT 1
");

if (!$res || $res->num_rows === 0) {
    echo json_encode(['status' => 'error', 'message' => 'Class not found.']);
    exit;
}

$classRow  = $res->fetch_assoc();
$course_id = (int) $classRow['course_id'];

// Fetch from course_resources using course_id
$rRes = $conn->query("
    SELECT resource_id, file_name, file_path, description, uploaded_at
    FROM course_resources
    WHERE course_id = $course_id
    ORDER BY uploaded_at DESC
");

$resources = [];
if ($rRes) {
    while ($row = $rRes->fetch_assoc()) {
        $path = $row['file_path'];

        if (str_starts_with($path, 'http') || str_starts_with($path, '/')) {
            // already absolute
        } elseif (str_starts_with($path, 'uploads/resources/')) {
            $row['file_path'] = '/artisansLMS/client/assets/' . $path;
        } elseif (str_starts_with($path, 'uploads/')) {
            $row['file_path'] = '/artisansLMS/backend/' . $path;
        } else {
            $row['file_path'] = '/artisansLMS/client/assets/' . $path;
        }

        $resources[] = $row;
    }
}

echo json_encode([
    'status'      => 'success',
    'course_name' => $classRow['course_name'],
    'course_code' => $classRow['course_code'],
    'resources'   => $resources
]);
?>