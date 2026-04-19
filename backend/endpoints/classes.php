<?php
// classes.php - Endpoint for managing class sections
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
        // Department is now read from courses.department_id — no classes.department_id needed
        $sql = "SELECT c.*,
                       co.course_code, co.name AS course_name,
                       co.department_id AS dept_id,
                       e.first_name, e.last_name,
                       d.name AS dept_name,
                       (SELECT COUNT(*) FROM enrollments WHERE class_id = c.class_id) AS current_students
                FROM classes c
                JOIN courses     co ON co.course_id     = c.course_id
                JOIN employees   e  ON e.employee_id    = c.instructor_id
                LEFT JOIN departments d ON d.department_id = co.department_id
                ORDER BY co.name ASC, c.year DESC, c.semester DESC";

        $res = $conn->query($sql);

        $grouped_courses = [];
        if ($res && $res->num_rows > 0) {
            while ($row = $res->fetch_assoc()) {
                $key = $row['course_code'];
                if (!isset($grouped_courses[$key])) {
                    $grouped_courses[$key] = [
                        'course_code'    => $key,
                        'course_name'    => $row['course_name'],
                        'department_id'  => $row['dept_id'],      // from courses
                        'dept_name'      => $row['dept_name'],
                        'total_students' => 0,
                        'sections'       => []
                    ];
                }
                $grouped_courses[$key]['total_students'] += (int)$row['current_students'];
                $grouped_courses[$key]['sections'][]      = $row;
            }
        }

        // Total unique courses with active classes
        $total_courses = $conn->query("SELECT COUNT(DISTINCT course_id) FROM classes")->fetch_row()[0] ?? 0;

        // All departments for tab bar
        $dept_opts = [];
        $dept_res  = $conn->query("SELECT department_id, name FROM departments ORDER BY name ASC");
        if ($dept_res) {
            while ($dr = $dept_res->fetch_assoc()) $dept_opts[] = $dr;
        }

        json_response([
            "status"        => "success",
            "data"          => array_values($grouped_courses),
            "total_courses" => $total_courses,
            "departments"   => $dept_opts
        ]);
        break;

    case 'get_form_data':
        $courses = [];
        $res = $conn->query("SELECT course_id, course_code, name FROM courses ORDER BY name ASC");
        while ($row = $res->fetch_assoc()) $courses[] = $row;

        $instructors = [];
        $res2 = $conn->query("SELECT employee_id, first_name, last_name FROM employees WHERE is_faculty = 1 ORDER BY last_name ASC");
        while ($row = $res2->fetch_assoc()) $instructors[] = $row;

        $semesters = [];
        $res3 = $conn->query("SELECT DISTINCT semester, year FROM classes ORDER BY year DESC, semester ASC");
        while ($row = $res3->fetch_assoc()) $semesters[] = $row;

        json_response([
            "status"      => "success",
            "courses"     => $courses,
            "instructors" => $instructors,
            "semesters"   => $semesters
        ]);
        break;

    case 'create':
        $input         = json_decode(file_get_contents('php://input'), true);
        $course_id     = (int)($input['course_id']     ?? 0);
        $instructor_id = (int)($input['instructor_id'] ?? 0);
        $semester      = $conn->real_escape_string($input['semester'] ?? '');
        $year          = (int)($input['year']          ?? date('Y'));
        $max_enroll    = (int)($input['max_enrollment'] ?? 40);

        if (!$course_id || !$instructor_id || !$semester) {
            json_response(["status" => "error", "message" => "Missing required fields."], 400);
        }

        $stmt = $conn->prepare(
            "INSERT INTO classes (course_id, instructor_id, semester, year, max_enrollment)
             VALUES (?, ?, ?, ?, ?)"
        );
        $stmt->bind_param("iisii", $course_id, $instructor_id, $semester, $year, $max_enroll);

        if ($stmt->execute()) {
            json_response(["status" => "success", "message" => "Class section successfully created."]);
        } else {
            json_response(["status" => "error", "message" => "Failed to create class."], 500);
        }
        break;

    case 'update':
        $input         = json_decode(file_get_contents('php://input'), true);
        $class_id      = (int)($input['class_id']      ?? 0);
        $course_id     = (int)($input['course_id']     ?? 0);
        $instructor_id = (int)($input['instructor_id'] ?? 0);
        $semester      = $conn->real_escape_string($input['semester'] ?? '');
        $year          = (int)($input['year']          ?? date('Y'));
        $max_enroll    = (int)($input['max_enrollment'] ?? 40);

        if (!$class_id || !$course_id || !$instructor_id || !$semester) {
            json_response(["status" => "error", "message" => "Missing required fields."], 400);
        }

        $stmt = $conn->prepare(
            "UPDATE classes SET course_id=?, instructor_id=?, semester=?, year=?, max_enrollment=?
             WHERE class_id=?"
        );
        $stmt->bind_param("iisiii", $course_id, $instructor_id, $semester, $year, $max_enroll, $class_id);

        if ($stmt->execute()) {
            json_response(["status" => "success", "message" => "Class details updated successfully."]);
        } else {
            json_response(["status" => "error", "message" => "Failed to update class."], 500);
        }
        break;

    case 'archive':
        $input = json_decode(file_get_contents('php://input'), true);
        $id    = (int)($input['class_id'] ?? 0);

        if (!$id) {
            json_response(["status" => "error", "message" => "Invalid class ID."], 400);
        }

        $conn->query("CREATE TABLE IF NOT EXISTS archive_log (
            archive_id  INT AUTO_INCREMENT PRIMARY KEY,
            record_type VARCHAR(50)  NOT NULL,
            record_id   INT          NOT NULL,
            record_data LONGTEXT     NOT NULL,
            archived_by INT          NOT NULL,
            archived_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $row = $conn->query(
            "SELECT c.*, co.course_code, co.name AS course_name, e.first_name, e.last_name
             FROM classes c
             JOIN courses   co ON co.course_id   = c.course_id
             JOIN employees e  ON e.employee_id  = c.instructor_id
             WHERE c.class_id = $id LIMIT 1"
        )->fetch_assoc();

        if ($row) {
            $conn->query("DELETE FROM archive_log WHERE record_type='classes' AND record_id=$id");
            $json = $conn->real_escape_string(json_encode($row, JSON_UNESCAPED_UNICODE));
            $by   = (int)$_SESSION['user_id'];
            $conn->query("INSERT INTO archive_log (record_type,record_id,record_data,archived_by)
                          VALUES ('classes',$id,'$json',$by)");

            // Cascade Deletes
            $conn->query("DELETE FROM submissions    WHERE assignment_id IN (SELECT assignment_id FROM assignments WHERE class_id=$id)");
            $conn->query("DELETE FROM assignments    WHERE class_id=$id");
            $conn->query("DELETE FROM quiz_attempts  WHERE quiz_id IN (SELECT quiz_id FROM quizzes WHERE class_id=$id)");
            $conn->query("DELETE FROM quiz_questions WHERE quiz_id IN (SELECT quiz_id FROM quizzes WHERE class_id=$id)");
            $conn->query("DELETE FROM quizzes        WHERE class_id=$id");
            $conn->query("DELETE FROM enrollments    WHERE class_id=$id");
            $conn->query("DELETE FROM classes        WHERE class_id=$id");

            json_response(["status" => "success", "message" => "Class section successfully archived."]);
        } else {
            json_response(["status" => "error", "message" => "Class record not found."], 404);
        }
        break;

    default:
        json_response(["status" => "error", "message" => "Invalid action."], 400);
        break;
}