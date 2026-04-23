<?php
/**
 * webhook_room.php
 * C:\xampp\htdocs\artisansLMS\backend\api\webhook_room.php
 *
 * The Scheduling System POSTs here when a room request is approved or rejected.
 *
 * Expected POST body (JSON):
 * {
 *   "lms_request_id": 2,
 *   "lms_class_id":   10,
 *   "status":         "approved" | "rejected",
 *   "admin_note":     "See you there",
 *   "room": {                          ← only on approval
 *     "room_id":  2,
 *     "name":     "Lecture Hall 1",
 *     "location": "Main Building 2nd Floor",
 *     "capacity": 150
 *   },
 *   "confirmed_date":  "2026-04-24",   ← only on approval
 *   "confirmed_start": "12:57:00",     ← only on approval
 *   "confirmed_end":   "13:57:00",     ← only on approval
 *   "signature": "<hmac-sha256>"       ← always
 * }
 *
 * Flow:
 *  1. Verify HMAC signature
 *  2. Update room_requests.status (and optionally insert into schedule)
 *  3. Push a Firebase Realtime Database system message into the class chat
 */

error_reporting(0);
ini_set('display_errors', 0);
header('Content-Type: application/json');

// ── Config ─────────────────────────────────────────────────────────────────────
define('SCHEDULING_SECRET', getenv('LMS_SECRET_TOKEN')   ?: 'local_scheduling_secret');
define('FIREBASE_DB_URL',   getenv('FIREBASE_DB_URL')    ?: 'https://artisans-lms-default-rtdb.firebaseio.com');
define('FIREBASE_API_KEY',  getenv('FIREBASE_API_KEY')   ?: '');

// ── DB ─────────────────────────────────────────────────────────────────────────
require_once __DIR__ . '/../config/db.php';
$conn = getConnection();

// ── Read + decode payload ──────────────────────────────────────────────────────
$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!$data || !is_array($data)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid or empty JSON payload.']);
    exit;
}

// ── Verify HMAC-SHA256 signature ───────────────────────────────────────────────
// submit_schedule_request.php signs the payload (without the signature field)
// before forwarding to the Scheduling System.  The Scheduling System must
// preserve the same signing approach when it calls back here.
$receivedSig = $data['signature'] ?? '';
$checkData   = $data;
unset($checkData['signature']);

// IMPORTANT: json_encode key order must match what was signed.
// The Scheduling System should sign the payload with the SAME key order.
$expectedSig = hash_hmac('sha256', json_encode($checkData), SCHEDULING_SECRET);

if (!hash_equals($expectedSig, $receivedSig)) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Signature verification failed.']);
    exit;
}

// ── Extract + sanitise fields ──────────────────────────────────────────────────
$lmsRequestId = (int)($data['lms_request_id'] ?? 0);
$classId      = (int)($data['lms_class_id']   ?? 0);
$status       = $data['status']     ?? '';      // 'approved' | 'rejected'
$adminNote    = $conn->real_escape_string($data['admin_note'] ?? '');
$room         = $data['room']       ?? null;    // null on rejection
$confDate     = $data['confirmed_date']  ?? '';
$confStart    = $data['confirmed_start'] ?? '';
$confEnd      = $data['confirmed_end']   ?? '';

if (!in_array($status, ['approved', 'rejected'], true) || !$lmsRequestId || !$classId) {
    http_response_code(422);
    echo json_encode(['status' => 'error', 'message' => 'Missing required fields (lms_request_id, lms_class_id, status).']);
    exit;
}

// ── 1. Update room_requests status ────────────────────────────────────────────
$safeStatus = $conn->real_escape_string($status);
$updated = $conn->query("
    UPDATE room_requests
    SET    status     = '$safeStatus',
           admin_note = '$adminNote'
    WHERE  request_id = $lmsRequestId
");

if (!$updated || $conn->affected_rows === 0) {
    // Request not found — still respond 200 so the Scheduling System doesn't retry forever
    echo json_encode(['status' => 'warning', 'message' => "Request ID $lmsRequestId not found in room_requests."]);
    exit;
}

// ── 2. On approval: insert confirmed slot into schedule ───────────────────────
if ($status === 'approved' && $room && $confDate && $confStart && $confEnd) {
    $roomId    = (int)($room['room_id'] ?? 0);
    $safeDate  = $conn->real_escape_string($confDate);
    $safeStart = $conn->real_escape_string($confStart);
    $safeEnd   = $conn->real_escape_string($confEnd);

    if ($roomId) {
        $conn->query("
            INSERT INTO schedule (class_id, room_id, start_time, end_time)
            VALUES ($classId, $roomId, '$safeDate $safeStart', '$safeDate $safeEnd')
        ");
    }
}

// ── 3. Build Firebase message ─────────────────────────────────────────────────
if ($status === 'approved' && $room) {
    $roomName = $room['name']     ?? 'TBA';
    $location = $room['location'] ?? '';
    $capacity = $room['capacity'] ?? '';

    // Human-readable date/time strings
    $dateStr  = $confDate  ? date('F j, Y', strtotime($confDate))  : 'TBA';
    $startStr = $confStart ? date('g:i A',  strtotime($confStart)) : 'TBA';
    $endStr   = $confEnd   ? date('g:i A',  strtotime($confEnd))   : 'TBA';

    $firebaseMsg = [
        'is_system'  => true,
        'type'       => 'room_approved',
        'timestamp'  => (int)(microtime(true) * 1000),
        'text'       => '✅ Room Request Approved',
        'room'       => [
            'name'     => $roomName,
            'location' => $location,
            'capacity' => (string)$capacity,
        ],
        'schedule'   => [
            'date'  => $dateStr,
            'start' => $startStr,
            'end'   => $endStr,
        ],
        'admin_note' => $data['admin_note'] ?? '',
    ];
} else {
    $noteText   = trim($data['admin_note'] ?? '');
    $firebaseMsg = [
        'is_system'  => true,
        'type'       => 'room_rejected',
        'timestamp'  => (int)(microtime(true) * 1000),
        'text'       => '❌ Room Request Declined' . ($noteText ? ': ' . $noteText : '.'),
        'admin_note' => $noteText,
    ];
}

// ── 4. POST message to Firebase Realtime Database ────────────────────────────
// Using the REST API push endpoint (.json with POST = auto-generated key)
$firebaseUrl = rtrim(FIREBASE_DB_URL, '/') . "/lms_chats/{$classId}.json";
if (!empty(FIREBASE_API_KEY)) {
    $firebaseUrl .= '?key=' . FIREBASE_API_KEY;
}

$ch = curl_init($firebaseUrl);
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode($firebaseMsg),
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 8,
]);
$fbResponse = curl_exec($ch);
$fbError    = curl_error($ch);
curl_close($ch);

// ── Respond to Scheduling System ──────────────────────────────────────────────
echo json_encode([
    'status'           => 'success',
    'message'          => 'Webhook processed.',
    'request_id'       => $lmsRequestId,
    'new_status'       => $status,
    'firebase_pushed'  => empty($fbError),
    'firebase_error'   => $fbError ?: null,
]);