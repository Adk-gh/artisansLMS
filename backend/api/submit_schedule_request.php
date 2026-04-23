<?php
/**
 * submit_schedule_request.php
 * C:\xampp\htdocs\artisansLMS\backend\api\submit_schedule_request.php
 *
 * Called by the teacher's browser (POST JSON).
 * Writes to room_requests, then forwards to the Scheduling System API
 * with an HMAC-SHA256 signature so webhook_room.php can verify it.
 *
 * POST body:
 *   { class_id, room_id (optional), requested_date, start_time, end_time, purpose }
 *   { action: 'cancel', request_id }
 *
 * GET ?action=get_rooms              → returns rooms table
 * GET ?action=get_my_requests&class_id=X  → teacher's own requests for that class
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);
header('Content-Type: application/json');

// ── Auth ───────────────────────────────────────────────────────────────────────
$provided_key   = $_GET['api_key'] ?? $_SERVER['HTTP_X_API_KEY'] ?? '';
$actual_secret  = getenv('LMS_SECRET_TOKEN') ?: 'local_scheduling_secret';
$is_api_request = ($provided_key === $actual_secret && !empty($provided_key));

if (session_status() === PHP_SESSION_NONE) session_start();

if (!isset($_SESSION['user_id']) && !$is_api_request) {
    echo json_encode(['status' => 'error', 'message' => 'Unauthorized']);
    exit;
}

$instructorId = $is_api_request ? 17 : (int)$_SESSION['user_id'];
$role         = $is_api_request ? 'teacher' : ($_SESSION['role'] ?? 'student');

if (!in_array($role, ['teacher', 'admin'])) {
    echo json_encode(['status' => 'error', 'message' => 'Forbidden']);
    exit;
}

// ── DB ─────────────────────────────────────────────────────────────────────────
require_once __DIR__ . '/../../server/config/db.php';
$conn = getConnection();

// ── Scheduling System config ───────────────────────────────────────────────────
define('SCHEDULING_API_URL', getenv('SCHEDULING_API_URL') ?: 'http://localhost/api/room_requests.php');
define('LMS_SECRET_TOKEN',   getenv('LMS_SECRET_TOKEN')   ?: 'local_scheduling_secret');

// ── Helper: sign + forward to Scheduling System ────────────────────────────────
/**
 * Builds the payload, signs it with HMAC-SHA256,
 * and POSTs it to the Scheduling System.
 * Returns ['forwarded' => bool, 'error' => string|null].
 */
function forwardToSchedulingSystem(array $payload): array {
    // Attach the HMAC signature so webhook_room.php can verify the callback
    $signature          = hash_hmac('sha256', json_encode($payload), LMS_SECRET_TOKEN);
    $payload['signature'] = $signature;

    $ch = curl_init(SCHEDULING_API_URL);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'X-API-Key: ' . LMS_SECRET_TOKEN,   // optional header auth as well
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 8,
    ]);
    $response = curl_exec($ch);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    return [
        'forwarded' => empty($curlErr),
        'error'     => $curlErr ?: null,
        'response'  => $response,
    ];
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ROUTING
// ═══════════════════════════════════════════════════════════════════════════════
$method = $_SERVER['REQUEST_METHOD'];

