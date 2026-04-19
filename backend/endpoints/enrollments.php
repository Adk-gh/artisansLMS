<?php
error_reporting(0);
ini_set('display_errors', 0);

require_once __DIR__ . '/../../server/config/db.php';
require_once __DIR__ . '/../middleware/json_response.php';

if (session_status() === PHP_SESSION_NONE) session_start();

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
    json_response(['status' => 'error', 'message' => 'Unauthorized access'], 401);
}

$conn = getConnection();
$action = $_GET['action'] ?? '';

switch ($action) {

    case 'get_all':
        $sql = "SELECT e.enrollment_id, e.status, e.enroll_date,
                       s.student_id, s.first_name, s.last_name,
                       co.course_code, co.name AS course_name,
                       emp.last_name AS prof,
                       c.semester, c.year, c.class_id
                FROM enrollments e
                JOIN students s       ON e.student_id    = s.student_id
                JOIN classes c        ON e.class_id      = c.class_id
                JOIN courses co       ON c.course_id     = co.course_id
                JOIN employees emp    ON c.instructor_id = emp.employee_id
                ORDER BY
                    FIELD(e.status, 'Pending Finance', 'Approved', 'Rejected'),
                    s.last_name ASC,
                    e.enroll_date DESC";

        $res     = $conn->query($sql);
        $grouped = [];
        if ($res && $res->num_rows > 0) {
            while ($row = $res->fetch_assoc()) {
                $sid = $row['student_id'];
                if (!isset($grouped[$sid])) {
                    $grouped[$sid] = [
                        'student_id' => $sid,
                        'name'       => $row['last_name'] . ', ' . $row['first_name'],
                        'classes'    => []
                    ];
                }
                $grouped[$sid]['classes'][] = $row;
            }
        }

        // Archives
        $arc_res      = $conn->query(
            "SELECT a.record_data, a.archived_at,
                    COALESCE(CONCAT(emp.first_name,' ',emp.last_name), CONCAT('User #',a.archived_by)) AS archiver
             FROM archive_log a
             LEFT JOIN employees emp ON a.archived_by = emp.employee_id
             WHERE a.record_type = 'enrollments'
             ORDER BY a.archived_at DESC"
        );
        $archive_data = [];
        if ($arc_res) {
            while ($row = $arc_res->fetch_assoc()) {
                $data = json_decode($row['record_data'], true);
                if (isset($data['student_id'])) {
                    $archive_data[$data['student_id']][] = [
                        'archiver'    => $row['archiver'],
                        'archived_at' => $row['archived_at'],
                        'course_code' => $data['course_code'] ?? '—',
                        'course_name' => $data['course_name'] ?? '—',
                        'semester'    => $data['semester']    ?? '',
                        'year'        => $data['year']        ?? ''
                    ];
                }
            }
        }

        $pending_count = $conn->query(
            "SELECT COUNT(*) FROM enrollments WHERE status = 'Pending Finance'"
        )->fetch_row()[0] ?? 0;

        json_response([
            "status"        => "success",
            "data"          => array_values($grouped),
            "archives"      => $archive_data,
            "pending_count" => (int)$pending_count
        ]);
        break;

    case 'get_form_data':
        $students = [];
        $res = $conn->query("SELECT student_id, first_name, last_name FROM students ORDER BY last_name ASC");
        while ($row = $res->fetch_assoc()) $students[] = $row;

        $classes = [];
        $res2    = $conn->query(
            "SELECT c.class_id, co.course_code, co.name, emp.last_name
             FROM classes c
             JOIN courses co    ON c.course_id    = co.course_id
             JOIN employees emp ON c.instructor_id = emp.employee_id
             ORDER BY co.course_code ASC"
        );
        while ($row = $res2->fetch_assoc()) $classes[] = $row;

        // Rejected enrollments are excluded so the student can be re-enrolled
        $enrollments = [];
        $res3 = $conn->query("SELECT student_id, class_id FROM enrollments WHERE status != 'Rejected'");
        while ($row = $res3->fetch_assoc()) {
            $enrollments[$row['student_id']][] = (string)$row['class_id'];
        }

        json_response([
            "status"      => "success",
            "students"    => $students,
            "classes"     => $classes,
            "enrollments" => $enrollments
        ]);
        break;

    case 'enroll':
        mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

        $input      = json_decode(file_get_contents('php://input'), true);
        $student_id = (int)($input['student_id'] ?? 0);
        $class_ids  = $input['class_ids']         ?? [];

        if (!$student_id || empty($class_ids)) {
            json_response(["status" => "error", "message" => "Invalid data: student_id or class_ids missing."], 400);
        }

        $current_date = date('Y-m-d');

        try {
            $stmt = $conn->prepare(
                "INSERT INTO enrollments (student_id, class_id, enroll_date, status)
                 VALUES (?, ?, ?, 'Pending Finance')"
            );
            foreach ($class_ids as $cid) {
                $class_id = (int)$cid;
                $stmt->bind_param("iis", $student_id, $class_id, $current_date);
                $stmt->execute();
            }
            json_response([
                "status"  => "success",
                "message" => count($class_ids) . " enrollment(s) submitted — pending finance approval."
            ]);
        } catch (mysqli_sql_exception $e) {
            json_response(["status" => "error", "message" => "Database Error: " . $e->getMessage()], 500);
        }
        break;

    case 'approve':
    $input = json_decode(file_get_contents('php://input'), true);
    $eid   = (int)($input['enrollment_id'] ?? 0);

    if (!$eid) {
        json_response(["status" => "error", "message" => "Invalid enrollment ID."], 400);
    }

    // Get the student_id from the clicked enrollment
    $row = $conn->query("SELECT student_id FROM enrollments WHERE enrollment_id = $eid")->fetch_assoc();

    if (!$row) {
        json_response(["status" => "error", "message" => "Enrollment not found."], 404);
    }

    $student_id = (int)$row['student_id'];

    // Approve ALL pending enrollments for that student
    $stmt = $conn->prepare(
        "UPDATE enrollments 
         SET status = 'Approved', enroll_date = CURDATE()
         WHERE student_id = ? AND status = 'Pending Finance'"
    );
    $stmt->bind_param("i", $student_id);
    $stmt->execute();

    if ($stmt->affected_rows > 0) {
        json_response(["status" => "success", "message" => "All pending enrollments for this student have been approved."]);
    } else {
        json_response(["status" => "error", "message" => "No pending enrollments found for this student."], 404);
    }
    break;

    case 'reject':
        $input = json_decode(file_get_contents('php://input'), true);
        $eid   = (int)($input['enrollment_id'] ?? 0);

        if (!$eid) {
            json_response(["status" => "error", "message" => "Invalid enrollment ID."], 400);
        }

        $stmt = $conn->prepare(
            "UPDATE enrollments SET status = 'Rejected'
             WHERE enrollment_id = ? AND status = 'Pending Finance'"
        );
        $stmt->bind_param("i", $eid);
        $stmt->execute();

        if ($stmt->affected_rows > 0) {
            json_response(["status" => "success", "message" => "Enrollment rejected."]);
        } else {
            json_response(["status" => "error", "message" => "Enrollment not found or already processed."], 404);
        }
        break;

    case 'drop':
        $input = json_decode(file_get_contents('php://input'), true);
        $eid   = (int)($input['enrollment_id'] ?? 0);

        if (!$eid) {
            json_response(["status" => "error", "message" => "Invalid enrollment ID."], 400);
        }

        $stmt = $conn->prepare("
            SELECT e.*,
                   CONCAT(s.first_name,' ',s.last_name) AS student_name,
                   co.course_code, co.name AS course_name,
                   CONCAT(emp.first_name,' ',emp.last_name) AS instructor_name,
                   c.semester, c.year
            FROM enrollments e
            JOIN students s    ON e.student_id    = s.student_id
            JOIN classes c     ON e.class_id      = c.class_id
            JOIN courses co    ON c.course_id     = co.course_id
            JOIN employees emp ON c.instructor_id = emp.employee_id
            WHERE e.enrollment_id = ? LIMIT 1
        ");
        $stmt->bind_param("i", $eid);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();

        if ($row) {
            $conn->query("DELETE FROM archive_log WHERE record_type='enrollments' AND record_id=$eid");
            $json = json_encode($row, JSON_UNESCAPED_UNICODE);
            $by   = (int)$_SESSION['user_id'];
            $ins  = $conn->prepare(
                "INSERT INTO archive_log (record_type, record_id, record_data, archived_by)
                 VALUES ('enrollments', ?, ?, ?)"
            );
            $ins->bind_param("isi", $eid, $json, $by);
            $ins->execute();
            $conn->query("DELETE FROM enrollments WHERE enrollment_id = $eid");
            json_response(["status" => "success", "message" => "Student dropped and enrollment archived."]);
        } else {
            json_response(["status" => "error", "message" => "Enrollment record not found."], 404);
        }
        break;

    default:
        json_response(["status" => "error", "message" => "Invalid action."], 400);
        break;
}