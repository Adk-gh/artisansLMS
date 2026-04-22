<?php
/**
 * webhook_room.php
 * C:\xampp\htdocs\artisansLMS\backend\api\webhook_room.php
 *
 * The Scheduling System POSTs here when a room request is approved or rejected.
 * We update room_requests.status, then push a Firebase system message into the
 * class chat so the teacher sees the result instantly.
 */

error_reporting(0);
ini_set('display_errors', 0);
header('Content-Type: application/json');

define('WEBHOOK_SECRET',   '7f6c002275c76ced4aed037c73d5f24616ae395725043cba3606d559c23632a3');
define('FIREBASE_DB_URL',  'https://artisans-lms-default-rtdb.firebaseio.com');
define('FIREBASE_API_KEY', 'AIzaSyDQfwNYptf-gWqIQVs0welvz86DwqPI6VQ');

require_once __DIR__ . '/../config/db.php';
$conn = getConnection();

// ── Read payload ──────────────────────────────────────────────────────────────
$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid JSON']);
    exit;
}

// ── Verify HMAC signature ─────────────────────────────────────────────────────
$receivedSig = $data['signature'] ?? '';
$check       = $data;
unset($check['signature']);
$expectedSig = hash_hmac('sha256', json_encode($check), WEBHOOK_SECRET);

if (!hash_equals($expectedSig, $receivedSig)) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Bad signature']);
    exit;
}

// ── Extract fields ────────────────────────────────────────────────────────────
$lmsRequestId = (int)($data['lms_request_id'] ?? 0);
$classId      = (int)($data['lms_class_id']   ?? 0);
$status       = $data['status']     ?? '';       // 'approved' or 'rejected'
$adminNote    = $conn->real_escape_string($data['admin_note'] ?? '');
$room         = $data['room']       ?? null;     // null on rejection
$confDate     = $data['confirmed_date']  ?? '';
$confStart    = $data['confirmed_start'] ?? '';
$confEnd      = $data['confirmed_end']   ?? '';

if (!in_array($status, ['approved', 'rejected']) || !$lmsRequestId || !$classId) {
    http_response_code(422);
    echo json_encode(['status' => 'error', 'message' => 'Missing required fields']);
    exit;
}

// ── Update room_requests status ───────────────────────────────────────────────
$safeStatus = $conn->real_escape_string($status);
$conn->query("
    UPDATE room_requests
    SET status = '$safeStatus', admin_note = '$adminNote'
    WHERE request_id = $lmsRequestId
");

// ── On approval: insert into schedule ────────────────────────────────────────
if ($status === 'approved' && $room && $confDate && $confStart && $confEnd) {
    $roomId    = (int)$room['room_id'];
    $safeDate  = $conn->real_escape_string($confDate);
    $safeStart = $conn->real_escape_string($confStart);
    $safeEnd   = $conn->real_escape_string($confEnd);

    // Fetch class_id from room_requests in case it wasn't in payload
    $req = $conn->query("SELECT class_id FROM room_requests WHERE request_id = $lmsRequestId")->fetch_assoc();
    $classId = $req ? (int)$req['class_id'] : $classId;

    $conn->query("
        INSERT INTO schedule (class_id, room_id, start_time, end_time)
        VALUES ($classId, $roomId, '$safeDate $safeStart', '$safeDate $safeEnd')
    ");
}

// ── Push Firebase system message into class chat ──────────────────────────────
if ($status === 'approved' && $room) {
    $roomName  = $room['name']     ?? 'TBA';
    $location  = $room['location'] ?? '';
    $capacity  = $room['capacity'] ?? '';
    $dateStr   = date('F j, Y', strtotime($confDate));
    $startStr  = date('g:i A',  strtotime($confStart));
    $endStr    = date('g:i A',  strtotime($confEnd));

    $firebaseMsg = [
        'is_system'  => true,
        'type'       => 'room_approved',
        'timestamp'  => time() * 1000,
        'text'       => "✅ Room Approved",
        'room'       => [
            'name'     => $roomName,
            'location' => $location,
            'capacity' => $capacity,
        ],
        'schedule'   => [
            'date'  => $dateStr,
            'start' => $startStr,
            'end'   => $endStr,
        ],
        'admin_note' => $data['admin_note'] ?? '',
    ];
} else {
    $firebaseMsg = [
        'is_system'  => true,
        'type'       => 'room_rejected',
        'timestamp'  => time() * 1000,
        'text'       => '❌ Room Request Declined' . ($data['admin_note'] ? ': ' . $data['admin_note'] : '.'),
    ];
}

// POST to Firebase REST API
$url = FIREBASE_DB_URL . "/lms_chats/{$classId}.json?key=" . FIREBASE_API_KEY;
$ch  = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode($firebaseMsg),
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 8,
]);
curl_exec($ch);
curl_close($ch);

echo json_encode(['status' => 'success', 'message' => 'Webhook processed.']);