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
        $depts_arr = [];
        $dq = $conn->query("SELECT * FROM departments ORDER BY name ASC");
        if ($dq) while ($d = $dq->fetch_assoc()) $depts_arr[] = $d;

        $pos_arr = [];
        $pq = $conn->query("SELECT * FROM positions ORDER BY title ASC");
        if ($pq) while ($p = $pq->fetch_assoc()) $pos_arr[] = $p;

        $instructors_arr = [];
        $sql = "SELECT e.*, p.title AS pos_title, d.name AS dept_name
                FROM employees e
                LEFT JOIN positions p ON e.position_id = p.position_id
                LEFT JOIN departments d ON e.department_id = d.department_id
                WHERE e.is_faculty = 1
                ORDER BY e.last_name ASC";
        $res = $conn->query($sql);
        
        if ($res) {
            while ($row = $res->fetch_assoc()) {
                $eid = (int)$row['employee_id'];
                $row['class_count'] = (int)$conn->query("SELECT COUNT(*) FROM classes WHERE instructor_id=$eid")->fetch_row()[0];
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
        $input = json_decode(file_get_contents('php://input'), true);
        
        $fname = trim($input['fname'] ?? '');
        $lname = trim($input['lname'] ?? '');
        $email = trim($input['email'] ?? '');
        $dob = $input['dob'] ?: null;
        $gender = in_array($input['gender'] ?? '', ['M','F','Other']) ? $input['gender'] : 'M';
        $hire = $input['hire_date'] ?: date('Y-m-d');
        $dept_id = (int)($input['department_id'] ?? 0);
        $pos_id = (int)($input['position_id'] ?? 0);
        $salary = (float)($input['salary'] ?? 0.0);
        $password = trim($input['password'] ?? '');

        if (!$fname || !$lname || !$email || !$password) {
            json_response(["status" => "error", "message" => "Missing required fields."], 400);
        }

        $hashed_password = password_hash($password, PASSWORD_DEFAULT);
        $is_faculty = 1;
        $role = 'teacher';

        $stmt = $conn->prepare("INSERT INTO employees (first_name, last_name, email, password, role, is_faculty, date_of_birth, gender, hire_date, department_id, position_id, salary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("sssssisssiid", $fname, $lname, $email, $hashed_password, $role, $is_faculty, $dob, $gender, $hire, $dept_id, $pos_id, $salary);
        
        if ($stmt->execute()) {
            json_response([
                "status" => "success", 
                "message" => "Account created.",
                "email" => $email,
                "pass" => $password // Return plain text once for the success toast
            ]);
        } else {
            json_response(["status" => "error", "message" => "Failed to create instructor."], 500);
        }
        break;

    case 'update':
        $input = json_decode(file_get_contents('php://input'), true);
        
        $id = (int)($input['employee_id'] ?? 0);
        $fname = trim($input['fname'] ?? '');
        $lname = trim($input['lname'] ?? '');
        $email = trim($input['email'] ?? '');
        $dob = $input['dob'] ?: null;
        $gender = in_array($input['gender'] ?? '', ['M','F','Other']) ? $input['gender'] : 'M';
        $hire = $input['hire_date'] ?: null;
        $dept_id = (int)($input['department_id'] ?? 0);
        $pos_id = (int)($input['position_id'] ?? 0);
        $salary = (float)($input['salary'] ?? 0.0);
        $new_pass = trim($input['new_password'] ?? '');

        if (!$id || !$fname || !$lname || !$email) {
            json_response(["status" => "error", "message" => "Missing required fields."], 400);
        }

        if ($new_pass !== '') {
            $hashed_password = password_hash($new_pass, PASSWORD_DEFAULT);
            $stmt = $conn->prepare("UPDATE employees SET first_name=?, last_name=?, email=?, date_of_birth=?, gender=?, hire_date=?, department_id=?, position_id=?, salary=?, password=? WHERE employee_id=?");
            $stmt->bind_param("ssssssiidsi", $fname, $lname, $email, $dob, $gender, $hire, $dept_id, $pos_id, $salary, $hashed_password, $id);
        } else {
            $stmt = $conn->prepare("UPDATE employees SET first_name=?, last_name=?, email=?, date_of_birth=?, gender=?, hire_date=?, department_id=?, position_id=?, salary=? WHERE employee_id=?");
            $stmt->bind_param("ssssssiidi", $fname, $lname, $email, $dob, $gender, $hire, $dept_id, $pos_id, $salary, $id);
        }
        
        if ($stmt->execute()) {
            json_response(["status" => "success", "message" => "Instructor updated successfully."]);
        } else {
            json_response(["status" => "error", "message" => "Failed to update instructor."], 500);
        }
        break;

    case 'archive':
        $input = json_decode(file_get_contents('php://input'), true);
        $id = (int)($input['archive_id'] ?? 0);

        if (!$id) {
            json_response(["status" => "error", "message" => "Invalid instructor ID."], 400);
        }

        $conn->query("CREATE TABLE IF NOT EXISTS archive_log (
            archive_id   INT AUTO_INCREMENT PRIMARY KEY,
            record_type  VARCHAR(50)  NOT NULL,
            record_id    INT          NOT NULL,
            record_data  LONGTEXT     NOT NULL,
            archived_by  INT          NOT NULL,
            archived_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $row = $conn->query("SELECT e.*, p.title AS pos_title, d.name AS dept_name
                             FROM employees e
                             LEFT JOIN positions p ON e.position_id = p.position_id
                             LEFT JOIN departments d ON e.department_id = d.department_id
                             WHERE e.employee_id = $id LIMIT 1")->fetch_assoc();
        
        if ($row) {
            $conn->query("DELETE FROM archive_log WHERE record_type='employees' AND record_id=$id");
            $json = $conn->real_escape_string(json_encode($row, JSON_UNESCAPED_UNICODE));
            $by   = (int)$_SESSION['user_id'];
            
            $conn->query("INSERT INTO archive_log (record_type,record_id,record_data,archived_by) VALUES ('employees',$id,'$json',$by)");
            
            $class_res = $conn->query("SELECT class_id FROM classes WHERE instructor_id=$id");
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
            $conn->query("DELETE FROM employees WHERE employee_id=$id");

            json_response(["status" => "success", "message" => "Instructor archived successfully."]);
        } else {
            json_response(["status" => "error", "message" => "Instructor not found."], 404);
        }
        break;

    default:
        json_response(["status" => "error", "message" => "Invalid action."], 400);
        break;
}