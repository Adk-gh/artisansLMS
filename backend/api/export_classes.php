<?php
require_once __DIR__ . '/../../server/config/db.php';
require_once __DIR__ . '/../middleware/json_response.php';

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=utf-8');

$provided_key = trim($_GET['api_key'] ?? '');
$stored_key   = '7f6c002275c76ced4aed037c73d5f24616ae395725043cba3606d559c23632a3';

if ($provided_key !== $stored_key) {
    json_response(['status' => 'error', 'message' => 'Unauthorized.'], 401);
}

$conn   = getConnection();
$action = trim($_GET['action'] ?? '');

if ($action === 'get_classes') {
    $sql = "SELECT c.class_id, c.semester, c.year, c.max_enrollment,
                   co.course_id, co.course_code, co.name AS course_name, 
                   co.credits AS units,
                   d.department_id, d.name AS department_name,
                   e.employee_id AS instructor_id,
                   e.first_name  AS instructor_first_name,
                   e.last_name   AS instructor_last_name,
                   CONCAT(e.first_name,' ',e.last_name) AS instructor_full_name
            FROM   classes c
            JOIN   courses     co ON co.course_id    = c.course_id
            JOIN   employees   e  ON e.employee_id   = c.instructor_id
            LEFT JOIN departments d ON d.department_id = co.department_id
            ORDER BY d.name ASC, co.name ASC, c.year DESC";
    $res = $conn->query($sql);
   
    $sections = [];
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $row['class_id']       = (int)$row['class_id'];
            $row['course_id']      = (int)$row['course_id'];
            $row['department_id']  = $row['department_id'] !== null ? (int)$row['department_id'] : null;
            $row['instructor_id']  = (int)$row['instructor_id'];
            $row['max_enrollment'] = (int)$row['max_enrollment'];
            $row['year']           = (int)$row['year'];
            $row['units']          = $row['units'] !== null ? (int)$row['units'] : null;
            $sections[] = $row;
        }
    }
    json_response(['status' => 'success', 'count' => count($sections), 'data' => $sections]);

} elseif ($action === 'get_departments') {
    $res  = $conn->query("SELECT department_id, name FROM departments ORDER BY name ASC");
    $rows = [];
    while ($row = $res->fetch_assoc()) { $row['department_id'] = (int)$row['department_id']; $rows[] = $row; }
    json_response(['status' => 'success', 'count' => count($rows), 'data' => $rows]);

} elseif ($action === 'get_instructors') {
    $res  = $conn->query("SELECT employee_id AS instructor_id, first_name, last_name, CONCAT(first_name,' ',last_name) AS full_name FROM employees WHERE is_faculty = 1 ORDER BY last_name ASC");
    $rows = [];
    while ($row = $res->fetch_assoc()) { $row['instructor_id'] = (int)$row['instructor_id']; $rows[] = $row; }
    json_response(['status' => 'success', 'count' => count($rows), 'data' => $rows]);

} elseif ($action === 'get_courses') {
    $res  = $conn->query("SELECT co.course_id, co.course_code, co.name AS course_name, co.units, d.department_id, d.name AS department_name FROM courses co LEFT JOIN departments d ON d.department_id = co.department_id ORDER BY co.name ASC");
    $rows = [];
    while ($row = $res->fetch_assoc()) { $row['course_id'] = (int)$row['course_id']; $rows[] = $row; }
    json_response(['status' => 'success', 'count' => count($rows), 'data' => $rows]);

} else {
    json_response(['status' => 'error', 'message' => 'Invalid action.'], 400);
}