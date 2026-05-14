<?php
// CRITICAL: Shield JSON from HTML errors
error_reporting(0);
ini_set('display_errors', 0);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../config/db.php'; // Adjust to your actual DB config path

// 1. Initialize Session
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// 2. Security Check (Exactly like your Task Manager)
if (!isset($_SESSION['user_id']) || !in_array(strtolower(trim($_SESSION['role'] ?? '')), ['teacher', 'admin'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized. Please log in as a teacher.']);
    exit;
}

$user_id = (int)$_SESSION['user_id'];
$semester = isset($_GET['semester']) ? trim($_GET['semester']) : '1st Semester';
$school_year = isset($_GET['school_year']) ? trim($_GET['school_year']) : '2025-2026';

$response = [
    'success' => false,
    'data'    => null,
    'message' => ''
];

try {
    // We need PDO to run the queries. Assuming your db.php gives a $pdo or a function getConnection()
    // If you use getConnection(), do: $pdo = getConnection();
    $pdo = getConnection();

    // 3. Map the User ID to the Instructor Profile
    // NOTE: Change 'user_id = :uid' to 'id = :uid' if your instructors table doesn't have a separate user_id column.
    $stmt = $pdo->prepare("
        SELECT id, first_name, last_name, department, email, employee_id
        FROM instructors
        WHERE user_id = :uid
        LIMIT 1
    ");
    $stmt->execute([':uid' => $user_id]);
    $instructor = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$instructor) {
        http_response_code(404);
        $response['message'] = 'No instructor profile is linked to your account. Please contact admin.';
        echo json_encode($response);
        exit();
    }

    $instructor_id = $instructor['id'];

    // 4. Fetch weekly schedule using the resolved instructor_id
    $stmt = $pdo->prepare("
        SELECT
            s.id            AS schedule_id,
            s.day_of_week,
            TIME_FORMAT(s.start_time, '%h:%i %p') AS start_time,
            TIME_FORMAT(s.end_time,   '%h:%i %p') AS end_time,
            s.start_time    AS start_time_raw,
            s.end_time      AS end_time_raw,
            s.section,
            r.room_name,
            r.building,
            r.floor,
            r.type          AS room_type,
            sub.subject_code,
            sub.subject_name,
            sub.units
        FROM schedules s
        JOIN rooms    r  ON s.room_id    = r.id
        JOIN subjects sub ON s.subject_id = sub.id
        WHERE s.instructor_id = :instructor_id
          AND s.semester       = :semester
          AND s.school_year    = :school_year
        ORDER BY
            FIELD(s.day_of_week, 'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'),
            s.start_time ASC
    ");
    $stmt->execute([
        ':instructor_id' => $instructor_id,
        ':semester'      => $semester,
        ':school_year'   => $school_year,
    ]);
    $raw_schedules = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 5. Organize by day
    $days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    $schedule_by_day = [];
    foreach ($days as $day) {
        $schedule_by_day[$day] = [];
    }
    foreach ($raw_schedules as $row) {
        $schedule_by_day[$row['day_of_week']][] = $row;
    }

    // 6. Summary stats
    $total_sessions = count($raw_schedules);
    $unique_subjects = array_unique(array_column($raw_schedules, 'subject_code'));
    $unique_rooms    = array_unique(array_column($raw_schedules, 'room_name'));

    $total_minutes = 0;
    foreach ($raw_schedules as $row) {
        $start = strtotime($row['start_time_raw']);
        $end   = strtotime($row['end_time_raw']);
        $total_minutes += ($end - $start) / 60;
    }
    $total_hours = round($total_minutes / 60, 1);

    // 7. Output Response
    $response['success'] = true;
    $response['data'] = [
        'instructor' => [
            'name'        => $instructor['first_name'] . ' ' . $instructor['last_name'],
            'department'  => $instructor['department'],
            'employee_id' => $instructor['employee_id'],
        ],
        'semester'        => $semester,
        'school_year'     => $school_year,
        'schedule_by_day' => $schedule_by_day,
        'stats' => [
            'total_sessions'  => $total_sessions,
            'total_hours'     => $total_hours,
            'unique_subjects' => count($unique_subjects),
            'unique_rooms'    => count($unique_rooms),
        ]
    ];

} catch (PDOException $e) {
    http_response_code(500);
    $response['message'] = 'Database error: ' . $e->getMessage();
}

ob_clean();
echo json_encode($response, JSON_PRETTY_PRINT);
?>