<?php
/**
 * LMS — get_faculty.php
 * Webhook receiver: accepts push from HRIS (sync_faculty / archive_faculty).
 *
 * FIX LOG
 * -------
 * 1. Signature verification now correctly unsets 'signature' from the decoded
 *    array before hashing — matches how HRIS signs (sign first, then attach).
 * 2. Gender now accepts both full strings ('Male','Female') and single chars
 *    ('M','F') so HRIS gender values are never silently defaulted.
 * 3. All raw-string queries replaced with prepared statements (SQL injection fix).
 * 4. INSERT for new faculty uses a prepared statement — NULL dept/pos handled safely.
 */

error_reporting(0);
ini_set('display_errors', 0);
header('Content-Type: application/json; charset=utf-8');

define('HRIS_WEBHOOK_SECRET', getenv('HRIS_WEBHOOK_SECRET') ?: 'local_hris_secret');

require_once __DIR__ . '/../../server/config/db.php';
require_once __DIR__ . '/../middleware/json_response.php';

$conn   = getConnection();
$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'POST') {
    http_response_code(405);
    json_response(['status' => 'error', 'message' => 'Method not allowed. Use POST.']);
}

// ── Parse body ────────────────────────────────────────────────────────────────
$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!$data) {
    json_response(['status' => 'error', 'message' => 'Invalid JSON payload.'], 400);
}

// ── Verify HMAC signature ─────────────────────────────────────────────────────
// ✅ FIX 1: extract signature, remove it from the array, THEN hash — must mirror
//    how HRIS builds the signature (sign payload without the key, then attach).
$received_sig = $data['signature'] ?? '';
$payload_to_verify = $data;
unset($payload_to_verify['signature']);

$expected_sig = hash_hmac(
    'sha256',
    json_encode($payload_to_verify, JSON_UNESCAPED_UNICODE),
    HRIS_WEBHOOK_SECRET
);

if (!hash_equals($expected_sig, $received_sig)) {
    json_response(['status' => 'error', 'message' => 'Invalid signature.'], 401);
}

// ── Helper: normalise gender ──────────────────────────────────────────────────
// ✅ FIX 2: accept 'Male'/'Female' from HRIS as well as 'M'/'F'
function normalise_gender(string $raw): string {
    switch (strtolower(trim($raw))) {
        case 'female': case 'f': return 'F';
        case 'male':   case 'm': return 'M';
        default:                 return 'Other';
    }
}

$action = $data['action'] ?? '';

// ════════════════════════════════════════════════════════════════════════════
// ACTION: archive_faculty
// ════════════════════════════════════════════════════════════════════════════
if ($action === 'archive_faculty') {
    $target_email = trim($data['email'] ?? '');
    if (!$target_email) {
        json_response(['status' => 'error', 'message' => 'No email provided for archiving.'], 400);
    }

    // ✅ FIX 3: prepared statement
    $stmt = $conn->prepare("UPDATE employees SET is_archived = 1 WHERE email = ?");
    $stmt->bind_param("s", $target_email);
    $stmt->execute();

    json_response(['status' => 'success', 'message' => 'Faculty archived successfully.']);
}

