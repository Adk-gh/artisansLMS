<?php
// webhook_tuition.php
// ─────────────────────────────────────────────────────────────────────────────
// Inbound Webhook Receiver — Finance system pushes events here to update
// enrollment statuses in the LMS without needing direct API polling.
//
// URL     : /artisansLMS/backend/api/webhook_tuition.php
// Method  : POST only
// Auth    : HMAC-SHA256 signature via X-Finance-Signature header
//           Signature = HMAC(secret, raw_request_body)
//
// Supported event types (sent in JSON body as "event"):
//   enrollment.approved        — Finance approved a single enrollment
//   enrollment.bulk_approved   — Finance approved all pending for a student
//   enrollment.rejected        — Finance rejected a single enrollment
//   enrollment.payment_failed  — Payment failed; revert approved → Pending Finance
//   ping                       — Health check / connectivity test
//
// Expected body shape (example):
//   {
//     "event": "enrollment.approved",
//     "data": { "enrollment_id": 12 }
//   }
//
// Response always JSON: { "status": "ok"|"error", "message": "..." }
// ─────────────────────────────────────────────────────────────────────────────

error_reporting(0);
ini_set('display_errors', 0);

require_once __DIR__ . '/../../server/config/db.php';
require_once __DIR__ . '/../middleware/json_response.php';

// ── Shared secret with your Finance system ────────────────────────────────────
// Must match the secret used by the Finance system to sign outbound requests.
define('WEBHOOK_SECRET', 'whsec_your_shared_secret_here');

// ── Logging ───────────────────────────────────────────────────────────────────
// Logs are written to a file outside the web root by default.
// Set to '' or false to disable logging.
define('WEBHOOK_LOG_FILE', __DIR__ . '/../../server/logs/webhook_tuition.log');

header('Content-Type: application/json; charset=utf-8');

// ── Only accept POST ──────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    webhook_log('REJECTED', 'Non-POST request: ' . $_SERVER['REQUEST_METHOD']);
    json_response(['status' => 'error', 'message' => 'Method not allowed.'], 405);
}

// ── Read raw body ─────────────────────────────────────────────────────────────
$raw_body = file_get_contents('php://input');

if (empty($raw_body)) {
    webhook_log('REJECTED', 'Empty request body');
    json_response(['status' => 'error', 'message' => 'Empty request body.'], 400);
}

// ── Verify HMAC signature ─────────────────────────────────────────────────────
$provided_sig = trim(
    $_SERVER['HTTP_X_FINANCE_SIGNATURE']
    ?? $_SERVER['HTTP_X_LMS_SIGNATURE']
    ?? ''
);

if (empty($provided_sig)) {
    webhook_log('REJECTED', 'Missing signature header');
    json_response(['status' => 'error', 'message' => 'Missing X-Finance-Signature header.'], 401);
}

$expected_sig = hash_hmac('sha256', $raw_body, WEBHOOK_SECRET);

if (!hash_equals($expected_sig, $provided_sig)) {
    webhook_log('REJECTED', 'Signature mismatch. Provided: ' . $provided_sig);
    json_response(['status' => 'error', 'message' => 'Invalid signature. Unauthorized.'], 401);
}

// ── Parse JSON body ───────────────────────────────────────────────────────────
$payload = json_decode($raw_body, true);

if (json_last_error() !== JSON_ERROR_NONE || !is_array($payload)) {
    webhook_log('REJECTED', 'Invalid JSON payload');
    json_response(['status' => 'error', 'message' => 'Invalid JSON payload.'], 400);
}

$event = trim($payload['event'] ?? '');
$data  = $payload['data']  ?? [];

webhook_log('RECEIVED', "event={$event} data=" . json_encode($data));

if (empty($event)) {
    json_response(['status' => 'error', 'message' => 'Missing event type in payload.'], 400);
}

$conn = getConnection();

// ─────────────────────────────────────────────────────────────────────────────
// Event handlers
// ─────────────────────────────────────────────────────────────────────────────

