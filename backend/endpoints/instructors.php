<?php
error_reporting(0);
ini_set('display_errors', 0);

require_once __DIR__ . '/../../server/config/db.php';
require_once __DIR__ . '/../middleware/json_response.php';

define('HRIS_API_URL', 'https://hris.infinityfreeapp.com/api/faculty.php');
define('HRIS_API_KEY', getenv('HRIS_API_KEY') ?: 'local_hris_api_key');

if (session_status() === PHP_SESSION_NONE) session_start();

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
    json_response(['status' => 'error', 'message' => 'Unauthorized access'], 401);
}

$conn = getConnection();
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'get_all':
        $depts_arr = [];
        $dq = $conn->query("SELECT * FROM departments ORDER BY name ASC");
        if ($dq) while ($d = $dq->fetch_assoc()) $depts_arr[] = $d;

        $pos_arr = [];
        $pq = $conn->query("SELECT * FROM positions ORDER BY title ASC");
        if ($pq) while ($p = $pq->fetch_assoc()) $pos_arr[] = $p;

        $instructors_arr = [];
        // Filter out archived employees
        $sql = "SELECT e.*, p.title AS pos_title, d.name AS dept_name
                FROM employees e
                LEFT JOIN positions p ON e.position_id = p.position_id
                LEFT JOIN departments d ON e.department_id = d.department_id
                WHERE e.is_faculty = 1 AND e.is_archived = 0
                ORDER BY e.last_name ASC";
        $res = $conn->query($sql);

        if ($res) {
            while ($row = $res->fetch_assoc()) {
                $eid = (int)$row['employee_id'];
                $row['class_count'] = (int)$conn->query("SELECT COUNT(*) FROM classes WHERE instructor_id=$eid")->fetch_row()[0];
                $row['managed_by_hris'] = true;
                $instructors_arr[] = $row;
            }
        }

        json_response([
            "status" => "success",
            "data" => $instructors_arr,
            "departments" => $depts_arr,
            "positions" => $pos_arr
        ]);
        break;

    case 'create':
    case 'update':
        // Updated message to reflect the automated push-only system
        json_response(["status" => "error", "message" => "Profiles are managed via the HRIS. Updates happen automatically."], 403);
        break;

    case 'generate_password':
        $input = json_decode(file_get_contents('php://input'), true);
        $eid = (int)($input['employee_id'] ?? 0);

        if (!$eid) json_response(["status" => "error", "message" => "Invalid instructor ID."], 400);

        $check = $conn->query("SELECT first_name, last_name, email FROM employees WHERE employee_id = $eid LIMIT 1")->fetch_assoc();
        if (!$check) json_response(["status" => "error", "message" => "Instructor not found."], 404);

        $tmp_pass = 'FAC-' . substr(str_shuffle('ABCDEFGHJKMNPQRSTUVWXYZ23456789'), 0, 6);
        $hashed = password_hash($tmp_pass, PASSWORD_DEFAULT);

        $stmt = $conn->prepare("UPDATE employees SET password_hash = ? WHERE employee_id = ?");
        $stmt->bind_param("si", $hashed, $eid);

        if ($stmt->execute()) {
            json_response([
                "status" => "success",
                "message" => "Password generated.",
                "instructor_name" => $check['first_name'] . ' ' . $check['last_name'],
                "temp_password" => $tmp_pass
            ]);
        } else {
            json_response(["status" => "error", "message" => "Failed to update password."], 500);
        }
        break;

    case 'archive':
        $input = json_decode(file_get_contents('php://input'), true);
        $id = (int)($input['archive_id'] ?? 0);

        if (!$id) json_response(["status" => "error", "message" => "Invalid instructor ID."], 400);

        // Safe soft-delete using prepared statements
        $stmt = $conn->prepare("UPDATE employees SET is_archived = 1 WHERE employee_id = ?");
        $stmt->bind_param("i", $id);

        if ($stmt->execute()) {
            json_response(["status" => "success", "message" => "Instructor archived successfully."]);
        } else {
            json_response(["status" => "error", "message" => "Failed to archive instructor."], 500);
        }
        break;

    default:
        json_response(["status" => "error", "message" => "Invalid action."], 400);
        break;
}