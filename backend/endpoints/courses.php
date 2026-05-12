<?php
error_reporting(0);
ini_set('display_errors', 0);

require_once __DIR__ . '/../../server/config/db.php';
require_once __DIR__ . '/../middleware/json_response.php';

if (session_status() === PHP_SESSION_NONE) session_start();

// Auth check
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
    json_response(['status' => 'error', 'message' => 'Unauthorized access'], 401);
}

$conn = getConnection();
$action = $_GET['action'] ?? '';
$postAction = $_POST['action'] ?? '';

// Check if action was passed via POST form data instead of GET query string
if (empty($action) && !empty($postAction)) {
    $action = $postAction;
}

switch ($action) {
    case 'get_all':
        $courses_arr = [];

        // JOIN departments to get dept name and carry department_id
        $res = $conn->query("
            SELECT c.*, d.name AS dept_name
            FROM courses c
            LEFT JOIN departments d ON d.department_id = c.department_id
            ORDER BY c.course_code ASC
        ");

        if ($res) {
            while ($row = $res->fetch_assoc()) {
                $cid = (int)$row['course_id'];

                // Get class count
                $row['class_count'] = (int)$conn->query("SELECT COUNT(*) FROM classes WHERE course_id=$cid")->fetch_row()[0];

                // Get resources
                $res_list  = $conn->query("SELECT * FROM course_resources WHERE course_id = $cid");
                $resources = [];
                if ($res_list) {
                    while ($file = $res_list->fetch_assoc()) {
                        $resources[] = $file;
                    }
                }
                $row['resources'] = $resources;

                $courses_arr[] = $row;
            }
        }

        // Unique unit values for filter dropdown
        $units_res = $conn->query("SELECT DISTINCT credits FROM courses ORDER BY credits ASC");
        $unit_opts = [];
        if ($units_res) {
            while ($ur = $units_res->fetch_assoc()) {
                $unit_opts[] = $ur['credits'];
            }
        }

        // All departments for tab bar
        $dept_res  = $conn->query("SELECT department_id, name FROM departments ORDER BY name ASC");
        $dept_opts = [];
        if ($dept_res) {
            while ($dr = $dept_res->fetch_assoc()) {
                $dept_opts[] = $dr;
            }
        }

        json_response([
            "status"      => "success",
            "data"        => $courses_arr,
            "units"       => $unit_opts,
            "departments" => $dept_opts
        ]);
        break;

    case 'create':
        $input   = json_decode(file_get_contents('php://input'), true);
        $code    = trim($input['code'] ?? '');
        $name    = trim($input['name'] ?? '');
        $desc    = trim($input['description'] ?? '');
        $credits = (int)($input['credits'] ?? 3);
        $dept_id = !empty($input['department_id']) ? (int)$input['department_id'] : null;

        if (!$code || !$name) {
            json_response(["status" => "error", "message" => "Course code and name are required."], 400);
        }

        $stmt = $conn->prepare("INSERT INTO courses (course_code, name, description, credits, department_id) VALUES (?, ?, ?, ?, ?)");
        $stmt->bind_param("sssii", $code, $name, $desc, $credits, $dept_id);

        if ($stmt->execute()) {
            json_response(["status" => "success", "message" => "Course created successfully."]);
        } else {
            json_response(["status" => "error", "message" => "Failed to create course."], 500);
        }
        break;

    case 'update':
        $input   = json_decode(file_get_contents('php://input'), true);
        $id      = (int)($input['course_id'] ?? 0);
        $code    = trim($input['code'] ?? '');
        $name    = trim($input['name'] ?? '');
        $desc    = trim($input['description'] ?? '');
        $credits = (int)($input['credits'] ?? 3);
        $dept_id = !empty($input['department_id']) ? (int)$input['department_id'] : null;

        if (!$id || !$code || !$name) {
            json_response(["status" => "error", "message" => "Invalid input data."], 400);
        }

        $stmt = $conn->prepare("UPDATE courses SET course_code=?, name=?, description=?, credits=?, department_id=? WHERE course_id=?");
        $stmt->bind_param("sssiis", $code, $name, $desc, $credits, $dept_id, $id);

        if ($stmt->execute()) {
            json_response(["status" => "success", "message" => "Course updated successfully."]);
        } else {
            json_response(["status" => "error", "message" => "Failed to update course."], 500);
        }
        break;

    case 'archive':
        $input = json_decode(file_get_contents('php://input'), true);
        $id    = (int)($input['course_id'] ?? 0);

        if (!$id) {
            json_response(["status" => "error", "message" => "Invalid course ID."], 400);
        }

        $conn->query("CREATE TABLE IF NOT EXISTS archive_log (
            archive_id   INT AUTO_INCREMENT PRIMARY KEY,
            record_type  VARCHAR(50)  NOT NULL,
            record_id    INT          NOT NULL,
            record_data  LONGTEXT     NOT NULL,
            archived_by  INT          NOT NULL,
            archived_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $row = $conn->query("SELECT * FROM courses WHERE course_id=$id LIMIT 1")->fetch_assoc();
        if ($row) {
            $conn->query("DELETE FROM archive_log WHERE record_type='courses' AND record_id=$id");
            $json = $conn->real_escape_string(json_encode($row, JSON_UNESCAPED_UNICODE));
            $by   = (int)$_SESSION['user_id'];
            $conn->query("INSERT INTO archive_log (record_type,record_id,record_data,archived_by) VALUES ('courses',$id,'$json',$by)");

            $class_res = $conn->query("SELECT class_id FROM classes WHERE course_id=$id");
            while ($cl = $class_res->fetch_assoc()) {
                $cid = (int)$cl['class_id'];
                $conn->query("DELETE FROM quiz_attempts  WHERE quiz_id IN (SELECT quiz_id FROM quizzes WHERE class_id=$cid)");
                $conn->query("DELETE FROM quiz_questions WHERE quiz_id IN (SELECT quiz_id FROM quizzes WHERE class_id=$cid)");
                $conn->query("DELETE FROM quizzes        WHERE class_id=$cid");
                $conn->query("DELETE FROM submissions    WHERE assignment_id IN (SELECT assignment_id FROM assignments WHERE class_id=$cid)");
                $conn->query("DELETE FROM assignments    WHERE class_id=$cid");
                $conn->query("DELETE FROM enrollments    WHERE class_id=$cid");
                $conn->query("DELETE FROM classes        WHERE class_id=$cid");
            }
            $conn->query("DELETE FROM course_resources WHERE course_id=$id");
            $conn->query("DELETE FROM courses WHERE course_id=$id");

            json_response(["status" => "success", "message" => "Course archived successfully."]);
        } else {
            json_response(["status" => "error", "message" => "Course not found."], 404);
        }
        break;

    case 'upload_resource':
        $course_id   = (int)($_POST['course_id'] ?? 0);
        $custom_name = trim($_POST['custom_name'] ?? 'Uploaded Resource');
        $file_desc   = trim($_POST['file_desc'] ?? '');
        $file_url    = trim($_POST['file_url'] ?? '');

        if (!$course_id || empty($file_url)) {
            echo json_encode(["status" => "error", "message" => "Invalid ID or no Firebase URL received."]);
            exit;
        }

        $stmt = $conn->prepare("INSERT INTO course_resources (course_id, file_name, file_path, description) VALUES (?, ?, ?, ?)");
        $stmt->bind_param("isss", $course_id, $custom_name, $file_url, $file_desc);

        if ($stmt->execute()) {
            echo json_encode(["status" => "success", "message" => "File saved successfully."]);
        } else {
            echo json_encode(["status" => "error", "message" => "Database insertion failed."]);
        }
        exit;

    case 'delete_resource':
        $resource_id = (int)($_POST['resource_id'] ?? 0);
        if (!$resource_id) json_response(["status" => "error", "message" => "Invalid resource ID."], 400);

        // Fetch URL before deleting so JS can remove it from Firebase Storage
        $file_info = $conn->query("SELECT file_path FROM course_resources WHERE resource_id=$resource_id LIMIT 1")->fetch_assoc();
        $file_path = $file_info ? $file_info['file_path'] : '';

        if ($conn->query("DELETE FROM course_resources WHERE resource_id=$resource_id")) {
            json_response([
                "status" => "success",
                "message" => "File removed successfully.",
                "file_path" => $file_path
            ]);
        } else {
            json_response(["status" => "error", "message" => "Failed to remove file."], 500);
        }
        break;

    default:
        json_response(["status" => "error", "message" => "Invalid action."], 400);
        break;
}