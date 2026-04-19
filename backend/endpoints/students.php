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

switch ($action) {
        case 'get_all':
        // Optional department filter
        $dept_filter = isset($_GET['department_id']) && $_GET['department_id'] !== ''
                       ? (int)$_GET['department_id']
                       : null;

        // ── Stats (unfiltered totals) ──
        $total_stu       = (int)$conn->query("SELECT COUNT(*) FROM students")->fetch_row()[0];
        $male_count      = (int)$conn->query("SELECT COUNT(*) FROM students WHERE gender='M'")->fetch_row()[0];
        $female_count    = (int)$conn->query("SELECT COUNT(*) FROM students WHERE gender='F'")->fetch_row()[0];
        $new_this_month  = (int)$conn->query(
            "SELECT COUNT(*) FROM students WHERE MONTH(enrollment_date)=MONTH(NOW()) AND YEAR(enrollment_date)=YEAR(NOW())"
        )->fetch_row()[0];

        // ── Students List (Fetch Department ALWAYS) ──
        $sql = "SELECT s.*, 
                GROUP_CONCAT(DISTINCT d.name SEPARATOR ', ') AS dept_name
                FROM students s
                LEFT JOIN enrollments e ON s.student_id = e.student_id 
                LEFT JOIN classes c     ON e.class_id = c.class_id
                LEFT JOIN courses co    ON c.course_id = co.course_id
                LEFT JOIN departments d ON co.department_id = d.department_id";

        if ($dept_filter !== null) {
            $sql .= " WHERE d.department_id = $dept_filter";
        }

        $sql .= " GROUP BY s.student_id ORDER BY s.enrollment_date DESC";

        $students = [];
        $res = $conn->query($sql);
        if ($res) {
            while ($row = $res->fetch_assoc()) {
                $students[] = $row;
            }
        }

        // ── All departments for the filter dropdown ──
        $departments = [];
        $dept_res = $conn->query("SELECT department_id, name FROM departments ORDER BY name ASC");
        if ($dept_res) {
            while ($dr = $dept_res->fetch_assoc()) {
                $departments[] = $dr;
            }
        }

        json_response([
            "status" => "success",
            "stats"  => [
                "total"  => $total_stu,
                "male"   => $male_count,
                "female" => $female_count,
                "new"    => $new_this_month
            ],
            "data"        => $students,
            "departments" => $departments
        ]);
        break;

    case 'create':
        $input = json_decode(file_get_contents('php://input'), true);

        $fname  = trim($input['fname']  ?? '');
        $lname  = trim($input['lname']  ?? '');
        $email  = trim($input['email']  ?? '');
        $dob    = $input['dob']         ?? null;
        $gender = in_array($input['gender'] ?? '', ['M','F','Other']) ? $input['gender'] : 'M';
        $today  = date('Y-m-d');

        if (!$fname || !$lname || !$email) {
            json_response(["status" => "error", "message" => "Missing required fields."], 400);
        }

        $stmt = $conn->prepare(
            "INSERT INTO students (first_name, last_name, email, dob, gender, enrollment_date)
             VALUES (?, ?, ?, ?, ?, ?)"
        );
        $stmt->bind_param("ssssss", $fname, $lname, $email, $dob, $gender, $today);

        if ($stmt->execute()) {
            json_response(["status" => "success", "message" => "Student registered successfully."]);
        } else {
            json_response(["status" => "error", "message" => "Failed to register student."], 500);
        }
        break;

    case 'update':
        $input = json_decode(file_get_contents('php://input'), true);

        $id     = (int)($input['student_id'] ?? 0);
        $fname  = trim($input['fname']  ?? '');
        $lname  = trim($input['lname']  ?? '');
        $email  = trim($input['email']  ?? '');
        $dob    = $input['dob']         ?? null;
        $gender = in_array($input['gender'] ?? '', ['M','F','Other']) ? $input['gender'] : 'M';

        if (!$id || !$fname || !$lname || !$email) {
            json_response(["status" => "error", "message" => "Missing required fields."], 400);
        }

        $stmt = $conn->prepare(
            "UPDATE students SET first_name=?, last_name=?, email=?, dob=?, gender=?
             WHERE student_id=?"
        );
        $stmt->bind_param("sssssi", $fname, $lname, $email, $dob, $gender, $id);

        if ($stmt->execute()) {
            json_response(["status" => "success", "message" => "Student updated successfully."]);
        } else {
            json_response(["status" => "error", "message" => "Failed to update student."], 500);
        }
        break;

    case 'archive':
        $input = json_decode(file_get_contents('php://input'), true);
        $id    = (int)($input['student_id'] ?? 0);

        if (!$id) {
            json_response(["status" => "error", "message" => "Invalid student ID."], 400);
        }

        $conn->query("CREATE TABLE IF NOT EXISTS archive_log (
            archive_id   INT AUTO_INCREMENT PRIMARY KEY,
            record_type  VARCHAR(50)  NOT NULL,
            record_id    INT          NOT NULL,
            record_data  LONGTEXT     NOT NULL,
            archived_by  INT          NOT NULL,
            archived_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $row = $conn->query("SELECT * FROM students WHERE student_id=$id LIMIT 1")->fetch_assoc();

        if ($row) {
            $conn->query("DELETE FROM archive_log WHERE record_type='students' AND record_id=$id");

            $json = $conn->real_escape_string(json_encode($row, JSON_UNESCAPED_UNICODE));
            $by   = (int)$_SESSION['user_id'];

            $conn->query("INSERT INTO archive_log (record_type,record_id,record_data,archived_by)
                          VALUES ('students',$id,'$json',$by)");

            // Cascading Deletes
            $conn->query("DELETE FROM submissions    WHERE student_id=$id");
            $conn->query("DELETE FROM quiz_attempts  WHERE student_id=$id");
            $conn->query("DELETE FROM enrollments    WHERE student_id=$id");
            $conn->query("DELETE FROM students       WHERE student_id=$id");

            json_response(["status" => "success", "message" => "Student archived successfully."]);
        } else {
            json_response(["status" => "error", "message" => "Student record not found."], 404);
        }
        break;

    default:
        json_response(["status" => "error", "message" => "Invalid action."], 400);
        break;
}