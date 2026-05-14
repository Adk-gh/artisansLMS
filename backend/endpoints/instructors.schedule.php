<?php
// Path: backend/endpoints/instructors.schedule.php
error_reporting(0);
ini_set('display_errors', 0);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    require_once __DIR__ . '/../../server/config/db.php';

    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }

    if (!isset($_SESSION['user_id']) || !in_array(strtolower(trim($_SESSION['role'] ?? '')), ['teacher', 'admin'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Unauthorized. Please log in as a teacher.']);
        exit;
    }

    $user_id = (int)$_SESSION['user_id'];
    $semester = isset($_GET['semester']) ? trim($_GET['semester']) : '1st Semester';
    $school_year = isset($_GET['school_year']) ? trim($_GET['school_year']) : '2025-2026';

    $response = ['success' => false, 'data' => null, 'message' => ''];

    $conn = getConnection();
    $is_mysqli = ($conn instanceof mysqli);

    if ($is_mysqli) {
        // --- MYSQLi LOGIC ---
        $stmt = $conn->prepare("SELECT id, first_name, last_name, department, email, employee_id FROM instructors WHERE user_id = ? LIMIT 1");
        if (!$stmt) throw new Exception("Prepare failed: " . $conn->error);
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $instructor = $result->fetch_assoc();

        if (!$instructor) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'No instructor profile is linked to your account.']);
            exit();
        }

        $instructor_id = $instructor['id'];

        $sql = "
            SELECT
                s.id AS schedule_id, s.day_of_week,
                TIME_FORMAT(s.start_time, '%h:%i %p') AS start_time,
                TIME_FORMAT(s.end_time,   '%h:%i %p') AS end_time,
                s.start_time AS start_time_raw, s.end_time AS end_time_raw,
                s.section, r.room_name, r.building, r.floor, r.type AS room_type,
                sub.subject_code, sub.subject_name, sub.units
            FROM schedules s
            JOIN rooms r ON s.room_id = r.id
            JOIN subjects sub ON s.subject_id = sub.id
            WHERE s.instructor_id = ? AND s.semester = ? AND s.school_year = ?
            ORDER BY FIELD(s.day_of_week, 'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'), s.start_time ASC
        ";
        $stmt = $conn->prepare($sql);
        if (!$stmt) throw new Exception("Prepare failed: " . $conn->error);
        $stmt->bind_param("iss", $instructor_id, $semester, $school_year);
        $stmt->execute();
        $res = $stmt->get_result();
        $raw_schedules = $res->fetch_all(MYSQLI_ASSOC);

    } else {
        // --- PDO LOGIC ---
        $stmt = $conn->prepare("SELECT id, first_name, last_name, department, email, employee_id FROM instructors WHERE user_id = :uid LIMIT 1");
        $stmt->execute([':uid' => $user_id]);
        $instructor = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$instructor) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'No instructor profile is linked to your account.']);
            exit();
        }

        $instructor_id = $instructor['id'];

        $stmt = $conn->prepare("
            SELECT
                s.id AS schedule_id, s.day_of_week,
                TIME_FORMAT(s.start_time, '%h:%i %p') AS start_time,
                TIME_FORMAT(s.end_time,   '%h:%i %p') AS end_time,
                s.start_time AS start_time_raw, s.end_time AS end_time_raw,
                s.section, r.room_name, r.building, r.floor, r.type AS room_type,
                sub.subject_code, sub.subject_name, sub.units
            FROM schedules s
            JOIN rooms r ON s.room_id = r.id
            JOIN subjects sub ON s.subject_id = sub.id
            WHERE s.instructor_id = :instructor_id AND s.semester = :semester AND s.school_year = :school_year
            ORDER BY FIELD(s.day_of_week, 'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'), s.start_time ASC
        ");
        $stmt->execute([':instructor_id' => $instructor_id, ':semester' => $semester, ':school_year' => $school_year]);
        $raw_schedules = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    $days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    $schedule_by_day = array_fill_keys($days, []);

    $total_minutes = 0;
    foreach ($raw_schedules as $row) {
        $schedule_by_day[$row['day_of_week']][] = $row;
        $total_minutes += (strtotime($row['end_time_raw']) - strtotime($row['start_time_raw'])) / 60;
    }

    $response['success'] = true;
    $response['data'] = [
        'instructor' => [
            'name' => $instructor['first_name'] . ' ' . $instructor['last_name'],
            'department' => $instructor['department']
        ],
        'semester' => $semester,
        'school_year' => $school_year,
        'schedule_by_day' => $schedule_by_day,
        'stats' => [
            'total_sessions' => count($raw_schedules),
            'total_hours' => round($total_minutes / 60, 1),
            'unique_subjects' => count(array_unique(array_column($raw_schedules, 'subject_code'))),
            'unique_rooms' => count(array_unique(array_column($raw_schedules, 'room_name'))),
        ]
    ];

} catch (Throwable $e) { // Catch EVERYTHING (PDO, Mysqli, undefined variables, missing files)
    http_response_code(500);
    // Return error cleanly as JSON so UI doesn't crash
    echo json_encode([
        'success' => false,
        'message' => 'Server Error: ' . $e->getMessage() . ' (Line: ' . $e->getLine() . ')'
    ]);
    exit();
}

ob_clean();
echo json_encode($response, JSON_PRETTY_PRINT);
?>