<?php
error_reporting(0);
ini_set('display_errors', 0);

require_once __DIR__ . '/../../server/config/db.php';
require_once __DIR__ . '/../middleware/json_response.php';

if (session_status() === PHP_SESSION_NONE) session_start();

if (!isset($_SESSION['user_id']) || !in_array(strtolower(trim($_SESSION['role'] ?? '')), ['teacher', 'admin'])) {
    json_response(['status' => 'error', 'message' => 'Unauthorized'], 401);
}

$instructor_id = (int) $_SESSION['user_id'];
$conn   = getConnection();
$action = $_REQUEST['action'] ?? '';

// ── GET: courses + resources ─────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'get_courses') {
    $courses = [];

    $sql = "SELECT DISTINCT co.* FROM courses co
            JOIN classes cl ON co.course_id = cl.course_id
            WHERE cl.instructor_id = $instructor_id
            ORDER BY co.course_code ASC";

    $res = $conn->query($sql);

    if ($res && $res->num_rows > 0) {
        while ($row = $res->fetch_assoc()) {
            $cid = (int) $row['course_id'];

            // Get Chat ID
            $cl_sql = "SELECT class_id FROM classes WHERE course_id = $cid AND instructor_id = $instructor_id LIMIT 1";
            $cl_res = $conn->query($cl_sql);
            $row['class_id_for_chat'] = ($cl_res && $cl_res->num_rows > 0) ? $cl_res->fetch_assoc()['class_id'] : 0;

            // Get Resources
            $row['resources'] = [];
            $rl_sql = "SELECT * FROM course_resources WHERE course_id = $cid";
            $rl_res = $conn->query($rl_sql);
            if ($rl_res) {
                while ($file = $rl_res->fetch_assoc()) {
                    $row['resources'][] = $file;
                }
            }
            $courses[] = $row;
        }
    }

    json_response(['status' => 'success', 'data' => $courses]);
}

// ── POST: upload resource ────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'upload_resource') {
    $course_id   = (int) ($_POST['course_id'] ?? 0);
    $custom_name = trim($_POST['custom_name'] ?? '');
    $file_desc   = trim($_POST['file_desc']   ?? '');

    // Fetch the Firebase URL passed from frontend JS
    $file_url    = trim($_POST['file_url'] ?? '');

    if (!$course_id) json_response(['status' => 'error', 'message' => 'Invalid course ID.']);
    if (empty($file_url)) json_response(['status' => 'error', 'message' => 'No Firebase URL received.']);

    // Ensure we have a display name
    $display_name = $custom_name ?: 'Uploaded Resource';

    // MySQLi Prepared Statement - Save URL as file_path
    $stmt = $conn->prepare("INSERT INTO course_resources (course_id, file_name, file_path, description) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("isss", $course_id, $display_name, $file_url, $file_desc);
    $stmt->execute();

    if ($stmt->affected_rows > 0) {
        $new_id = $conn->insert_id;
        $stmt->close();
        json_response([
            'status'      => 'success',
            'resource_id' => $new_id,
            'file_name'   => $display_name,
            'file_path'   => $file_url, // Return Firebase URL to JS
        ]);
    }

    $stmt->close();
    json_response(['status' => 'error', 'message' => 'DB insert failed.']);
}

// ── POST: delete resource ────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'delete_resource') {
    $resource_id = (int) ($_POST['resource_id'] ?? 0);
    if (!$resource_id) json_response(['status' => 'error', 'message' => 'Invalid resource ID.']);

    // Get the Firebase URL before deleting so JS can remove it from cloud
    $res = $conn->query("SELECT file_path FROM course_resources WHERE resource_id = $resource_id");

    if ($res && $res->num_rows > 0) {
        $row = $res->fetch_assoc();
        $file_path = $row['file_path'];

        $conn->query("DELETE FROM course_resources WHERE resource_id = $resource_id");

        json_response([
            'status' => 'success',
            'message' => 'Deleted.',
            'file_path' => $file_path // Pass URL back so JS can call deleteObject()
        ]);
    }
    json_response(['status' => 'error', 'message' => 'Resource not found.']);
}

// ── POST: edit resource ──────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'edit_resource') {
    $resource_id = (int) ($_POST['resource_id'] ?? 0);
    $custom_name = trim($_POST['custom_name'] ?? '');
    $file_desc   = trim($_POST['file_desc']   ?? '');

    if (!$resource_id || !$custom_name) json_response(['status' => 'error', 'message' => 'Missing fields.']);

    // MySQLi Prepared Statement
    $stmt = $conn->prepare("UPDATE course_resources SET file_name = ?, description = ? WHERE resource_id = ?");
    $stmt->bind_param("ssi", $custom_name, $file_desc, $resource_id);
    $stmt->execute();

    $stmt->close();
    json_response(['status' => 'success', 'message' => 'Updated.']);
}

json_response(['status' => 'error', 'message' => 'Unknown action.'], 400);