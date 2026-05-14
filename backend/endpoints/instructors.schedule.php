<?php
// backend/endpoints/instructors.schedule.php
// Returns weekly schedule for a specific instructor

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../config/database.php'; // Adjust path to your DB config

/**
 * Expected DB schema assumptions:
 *
 * instructors (id, first_name, last_name, department, email, employee_id)
 * schedules   (id, instructor_id, room_id, subject_id, day_of_week, start_time, end_time, section, semester, school_year)
 * rooms       (id, room_name, building, floor, capacity, type)
 * subjects    (id, subject_code, subject_name, units)
 *
 * day_of_week: 'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'
 * start_time / end_time: TIME column (08:00:00 format)
 */

$response = [
    'success' => false,
    'data'    => null,
    'message' => ''
];

try {
    // --- Input validation ---
    if (!isset($_GET['instructor_id']) || !is_numeric($_GET['instructor_id'])) {
        http_response_code(400);
        $response['message'] = 'Invalid or missing instructor_id parameter.';
        echo json_encode($response);
        exit();
    }

    $instructor_id = (int) $_GET['instructor_id'];
    $semester      = isset($_GET['semester'])    ? trim($_GET['semester'])    : '1st Semester';
    $school_year   = isset($_GET['school_year']) ? trim($_GET['school_year']) : '2025-2026';

    // --- Fetch instructor info ---
    $stmt = $pdo->prepare("
        SELECT id, first_name, last_name, department, email, employee_id
        FROM instructors
        WHERE id = :id
        LIMIT 1
    ");
    $stmt->execute([':id' => $instructor_id]);
    $instructor = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$instructor) {
        http_response_code(404);
        $response['message'] = 'Instructor not found.';
        echo json_encode($response);
        exit();
    }

    // --- Fetch weekly schedule ---
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
            FIELD(s.day_of_week,
                'Monday','Tuesday','Wednesday','Thursday',
                'Friday','Saturday','Sunday'),
            s.start_time ASC
    ");
    $stmt->execute([
        ':instructor_id' => $instructor_id,
        ':semester'      => $semester,
        ':school_year'   => $school_year,
    ]);
    $raw_schedules = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // --- Organise by day ---
    $days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    $schedule_by_day = [];
    foreach ($days as $day) {
        $schedule_by_day[$day] = [];
    }
    foreach ($raw_schedules as $row) {
        $schedule_by_day[$row['day_of_week']][] = [
            'schedule_id'  => $row['schedule_id'],
            'start_time'   => $row['start_time'],
            'end_time'     => $row['end_time'],
            'start_raw'    => $row['start_time_raw'],
            'end_raw'      => $row['end_time_raw'],
            'section'      => $row['section'],
            'subject_code' => $row['subject_code'],
            'subject_name' => $row['subject_name'],
            'units'        => $row['units'],
            'room_name'    => $row['room_name'],
            'building'     => $row['building'],
            'floor'        => $row['floor'],
            'room_type'    => $row['room_type'],
        ];
    }

    // --- Summary stats ---
    $total_sessions = count($raw_schedules);
    $unique_subjects = array_unique(array_column($raw_schedules, 'subject_code'));
    $unique_rooms    = array_unique(array_column($raw_schedules, 'room_name'));

    // Total teaching hours
    $total_minutes = 0;
    foreach ($raw_schedules as $row) {
        $start = strtotime($row['start_time_raw']);
        $end   = strtotime($row['end_time_raw']);
        $total_minutes += ($end - $start) / 60;
    }
    $total_hours = round($total_minutes / 60, 1);

    $response['success'] = true;
    $response['data'] = [
        'instructor'     => [
            'id'          => $instructor['id'],
            'name'        => $instructor['first_name'] . ' ' . $instructor['last_name'],
            'department'  => $instructor['department'],
            'email'       => $instructor['email'],
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

echo json_encode($response, JSON_PRETTY_PRINT);
?>