<?php
/**
 * submit_schedule_request.php
 * C:\xampp\htdocs\artisansLMS\backend\api\submit_schedule_request.php
 *
 * Called by the teacher's browser (POST JSON).
 * Writes to room_requests, then forwards to the Scheduling System API.
 *
 * POST body:
 *   { class_id, room_id (optional), requested_date, start_time, end_time, purpose }
 *
 * GET ?action=get_rooms         → returns rooms table
 * GET ?action=get_my_requests&class_id=X  → teacher's own requests for that class
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);
header('Content-Type: application/json');

// ── Session & auth ────────────────────────────────────────────────────────────
if (session_status() === PHP_SESSION_NONE) session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['status' => 'error', 'message' => 'Unauthorized']);
    exit;
}

$instructorId = (int)$_SESSION['user_id'];
$role         = $_SESSION['role'] ?? 'student';

if (!in_array($role, ['teacher', 'admin'])) {
    echo json_encode(['status' => 'error', 'message' => 'Forbidden']);
    exit;
}

// ── DB ────────────────────────────────────────────────────────────────────────
require_once __DIR__ . '/../../server/config/db.php'; // adjust path if needed
$conn = getConnection();                       // returns mysqli

// ── Scheduling System config ──────────────────────────────────────────────────
define('SCHEDULING_API_URL', 'http://your-scheduling-system.local/api/room_requests.php');
define('LMS_SECRET_TOKEN',   '7f6c002275c76ced4aed037c73d5f24616ae395725043cba3606d559c23632a3');   // must match Scheduling System

// ─────────────────────────────────────────────────────────────────────────────
//  ROUTING
// ─────────────────────────────────────────────────────────────────────────────
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $action = $_GET['action'] ?? '';

// ── GET rooms (read directly from shared DB) ──────────────────────────────
    if ($action === 'get_rooms') {
        $res = $conn->query("SELECT room_id, name, location, capacity FROM rooms ORDER BY name");
        
        // ADD THIS SAFETY CHECK
        if (!$res) {
            echo json_encode(['status' => 'error', 'message' => 'DB Error (Rooms): ' . $conn->error]);
            exit;
        }

        $rooms = [];
        while ($r = $res->fetch_assoc()) $rooms[] = $r;
        echo json_encode(['status' => 'success', 'rooms' => $rooms]);
        exit;
    }

    // ── GET my requests for a class ───────────────────────────────────────────
    if ($action === 'get_my_requests') {
        $classId = (int)($_GET['class_id'] ?? 0);
        $res = $conn->query("
            SELECT rr.request_id, rr.requested_date, rr.start_time, rr.end_time,
                   rr.purpose, rr.status, rr.admin_note, rr.created_at,
                   r.name AS room_name, r.location
            FROM room_requests rr
            LEFT JOIN rooms r ON r.room_id = rr.room_id
            WHERE rr.class_id = $classId
              AND rr.instructor_id = $instructorId
            ORDER BY rr.created_at DESC
            LIMIT 20
        ");

        // ADD THIS SAFETY CHECK
        if (!$res) {
            echo json_encode(['status' => 'error', 'message' => 'DB Error (Requests): ' . $conn->error]);
            exit;
        }

        $rows = [];
        while ($r = $res->fetch_assoc()) $rows[] = $r;
        echo json_encode(['status' => 'success', 'requests' => $rows]);
        exit;
    }
}
// ── POST: submit a new request ────────────────────────────────────────────────
if ($method === 'POST') {
    $raw  = file_get_contents('php://input');
    $body = json_decode($raw, true) ?? [];

    $action = $body['action'] ?? 'submit';   // default action is submit

    // Cancel own pending request
    if ($action === 'cancel') {
        $reqId = (int)($body['request_id'] ?? 0);
        $conn->query("
            DELETE FROM room_requests
            WHERE request_id = $reqId
              AND instructor_id = $instructorId
              AND status = 'pending'
        ");
        if ($conn->affected_rows > 0) {
            echo json_encode(['status' => 'success', 'message' => 'Request cancelled.']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Cannot cancel — already processed.']);
        }
        exit;
    }

    // Submit
    $classId   = (int)($body['class_id']       ?? 0);
    $roomId    = !empty($body['room_id']) ? (int)$body['room_id'] : null;
    $date      = $conn->real_escape_string($body['requested_date'] ?? '');
    $start     = $conn->real_escape_string($body['start_time']     ?? '');
    $end       = $conn->real_escape_string($body['end_time']       ?? '');
    $purpose   = $conn->real_escape_string(substr($body['purpose'] ?? '', 0, 255));

    // Basic validation
    if (!$classId || !$date || !$start || !$end) {
        echo json_encode(['status' => 'error', 'message' => 'class_id, date, start_time and end_time are required.']);
        exit;
    }
    if ($start >= $end) {
        echo json_encode(['status' => 'error', 'message' => 'End time must be after start time.']);
        exit;
    }

    // Verify the teacher actually owns this class
    $owns = $conn->query("
        SELECT class_id FROM classes
        WHERE class_id = $classId AND instructor_id = $instructorId
        LIMIT 1
    ");
    if (!$owns || $owns->num_rows === 0) {
        echo json_encode(['status' => 'error', 'message' => 'You are not the instructor for this class.']);
        exit;
    }

    // Duplicate check — same class, same date+time already pending
    $dup = $conn->query("
        SELECT request_id FROM room_requests
        WHERE class_id = $classId
          AND instructor_id = $instructorId
          AND requested_date = '$date'
          AND start_time = '$start'
          AND status = 'pending'
        LIMIT 1
    ");
    if ($dup && $dup->num_rows > 0) {
        echo json_encode(['status' => 'error', 'message' => 'You already have a pending request for that date and time.']);
        exit;
    }

    // Insert into local room_requests
    $roomVal = $roomId ? $roomId : 'NULL';
    $conn->query("
        INSERT INTO room_requests (class_id, instructor_id, room_id, requested_date, start_time, end_time, purpose)
        VALUES ($classId, $instructorId, $roomVal, '$date', '$start', '$end', '$purpose')
    ");

    if ($conn->affected_rows === 0) {
        echo json_encode(['status' => 'error', 'message' => 'Database error: ' . $conn->error]);
        exit;
    }

    $requestId = $conn->insert_id;

    // Forward to Scheduling System API
    $schedulingPayload = json_encode([
        'lms_token'      => LMS_SECRET_TOKEN,
        'action'         => 'submit',
        'lms_request_id' => $requestId,          // so Scheduling System can reference back
        'lms_class_id'   => $classId,
        'instructor_id'  => $instructorId,
        'room_id'        => $roomId,
        'requested_date' => $date,
        'start_time'     => $start,
        'end_time'       => $end,
        'purpose'        => $body['purpose'] ?? '',
    ]);

    $ch = curl_init(SCHEDULING_API_URL);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $schedulingPayload,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 8,
    ]);
    $schedulingResponse = curl_exec($ch);
    $curlErr            = curl_error($ch);
    curl_close($ch);

    // Even if the Scheduling System is unreachable, we've saved locally — still success
    echo json_encode([
        'status'     => 'success',
        'message'    => 'Room request submitted. You\'ll be notified once the scheduling office reviews it.',
        'request_id' => $requestId,
        'forwarded'  => !$curlErr,
    ]);
    exit;
}

echo json_encode(['status' => 'error', 'message' => 'Method not allowed']);