// ════════════════════════════════════════════════════════════════════════════
// ACTION: sync_faculty
// ════════════════════════════════════════════════════════════════════════════
if ($action === 'sync_faculty') {

    // ── 1. Upsert departments ─────────────────────────────────────────────
    if (!empty($data['departments'])) {
        $chk_dept  = $conn->prepare("SELECT department_id FROM departments WHERE name = ? LIMIT 1");
        $ins_dept  = $conn->prepare("INSERT INTO departments (name) VALUES (?)");

        foreach ($data['departments'] as $dept) {
            $name = trim($dept['name'] ?? '');
            if (!$name) continue;

            $chk_dept->bind_param("s", $name);
            $chk_dept->execute();
            if (!$chk_dept->get_result()->fetch_assoc()) {
                $ins_dept->bind_param("s", $name);
                $ins_dept->execute();
            }
        }
    }

    // ── 2. Upsert positions ───────────────────────────────────────────────
    if (!empty($data['positions'])) {
        $chk_pos = $conn->prepare("SELECT position_id FROM positions WHERE title = ? LIMIT 1");
        $ins_pos = $conn->prepare("INSERT INTO positions (title) VALUES (?)");

        foreach ($data['positions'] as $pos) {
            $title = trim($pos['title'] ?? '');
            if (!$title) continue;

            $chk_pos->bind_param("s", $title);
            $chk_pos->execute();
            if (!$chk_pos->get_result()->fetch_assoc()) {
                $ins_pos->bind_param("s", $title);
                $ins_pos->execute();
            }
        }
    }

    // ── 3. Process faculty list ───────────────────────────────────────────
    $faculty_list = $data['faculty'] ?? [];
    $created = $updated = $skipped = 0;

    // Prepared statements reused across the loop
    $find_dept   = $conn->prepare("SELECT department_id FROM departments WHERE name = ? LIMIT 1");
    $find_pos    = $conn->prepare("SELECT position_id   FROM positions   WHERE title = ? LIMIT 1");
    $find_emp    = $conn->prepare("SELECT employee_id   FROM employees   WHERE email = ? LIMIT 1");
    $upd_emp     = $conn->prepare("
        UPDATE employees
        SET first_name    = ?,
            last_name     = ?,
            gender        = ?,
            department_id = ?,
            position_id   = ?,
            is_faculty    = 1,
            is_archived   = 0
        WHERE employee_id = ?
    ");
    // ✅ FIX 4: INSERT uses prepared statement — NULL dept/pos handled safely
    $ins_emp = $conn->prepare("
        INSERT INTO employees
            (first_name, last_name, email, password_hash, is_faculty,
             gender, department_id, position_id, is_archived)
        VALUES (?, ?, ?, ?, 1, ?, ?, ?, 0)
    ");

    foreach ($faculty_list as $f) {
        $email      = trim($f['email']      ?? '');
        $first_name = trim($f['first_name'] ?? '');
        $last_name  = trim($f['last_name']  ?? '');
        $gender     = normalise_gender($f['gender'] ?? '');

        if (!$email || !$first_name || !$last_name) {
            $skipped++;
            continue;
        }

        // Resolve department
        $dept_id = null;
        if (!empty($f['department'])) {
            $dept_name = trim($f['department']);
            $find_dept->bind_param("s", $dept_name);
            $find_dept->execute();
            $dept_row = $find_dept->get_result()->fetch_assoc();
            $dept_id  = $dept_row ? (int)$dept_row['department_id'] : null;
        }

        // Resolve position
        $pos_id = null;
        if (!empty($f['position'])) {
            $pos_title = trim($f['position']);
            $find_pos->bind_param("s", $pos_title);
            $find_pos->execute();
            $pos_row = $find_pos->get_result()->fetch_assoc();
            $pos_id  = $pos_row ? (int)$pos_row['position_id'] : null;
        }

        // Check if employee already exists
        $find_emp->bind_param("s", $email);
        $find_emp->execute();
        $existing = $find_emp->get_result()->fetch_assoc();

        if ($existing) {
            // UPDATE existing employee
            $eid = (int)$existing['employee_id'];
            $upd_emp->bind_param("sssiii", $first_name, $last_name, $gender, $dept_id, $pos_id, $eid);
            $upd_emp->execute();
            $updated++;
        } else {
            // INSERT new employee with a temporary password
            $chars    = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
            $tmp_pass = 'FAC-';
            for ($i = 0; $i < 6; $i++) {
                $tmp_pass .= $chars[random_int(0, strlen($chars) - 1)];
            }
            $hashed = password_hash($tmp_pass, PASSWORD_DEFAULT);

            $ins_emp->bind_param("sssssii",
                $first_name, $last_name, $email,
                $hashed, $gender, $dept_id, $pos_id
            );

            if ($ins_emp->execute()) {
                $created++;
            } else {
                $skipped++;
            }
        }
    }

    json_response([
        'status'  => 'success',
        'created' => $created,
        'updated' => $updated,
        'skipped' => $skipped,
    ]);
}

// Unknown action
json_response(['status' => 'error', 'message' => 'Unknown action.'], 400);