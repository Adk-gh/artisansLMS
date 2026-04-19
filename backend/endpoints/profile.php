<?php
error_reporting(0);
ini_set('display_errors', 0);

require_once __DIR__ . '/../../server/config/db.php';
require_once __DIR__ . '/../middleware/json_response.php';

if (session_status() === PHP_SESSION_NONE) session_start();

// Auth check
if (!isset($_SESSION['user_id'])) {
    json_response(['status' => 'error', 'message' => 'Unauthorized access'], 401);
}

$conn = getConnection();
$action = $_GET['action'] ?? '';

$current_user_id = $_SESSION['user_id'];
$current_user_role = $_SESSION['role'];
$is_teacher = ($current_user_role === 'teacher' || $current_user_role === 'admin');

$table = $is_teacher ? 'employees' : 'students';
$id_col = $is_teacher ? 'employee_id' : 'student_id';

switch ($action) {
    case 'get_profile':
        // 1. Fetch Profile Data
        $stmt = $conn->prepare("SELECT first_name, last_name, email FROM $table WHERE $id_col = ? LIMIT 1");
        $stmt->bind_param("i", $current_user_id);
        $stmt->execute();
        $profile = $stmt->get_result()->fetch_assoc();

        if (!$profile) {
            json_response(["status" => "error", "message" => "Profile not found."], 404);
        }

        // 2. Fetch Stats based on Role
        $stats = [];
        if ($is_teacher) {
            $stats['classes'] = (int)$conn->query("SELECT COUNT(*) FROM classes WHERE instructor_id = '$current_user_id'")->fetch_row()[0];
            $stats['students'] = (int)$conn->query("SELECT COUNT(DISTINCT en.student_id) FROM enrollments en JOIN classes c ON en.class_id = c.class_id WHERE c.instructor_id = '$current_user_id'")->fetch_row()[0];
            $stats['tasks'] = (int)$conn->query("SELECT COUNT(*) FROM assignments a JOIN classes c ON a.class_id = c.class_id WHERE c.instructor_id = '$current_user_id'")->fetch_row()[0];
        } else {
            $stats['classes'] = (int)$conn->query("SELECT COUNT(*) FROM enrollments WHERE student_id = '$current_user_id'")->fetch_row()[0];
            $stats['submitted'] = (int)$conn->query("SELECT COUNT(*) FROM submissions WHERE student_id = '$current_user_id'")->fetch_row()[0];
            $stats['quizzes'] = (int)$conn->query("SELECT COUNT(*) FROM quiz_attempts WHERE student_id = '$current_user_id' AND status='submitted'")->fetch_row()[0];
        }

        json_response([
            "status" => "success", 
            "profile" => $profile,
            "role" => $current_user_role,
            "is_teacher" => $is_teacher,
            "stats" => $stats
        ]);
        break;

    case 'update_profile':
        $input = json_decode(file_get_contents('php://input'), true);
        
        $fname = trim($input['first_name'] ?? '');
        $lname = trim($input['last_name'] ?? '');
        $email = trim($input['email'] ?? '');

        if (!$fname || !$lname || !$email) {
            json_response(["status" => "error", "message" => "All fields are required."], 400);
        }

        $stmt = $conn->prepare("UPDATE $table SET first_name=?, last_name=?, email=? WHERE $id_col=?");
        $stmt->bind_param("sssi", $fname, $lname, $email, $current_user_id);
        
        if ($stmt->execute()) {
            $_SESSION['user_name'] = $fname . ' ' . $lname;
            json_response(["status" => "success", "message" => "Profile updated successfully.", "new_name" => $_SESSION['user_name']]);
        } else {
            json_response(["status" => "error", "message" => "Failed to update profile."], 500);
        }
        break;

    case 'change_password':
        $input = json_decode(file_get_contents('php://input'), true);
        
        $current_pw = $input['current_password'] ?? '';
        $new_pw = $input['new_password'] ?? '';
        $confirm_pw = $input['confirm_password'] ?? '';

        if (!$current_pw || !$new_pw || !$confirm_pw) {
            json_response(["status" => "error", "message" => "All password fields are required."], 400);
        }

        if ($new_pw !== $confirm_pw) {
            json_response(["status" => "error", "message" => "New passwords do not match."], 400);
        }

        $stmt = $conn->prepare("SELECT password FROM $table WHERE $id_col = ? LIMIT 1");
        $stmt->bind_param("i", $current_user_id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();

        if ($row && password_verify($current_pw, $row['password'])) {
            $hashed = password_hash($new_pw, PASSWORD_DEFAULT);
            
            $update_stmt = $conn->prepare("UPDATE $table SET password=? WHERE $id_col=?");
            $update_stmt->bind_param("si", $hashed, $current_user_id);
            
            if ($update_stmt->execute()) {
                json_response(["status" => "success", "message" => "Password changed successfully."]);
            } else {
                json_response(["status" => "error", "message" => "Failed to update password in database."], 500);
            }
        } else {
            json_response(["status" => "error", "message" => "Current password is incorrect."], 401);
        }
        break;

    default:
        json_response(["status" => "error", "message" => "Invalid action."], 400);
        break;
}