switch ($event) {

    // ── Finance approved a single enrollment ──────────────────────────────────
    case 'enrollment.approved':
        $eid = (int)($data['enrollment_id'] ?? 0);
        if (!$eid) {
            json_response(['status' => 'error', 'message' => 'Missing enrollment_id in data.'], 400);
        }

        $stmt = $conn->prepare(
            "UPDATE enrollments SET status = 'Approved', enroll_date = CURDATE()
             WHERE enrollment_id = ? AND status = 'Pending Finance'"
        );
        $stmt->bind_param("i", $eid);
        $stmt->execute();

        if ($stmt->affected_rows > 0) {
            webhook_log('PROCESSED', "enrollment.approved enrollment_id={$eid}");
            json_response(['status' => 'ok', 'message' => "Enrollment #{$eid} approved."]);
        } else {
            webhook_log('SKIPPED', "enrollment.approved enrollment_id={$eid} — not pending or not found");
            json_response(['status' => 'ok', 'message' => "Enrollment #{$eid} not updated (may already be approved or not found)."]);
        }
        break;

    // ── Finance approved ALL pending for a student ────────────────────────────
    case 'enrollment.bulk_approved':
        $student_id = (int)($data['student_id'] ?? 0);
        if (!$student_id) {
            json_response(['status' => 'error', 'message' => 'Missing student_id in data.'], 400);
        }

        $stmt = $conn->prepare(
            "UPDATE enrollments SET status = 'Approved', enroll_date = CURDATE()
             WHERE student_id = ? AND status = 'Pending Finance'"
        );
        $stmt->bind_param("i", $student_id);
        $stmt->execute();
        $count = $stmt->affected_rows;

        webhook_log('PROCESSED', "enrollment.bulk_approved student_id={$student_id} count={$count}");
        json_response([
            'status'  => 'ok',
            'message' => "{$count} enrollment(s) approved for student #{$student_id}."
        ]);
        break;

    // ── Finance rejected a single enrollment ──────────────────────────────────
    case 'enrollment.rejected':
        $eid = (int)($data['enrollment_id'] ?? 0);
        if (!$eid) {
            json_response(['status' => 'error', 'message' => 'Missing enrollment_id in data.'], 400);
        }

        $stmt = $conn->prepare(
            "UPDATE enrollments SET status = 'Rejected'
             WHERE enrollment_id = ? AND status = 'Pending Finance'"
        );
        $stmt->bind_param("i", $eid);
        $stmt->execute();

        if ($stmt->affected_rows > 0) {
            webhook_log('PROCESSED', "enrollment.rejected enrollment_id={$eid}");
            json_response(['status' => 'ok', 'message' => "Enrollment #{$eid} rejected."]);
        } else {
            webhook_log('SKIPPED', "enrollment.rejected enrollment_id={$eid} — not pending or not found");
            json_response(['status' => 'ok', 'message' => "Enrollment #{$eid} not updated (may not be pending or not found)."]);
        }
        break;

    // ── Payment failed — revert Approved back to Pending Finance ─────────────
    case 'enrollment.payment_failed':
        $eid = (int)($data['enrollment_id'] ?? 0);
        if (!$eid) {
            json_response(['status' => 'error', 'message' => 'Missing enrollment_id in data.'], 400);
        }

        $stmt = $conn->prepare(
            "UPDATE enrollments SET status = 'Pending Finance'
             WHERE enrollment_id = ? AND status = 'Approved'"
        );
        $stmt->bind_param("i", $eid);
        $stmt->execute();

        if ($stmt->affected_rows > 0) {
            webhook_log('PROCESSED', "enrollment.payment_failed enrollment_id={$eid} reverted to Pending Finance");
            json_response(['status' => 'ok', 'message' => "Enrollment #{$eid} reverted to Pending Finance due to payment failure."]);
        } else {
            webhook_log('SKIPPED', "enrollment.payment_failed enrollment_id={$eid} — not approved or not found");
            json_response(['status' => 'ok', 'message' => "Enrollment #{$eid} not reverted (may not be approved or not found)."]);
        }
        break;

    // ── Ping / health check ───────────────────────────────────────────────────
    case 'ping':
        webhook_log('PING', 'Health check received');
        json_response([
            'status'    => 'ok',
            'message'   => 'Webhook receiver is active.',
            'timestamp' => date('c'),
        ]);
        break;

    // ── Unknown event ─────────────────────────────────────────────────────────
    default:
        webhook_log('UNHANDLED', "Unknown event: {$event}");
        json_response([
            'status'  => 'ok',
            'message' => "Event '{$event}' received but not handled by this receiver.",
        ]);
        break;
}

// ─────────────────────────────────────────────────────────────────────────────
// Logging helper
// ─────────────────────────────────────────────────────────────────────────────
function webhook_log(string $level, string $message): void {
    if (!defined('WEBHOOK_LOG_FILE') || !WEBHOOK_LOG_FILE) return;

    $dir = dirname(WEBHOOK_LOG_FILE);
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }

    $line = sprintf(
        "[%s] [%s] %s\n",
        date('Y-m-d H:i:s'),
        strtoupper($level),
        $message
    );

    @file_put_contents(WEBHOOK_LOG_FILE, $line, FILE_APPEND | LOCK_EX);
}