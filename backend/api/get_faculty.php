<?php
/**
 * get_faculty.php
 * LMS Webhook Receiver (Push Only + Master Data Sync + Archiving)
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

    // Verify Signature
    $received_sig = $data['signature'] ?? '';
    $payload      = $data;
    unset($payload['signature']);
    $expected_sig = hash_hmac('sha256', json_encode($payload, JSON_UNESCAPED_UNICODE), HRIS_WEBHOOK_SECRET);

    if (!hash_equals($expected_sig, $received_sig)) {
        json_response(['status' => 'error', 'message' => 'Invalid signature.'], 401);
    }

    $action = $data['action'] ?? '';

    // ════════════════════════════════════════════════════════════════════════
    // --- NEW: ARCHIVE FACULTY (Triggered by HRIS delete.php) ---
    // ════════════════════════════════════════════════════════════════════════
    if ($action === 'archive_faculty') {
        $target_email = trim($data['email'] ?? '');
        if (!$target_email) json_response(['status' => 'error', 'message' => 'No email provided for archiving.'], 400);

        $safe_email = $conn->real_escape_string($target_email);
        
        // Soft delete the faculty member by setting is_archived = 1
        $conn->query("UPDATE employees SET is_archived = 1 WHERE email = '$safe_email'");
        
        json_response(['status' => 'success', 'message' => 'Faculty archived successfully.']);
    }

    // ════════════════════════════════════════════════════════════════════════
    // --- SYNC FACULTY & MASTER DATA (Triggered by HRIS add.php / edit.php) ---
    // ════════════════════════════════════════════════════════════════════════
    if ($action === 'sync_faculty') {
        
        // --- 1. SYNC MASTER DATA: DEPARTMENTS ---
        if (!empty($data['departments'])) {
            foreach ($data['departments'] as $dept) {
                if (empty($dept['name'])) continue;
                $d_name = $conn->real_escape_string(trim($dept['name']));
                $exists = $conn->query("SELECT department_id FROM departments WHERE name='$d_name' LIMIT 1")->fetch_assoc();
                if (!$exists) {
                    $conn->query("INSERT INTO departments (name) VALUES ('$d_name')");
                }
            }
        }

        // --- 2. SYNC MASTER DATA: POSITIONS ---
        if (!empty($data['positions'])) {
            foreach ($data['positions'] as $pos) {
                if (empty($pos['title'])) continue;
                $p_title = $conn->real_escape_string(trim($pos['title']));
                $exists = $conn->query("SELECT position_id FROM positions WHERE title='$p_title' LIMIT 1")->fetch_assoc();
                if (!$exists) {
                    $conn->query("INSERT INTO positions (title) VALUES ('$p_title')");
                }
            }
        }

        // --- 3. PROCESS THE FACULTY MEMBER ---
        $faculty_list = $data['faculty'] ?? [];
        $created = $updated = $skipped = 0;

        foreach ($faculty_list as $f) {
            $email      = trim($f['email']      ?? '');
            $first_name = trim($f['first_name'] ?? '');
            $last_name  = trim($f['last_name']  ?? '');
            $gender     = in_array($f['gender'] ?? '', ['M','F','Other']) ? $f['gender'] : 'M';

            if (!$email || !$first_name || !$last_name) { $skipped++; continue; }

            $dept_id = null;
            if (!empty($f['department'])) {
                $dept_name = $conn->real_escape_string(trim($f['department']));
                $dept_row  = $conn->query("SELECT department_id FROM departments WHERE name='$dept_name' LIMIT 1")->fetch_assoc();
                $dept_id   = $dept_row ? (int)$dept_row['department_id'] : null;
            }

            $pos_id = null;
            if (!empty($f['position'])) {
                $pos_title = $conn->real_escape_string(trim($f['position']));
                $pos_row   = $conn->query("SELECT position_id FROM positions WHERE title='$pos_title' LIMIT 1")->fetch_assoc();
                $pos_id    = $pos_row ? (int)$pos_row['position_id'] : null;
            }

            $safe_email = $conn->real_escape_string($email);
            $existing   = $conn->query("SELECT employee_id FROM employees WHERE email='$safe_email' LIMIT 1")->fetch_assoc();

            $safe_fname = $conn->real_escape_string($first_name);
            $safe_lname = $conn->real_escape_string($last_name);
            $safe_dept  = $dept_id ?? 'NULL';
            $safe_pos   = $pos_id  ?? 'NULL';

            if ($existing) {
                $eid = (int)$existing['employee_id'];
                $conn->query("UPDATE employees SET first_name='$safe_fname', last_name='$safe_lname', gender='$gender', department_id=$safe_dept, position_id=$safe_pos, is_faculty=1 WHERE employee_id=$eid");
                $updated++;
            } else {
                $chars      = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
                $tmp_pass   = 'FAC-';
                for ($i = 0; $i < 6; $i++) $tmp_pass .= $chars[random_int(0, strlen($chars) - 1)];
                $safe_hash  = $conn->real_escape_string(password_hash($tmp_pass, PASSWORD_DEFAULT));

                $conn->query("INSERT INTO employees (first_name, last_name, email, password_hash, is_faculty, gender, department_id, position_id, is_archived) VALUES ('$safe_fname', '$safe_lname', '$safe_email', '$safe_hash', 1, '$gender', $safe_dept, $safe_pos, 0)");
                $conn->affected_rows > 0 ? $created++ : $skipped++;
            }
        }
        json_response(['status' => 'success', 'created' => $created, 'updated' => $updated, 'skipped' => $skipped]);
    }
} else {
    http_response_code(405);
    json_response(['status' => 'error', 'message' => 'Method not allowed. Use POST.']);
}