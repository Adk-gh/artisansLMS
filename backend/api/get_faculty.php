<?php
/**
 * get_faculty.php
 * LMS Webhook Receiver (Push Only + Strict Master Data Sync)
 */

error_reporting(0);
ini_set('display_errors', 0);
header('Content-Type: application/json; charset=utf-8');

define('HRIS_WEBHOOK_SECRET', getenv('HRIS_WEBHOOK_SECRET') ?: 'local_hris_secret');

require_once __DIR__ . '/../../server/config/db.php';
require_once __DIR__ . '/../middleware/json_response.php';

$conn   = getConnection();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $raw  = file_get_contents('php://input');
    $data = json_decode($raw, true);

    if (!$data) json_response(['status' => 'error', 'message' => 'Invalid JSON payload.'], 400);

// ── Verify HMAC signature (Via Headers) ───────────────────────────────────────
$received_sig = $_SERVER['HTTP_X_HRIS_SIGNATURE'] ?? '';

// We hash the exact raw string ($raw) that arrived over the internet
$expected_sig = hash_hmac('sha256', $raw, HRIS_WEBHOOK_SECRET);

if (!hash_equals($expected_sig, $received_sig)) {
    // I added a debug helper here so if it fails, it tells you exactly why!
    json_response([
        'status' => 'error',
        'message' => 'Invalid signature.',
        'debug_received' => $received_sig,
        'debug_expected' => $expected_sig
    ], 401);
}

    $action = $data['action'] ?? '';

    // --- ARCHIVE FACULTY ---
    if ($action === 'archive_faculty') {
        $target_email = trim($data['email'] ?? '');
        if (!$target_email) json_response(['status' => 'error', 'message' => 'No email provided for archiving.'], 400);

        $safe_email = $conn->real_escape_string($target_email);
        $conn->query("UPDATE employees SET is_archived = 1 WHERE email = '$safe_email'");
        json_response(['status' => 'success', 'message' => 'Faculty archived successfully.']);
    }

    // --- SYNC FACULTY & MASTER DATA ---
    if ($action === 'sync_faculty') {

        // 1. SYNC DEPARTMENTS (Force exact ID match from HRIS)
        if (!empty($data['departments'])) {
            $stmt_dept = $conn->prepare("INSERT INTO departments (department_id, name, description) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description)");
            foreach ($data['departments'] as $dept) {
                if (empty($dept['name'])) continue;
                $d_id   = (int)$dept['hris_id'];
                $d_name = $dept['name'];
                $d_desc = $dept['description'] ?? '';
                $stmt_dept->bind_param("iss", $d_id, $d_name, $d_desc);
                $stmt_dept->execute();
            }
        }

        // 2. SYNC POSITIONS (Force exact ID match from HRIS)
        if (!empty($data['positions'])) {
            $stmt_pos = $conn->prepare("INSERT INTO positions (position_id, title, description) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description)");
            foreach ($data['positions'] as $pos) {
                if (empty($pos['title'])) continue;
                $p_id    = (int)$pos['hris_id'];
                $p_title = $pos['title'];
                $p_desc  = $pos['description'] ?? '';
                $stmt_pos->bind_param("iss", $p_id, $p_title, $p_desc);
                $stmt_pos->execute();
            }
        }

        // 3. PROCESS THE FACULTY MEMBER
        $faculty_list = $data['faculty'] ?? [];
        $created = $updated = $skipped = 0;

        foreach ($faculty_list as $f) {
            $email      = trim($f['email']      ?? '');
            $first_name = trim($f['first_name'] ?? '');
            $last_name  = trim($f['last_name']  ?? '');
            $gender     = in_array($f['gender'] ?? '', ['M','F','Other']) ? $f['gender'] : 'M';
            $dept_id    = (int)($f['department_id'] ?? 0);
            $pos_id     = (int)($f['position_id'] ?? 0);

            if (!$email || !$first_name || !$last_name || !$dept_id || !$pos_id) {
                $skipped++;
                continue;
            }

            $safe_email = $conn->real_escape_string($email);
            $existing   = $conn->query("SELECT employee_id FROM employees WHERE email='$safe_email' LIMIT 1")->fetch_assoc();

            if ($existing) {
                $eid = (int)$existing['employee_id'];
                $stmt = $conn->prepare("UPDATE employees SET first_name=?, last_name=?, gender=?, department_id=?, position_id=?, is_faculty=1, is_archived=0 WHERE employee_id=?");
                $stmt->bind_param("sssiii", $first_name, $last_name, $gender, $dept_id, $pos_id, $eid);
                $stmt->execute();
                $updated++;
            } else {
                $chars      = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
                $tmp_pass   = 'FAC-';
                for ($i = 0; $i < 6; $i++) $tmp_pass .= $chars[random_int(0, strlen($chars) - 1)];
                $safe_hash  = $conn->real_escape_string(password_hash($tmp_pass, PASSWORD_DEFAULT));

                $stmt = $conn->prepare("INSERT INTO employees (first_name, last_name, email, password_hash, is_faculty, gender, department_id, position_id, is_archived) VALUES (?, ?, ?, ?, 1, ?, ?, ?, 0)");
                $stmt->bind_param("sssssii", $first_name, $last_name, $email, $safe_hash, $gender, $dept_id, $pos_id);
                $stmt->execute();
                $stmt->affected_rows > 0 ? $created++ : $skipped++;
            }
        }
        json_response(['status' => 'success', 'created' => $created, 'updated' => $updated, 'skipped' => $skipped]);
    }
} else {
    http_response_code(405);
    json_response(['status' => 'error', 'message' => 'Method not allowed. Use POST.']);
}