// ── GET ────────────────────────────────────────────────────────────────────────
if ($method === 'GET') {
    $action = $_GET['action'] ?? '';

    // GET rooms — for the room picker dropdown in the UI
    if ($action === 'get_rooms') {
        $res = $conn->query("SELECT room_id, name, location, capacity FROM rooms ORDER BY name");
        if (!$res) {
            echo json_encode(['status' => 'error', 'message' => 'DB Error (Rooms): ' . $conn->error]);
            exit;
        }
        $rooms = [];
        while ($r = $res->fetch_assoc()) $rooms[] = $r;
        echo json_encode(['status' => 'success', 'rooms' => $rooms]);
        exit;
    }

    // GET teacher's own requests for a class — from room_requests, not rooms
    if ($action === 'get_my_requests') {
        $classId = (int)($_GET['class_id'] ?? 0);
        if (!$classId) {
            echo json_encode(['status' => 'error', 'message' => 'class_id is required.']);
            exit;
        }

        $res = $conn->query("
            SELECT
                rr.request_id,
                rr.class_id,
                rr.instructor_id,
                rr.room_id,
                rr.requested_date,
                rr.start_time,
                rr.end_time,
                rr.purpose,
                rr.status,
                rr.admin_note,
                rr.created_at,
                r.name     AS room_name,
                r.location AS room_location,
                r.capacity AS room_capacity
            FROM room_requests rr
            LEFT JOIN rooms r ON r.room_id = rr.room_id
            WHERE rr.class_id      = $classId
              AND rr.instructor_id = $instructorId
            ORDER BY rr.created_at DESC
            LIMIT 20
        ");

        if (!$res) {
            echo json_encode(['status' => 'error', 'message' => 'DB Error (Requests): ' . $conn->error]);
            exit;
        }

        $rows = [];
        while ($r = $res->fetch_assoc()) $rows[] = $r;
        echo json_encode(['status' => 'success', 'requests' => $rows]);
        exit;
    }

    echo json_encode(['status' => 'error', 'message' => 'Unknown action.']);
    exit;
}

// ── POST ───────────────────────────────────────────────────────────────────────
if ($method === 'POST') {
    $raw    = file_get_contents('php://input');
    $body   = json_decode($raw, true) ?? [];
    $action = $body['action'] ?? 'submit';

    // ── Cancel own pending request ─────────────────────────────────────────
    if ($action === 'cancel') {
        $reqId = (int)($body['request_id'] ?? 0);
        if (!$reqId) {
            echo json_encode(['status' => 'error', 'message' => 'request_id is required.']);
            exit;
        }

        $conn->query("
            DELETE FROM room_requests
            WHERE request_id   = $reqId
              AND instructor_id = $instructorId
              AND status        = 'pending'
        ");

        if ($conn->affected_rows > 0) {
            echo json_encode(['status' => 'success', 'message' => 'Request cancelled.']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Cannot cancel — request not found or already processed.']);
        }
        exit;
    }

    // ── Submit new room request ────────────────────────────────────────────
    if ($action === 'submit') {
        $classId = (int)($body['class_id'] ?? 0);
        $roomId  = !empty($body['room_id']) ? (int)$body['room_id'] : null;
        $date    = $conn->real_escape_string($body['requested_date'] ?? '');
        $start   = $conn->real_escape_string($body['start_time']     ?? '');
        $end     = $conn->real_escape_string($body['end_time']       ?? '');
        $purpose = $conn->real_escape_string(substr($body['purpose'] ?? '', 0, 255));

        // Validation
        if (!$classId || !$date || !$start || !$end) {
            echo json_encode(['status' => 'error', 'message' => 'class_id, requested_date, start_time and end_time are required.']);
            exit;
        }
        if ($start >= $end) {
            echo json_encode(['status' => 'error', 'message' => 'end_time must be after start_time.']);
            exit;
        }

        // Verify instructor owns this class
        $owns = $conn->query("
            SELECT class_id FROM classes
            WHERE class_id = $classId AND instructor_id = $instructorId
            LIMIT 1
        ");
        if (!$owns || $owns->num_rows === 0) {
            echo json_encode(['status' => 'error', 'message' => 'You are not the instructor for this class.']);
            exit;
        }

        // Duplicate check — same class, same date+time, already pending
        $dup = $conn->query("
            SELECT request_id FROM room_requests
            WHERE class_id      = $classId
              AND instructor_id = $instructorId
              AND requested_date = '$date'
              AND start_time     = '$start'
              AND status         = 'pending'
            LIMIT 1
        ");
        if ($dup && $dup->num_rows > 0) {
            echo json_encode(['status' => 'error', 'message' => 'You already have a pending request for that date and time.']);
            exit;
        }

        // Insert into room_requests
        $roomVal = $roomId ? $roomId : 'NULL';
        $conn->query("
            INSERT INTO room_requests (class_id, instructor_id, room_id, requested_date, start_time, end_time, purpose)
            VALUES ($classId, $instructorId, $roomVal, '$date', '$start', '$end', '$purpose')
        ");

        if ($conn->affected_rows === 0) {
            echo json_encode(['status' => 'error', 'message' => 'Database insert failed: ' . $conn->error]);
            exit;
        }

        $requestId = $conn->insert_id;

        // Fetch the room details (if a room was selected) to include in the forward
        $roomDetails = null;
        if ($roomId) {
            $rRes = $conn->query("SELECT room_id, name, location, capacity FROM rooms WHERE room_id = $roomId LIMIT 1");
            if ($rRes && $rRes->num_rows > 0) {
                $roomDetails = $rRes->fetch_assoc();
            }
        }

        // Build the payload for the Scheduling System.
        // This is the data from room_requests (not the rooms table).
        $schedulingPayload = [
            'action'          => 'submit',
            'lms_request_id'  => $requestId,
            'lms_class_id'    => $classId,
            'instructor_id'   => $instructorId,
            'requested_date'  => $date,
            'start_time'      => $start,
            'end_time'        => $end,
            'purpose'         => $body['purpose'] ?? '',
            // Room info: either the selected room's details, or null (any room)
            'room_id'         => $roomId,
            'room'            => $roomDetails,   // full room object or null
            // Webhook callback so the Scheduling System knows where to POST the result
            'webhook_url'     => (isset($_SERVER['HTTPS']) ? 'https' : 'http')
                                 . '://' . $_SERVER['HTTP_HOST']
                                 . '/artisansLMS/backend/api/webhook_room.php',
        ];

        $forward = forwardToSchedulingSystem($schedulingPayload);

        // Even if forwarding fails, the record is saved locally — still a success
        $responseData = [
            'status'     => 'success',
            'message'    => "Room request submitted successfully. You'll be notified once the scheduling office reviews it.",
            'request_id' => $requestId,
            'forwarded'  => $forward['forwarded'],
        ];

        if (!$forward['forwarded']) {
            // Non-fatal: log it but don't fail the response
            $responseData['forward_error'] = $forward['error'];
        }

        echo json_encode($responseData);
        exit;
    }

    echo json_encode(['status' => 'error', 'message' => 'Unknown action.']);
    exit;
}

echo json_encode(['status' => 'error', 'message' => 'Method not allowed.']);