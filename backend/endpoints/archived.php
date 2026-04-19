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
$action = $_GET['action'] ?? ($_POST['action'] ?? '');

// Ensure archive_log table exists
$conn->query("CREATE TABLE IF NOT EXISTS archive_log (
    archive_id   INT AUTO_INCREMENT PRIMARY KEY,
    record_type  VARCHAR(50)  NOT NULL,
    record_id    INT          NOT NULL,
    record_data  LONGTEXT     NOT NULL COMMENT 'JSON snapshot of the row',
    archived_by  INT          NOT NULL,
    archived_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_type (record_type),
    INDEX idx_record (record_type, record_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

function getArchivedRecords($conn, $type) {
    $res = $conn->query("SELECT a.*,
        COALESCE(
            CONCAT(e.first_name,' ',e.last_name),
            CONCAT(s.first_name,' ',s.last_name),
            CONCAT('User #', a.archived_by)
        ) AS archiver_name
        FROM archive_log a
        LEFT JOIN employees e ON a.archived_by = e.employee_id
        LEFT JOIN students  s ON a.archived_by = s.student_id
        WHERE a.record_type='$type'
        ORDER BY a.archived_at DESC");
    
    $rows = [];
    if ($res) {
        while ($r = $res->fetch_assoc()) {
            $r['data'] = json_decode($r['record_data'], true) ?? [];
            $rows[] = $r;
        }
    }
    return $rows;
}

switch ($action) {
    case 'get_data':
        $tab = $_GET['tab'] ?? 'classes';
        
        // Allowed mapping matches the actual table names
        $tab_to_table = [
            'classes'     => 'classes',
            'students'    => 'students',
            'courses'     => 'courses',
            'instructors' => 'employees', 
            'enrollments' => 'enrollments'
        ];

        $counts = [
            'classes'     => (int)$conn->query("SELECT COUNT(*) FROM archive_log WHERE record_type='classes'")->fetch_row()[0],
            'students'    => (int)$conn->query("SELECT COUNT(*) FROM archive_log WHERE record_type='students'")->fetch_row()[0],
            'courses'     => (int)$conn->query("SELECT COUNT(*) FROM archive_log WHERE record_type='courses'")->fetch_row()[0],
            'instructors' => (int)$conn->query("SELECT COUNT(*) FROM archive_log WHERE record_type='employees'")->fetch_row()[0],
            'enrollments' => (int)$conn->query("SELECT COUNT(*) FROM archive_log WHERE record_type='enrollments'")->fetch_row()[0],
        ];

        $db_type = $tab_to_table[$tab] ?? 'classes';
        $records = getArchivedRecords($conn, $db_type);

        json_response([
            "status" => "success", 
            "counts" => $counts,
            "records" => $records
        ]);
        break;

    case 'restore':
        $input = json_decode(file_get_contents('php://input'), true);
        $aid = (int)($input['archive_id'] ?? 0);
        
        if (!$aid) json_response(["status" => "error", "message" => "Invalid archive ID."], 400);

        $log = $conn->query("SELECT * FROM archive_log WHERE archive_id=$aid LIMIT 1")->fetch_assoc();
        if ($log) {
            $type = $log['record_type'];
            $data = json_decode($log['record_data'], true);
            $allowed = ['classes','students','courses','employees','enrollments'];

            if (in_array($type, $allowed) && $data) {
                $cols = implode('`, `', array_keys($data));
                $vals = implode("', '", array_map(fn($v) => $conn->real_escape_string((string)$v), array_values($data)));
                
                // Use IGNORE to skip if record_id already exists
                $conn->query("INSERT IGNORE INTO `$type` (`$cols`) VALUES ('$vals')");
                $conn->query("DELETE FROM archive_log WHERE archive_id=$aid");
                
                json_response(["status" => "success", "message" => "Item restored to the system."]);
            } else {
                json_response(["status" => "error", "message" => "Invalid record type or corrupted data."], 400);
            }
        } else {
            json_response(["status" => "error", "message" => "Archive record not found."], 404);
        }
        break;

    case 'purge':
        $input = json_decode(file_get_contents('php://input'), true);
        $aid = (int)($input['archive_id'] ?? 0);

        if (!$aid) json_response(["status" => "error", "message" => "Invalid archive ID."], 400);

        if ($conn->query("DELETE FROM archive_log WHERE archive_id=$aid")) {
            json_response(["status" => "success", "message" => "Item permanently deleted."]);
        } else {
            json_response(["status" => "error", "message" => "Failed to delete record."], 500);
        }
        break;

    case 'archive_item':
        // This handles the generic archive_item.php logic
        $input = json_decode(file_get_contents('php://input'), true);
        $table = $input['table'] ?? '';
        $id    = (int)($input['id'] ?? 0);

        $allowed = [
            'classes'     => 'class_id',
            'students'    => 'student_id',
            'courses'     => 'course_id',
            'employees'   => 'employee_id',
            'enrollments' => 'enrollment_id',
        ];

        if (!array_key_exists($table, $allowed) || !$id) {
            json_response(["status" => "error", "message" => "Invalid table or ID."], 400);
        }

        $col = $allowed[$table];
        $row = $conn->query("SELECT * FROM `$table` WHERE `$col` = $id LIMIT 1")->fetch_assoc();
        
        if (!$row) {
            json_response(["status" => "error", "message" => "Record not found."], 404);
        }

        $json = $conn->real_escape_string(json_encode($row, JSON_UNESCAPED_UNICODE));
        $archivedBy = (int)$_SESSION['user_id'];
        
        // Prevent duplicates
        $conn->query("DELETE FROM archive_log WHERE record_type='$table' AND record_id=$id");

        $conn->query("INSERT INTO archive_log (record_type, record_id, record_data, archived_by) VALUES ('$table', $id, '$json', $archivedBy)");

        // Cascade deletes
        if ($table === 'classes') {
            $conn->query("DELETE FROM submissions   WHERE assignment_id IN (SELECT assignment_id FROM assignments WHERE class_id=$id)");
            $conn->query("DELETE FROM assignments   WHERE class_id=$id");
            $conn->query("DELETE FROM quiz_attempts  WHERE quiz_id IN (SELECT quiz_id FROM quizzes WHERE class_id=$id)");
            $conn->query("DELETE FROM quiz_questions WHERE quiz_id IN (SELECT quiz_id FROM quizzes WHERE class_id=$id)");
            $conn->query("DELETE FROM quizzes        WHERE class_id=$id");
            $conn->query("DELETE FROM enrollments    WHERE class_id=$id");
        }
        
        $conn->query("DELETE FROM `$table` WHERE `$col` = $id");

        json_response(["status" => "success", "message" => "Record archived successfully."]);
        break;

    default:
        json_response(["status" => "error", "message" => "Invalid action."], 400);
        break;
}