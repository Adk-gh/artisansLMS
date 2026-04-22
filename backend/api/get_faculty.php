<?php
/**
 * get_faculty.php
 * C:\xampp\htdocs\artisansLMS\backend\api\get_faculty.php
 *
 * Webhook/bridge endpoint between the LMS and the HRIS system.
 *
 * TWO directions:
 *
 * 1. HRIS → LMS (POST)
 *    The HRIS system pushes faculty data here whenever an instructor is
 *    created, updated, or deactivated on their side.
 *    Actions: 'sync_faculty' | 'deactivate_faculty'
 *
 * 2. LMS → HRIS (GET ?action=pull)
 *    Manually trigger a pull from the HRIS API to refresh all faculty.
 *    Admin-only (session required).
 *
 * Shared secret: HRIS_WEBHOOK_SECRET (must match what HRIS sends)
 */

error_reporting(0);
ini_set('display_errors', 0);
header('Content-Type: application/json; charset=utf-8');

// ── Config ────────────────────────────────────────────────────────────────────
define('HRIS_WEBHOOK_SECRET', 'CHANGE_ME_STRONG_HRIS_SECRET');     // shared with HRIS team
define('HRIS_API_URL',        'https://their-hris-system.com/api/faculty'); // HRIS gives you this
define('HRIS_API_KEY',        'THEIR_API_KEY');                     // HRIS gives you this

require_once __DIR__ . '/../../server/config/db.php';
require_once __DIR__ . '/../middleware/json_response.php';

$conn   = getConnection();
$method = $_SERVER['REQUEST_METHOD'];

// ═════════════════════════════════════════════════════════════════════════════
// DIRECTION 1 — HRIS pushes faculty data TO US (POST)
// ═════════════════════════════════════════════════════════════════════════════
if ($method === 'POST') {

    $raw  = file_get_contents('php://input');
    $data = json_decode($raw, true);

    if (!$data) {
        http_response_code(400);
        json_response(['status' => 'error', 'message' => 'Invalid JSON payload.']);
    }

    // ── Verify HMAC signature ──────────────────────────────────────────────
    $received_sig = $data['signature'] ?? '';
    $payload      = $data;
    unset($payload['signature']);
    $expected_sig = hash_hmac('sha256', json_encode($payload, JSON_UNESCAPED_UNICODE), HRIS_WEBHOOK_SECRET);

    if (!hash_equals($expected_sig, $received_sig)) {
        http_response_code(401);
        json_response(['status' => 'error', 'message' => 'Invalid signature. Unauthorized.']);
    }

    $action = $data['action'] ?? '';

    // ── Action: sync_faculty ──────────────────────────────────────────────
    // HRIS sends one or more faculty records to create/update in the LMS.
    // Expected payload:
    // {
    //   "action": "sync_faculty",
    //   "faculty": [
    //     {
    //       "hris_id":       "EMP-001",       // HRIS employee ID (stored for reference)
    //       "first_name":    "John",
    //       "last_name":     "Doe",
    //       "email":         "jdoe@school.edu",
    //       "gender":        "M",              // M | F | Other
    //       "date_of_birth": "1985-04-12",
    //       "hire_date":     "2020-06-01",
    //       "department":    "Computer Science", // matched against departments.name
    //       "position":      "Associate Professor", // matched against positions.title
    //       "salary":        55000.00
    //     }
    //   ],
    //   "signature": "hmac_sha256_of_payload_without_signature_field"
    // }
    if ($action === 'sync_faculty') {

        $faculty_list = $data['faculty'] ?? [];
        if (empty($faculty_list) || !is_array($faculty_list)) {
            json_response(['status' => 'error', 'message' => 'No faculty records provided.'], 400);
        }

        $created  = 0;
        $updated  = 0;
        $skipped  = 0;
        $errors   = [];

        foreach ($faculty_list as $f) {
            $email      = trim($f['email']         ?? '');
            $first_name = trim($f['first_name']    ?? '');
            $last_name  = trim($f['last_name']     ?? '');
            $hris_id    = trim($f['hris_id']       ?? '');
            $gender     = in_array($f['gender'] ?? '', ['M','F','Other']) ? $f['gender'] : 'M';
            $dob        = !empty($f['date_of_birth']) ? $f['date_of_birth'] : null;
            $hire_date  = !empty($f['hire_date'])     ? $f['hire_date']     : date('Y-m-d');
            $salary     = (float)($f['salary']        ?? 0);

            if (!$email || !$first_name || !$last_name) {
                $errors[] = "Skipped — missing required fields for: $hris_id";
                $skipped++;
                continue;
            }

            // Resolve department_id by name
            $dept_id = null;
            if (!empty($f['department'])) {
                $dept_name = $conn->real_escape_string(trim($f['department']));
                $dept_row  = $conn->query("SELECT department_id FROM departments WHERE name='$dept_name' LIMIT 1")->fetch_assoc();
                if ($dept_row) {
                    $dept_id = (int)$dept_row['department_id'];
                } else {
                    // Auto-create department if not found
                    $conn->query("INSERT INTO departments (name) VALUES ('$dept_name')");
                    $dept_id = (int)$conn->insert_id;
                }
            }

            // Resolve position_id by title
            $pos_id = null;
            if (!empty($f['position'])) {
                $pos_title = $conn->real_escape_string(trim($f['position']));
                $pos_row   = $conn->query("SELECT position_id FROM positions WHERE title='$pos_title' LIMIT 1")->fetch_assoc();
                if ($pos_row) {
                    $pos_id = (int)$pos_row['position_id'];
                } else {
                    // Auto-create position if not found
                    $conn->query("INSERT INTO positions (title) VALUES ('$pos_title')");
                    $pos_id = (int)$conn->insert_id;
                }
            }

            $safe_email = $conn->real_escape_string($email);
            $existing   = $conn->query("SELECT employee_id FROM employees WHERE email='$safe_email' LIMIT 1")->fetch_assoc();

            if ($existing) {
                // ── UPDATE existing instructor ──
                $eid        = (int)$existing['employee_id'];
                $safe_fname = $conn->real_escape_string($first_name);
                $safe_lname = $conn->real_escape_string($last_name);
                $safe_dob   = $dob   ? "'" . $conn->real_escape_string($dob)       . "'" : 'NULL';
                $safe_hire  = $hire_date ? "'" . $conn->real_escape_string($hire_date) . "'" : 'NULL';
                $safe_dept  = $dept_id ?? 'NULL';
                $safe_pos   = $pos_id  ?? 'NULL';

                $conn->query("
                    UPDATE employees SET
                        first_name    = '$safe_fname',
                        last_name     = '$safe_lname',
                        gender        = '$gender',
                        date_of_birth = $safe_dob,
                        hire_date     = $safe_hire,
                        department_id = $safe_dept,
                        position_id   = $safe_pos,
                        salary        = $salary,
                        is_faculty    = 1,
                        role          = 'teacher'
                    WHERE employee_id = $eid
                ");
                $updated++;

            } else {
                // ── CREATE new instructor ──
                // Generate a temporary password: FAC-XXXXXX
                $chars    = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
                $tmp_pass = 'FAC-';
                for ($i = 0; $i < 6; $i++) $tmp_pass .= $chars[random_int(0, strlen($chars) - 1)];
                $hashed   = password_hash($tmp_pass, PASSWORD_DEFAULT);

                $safe_fname = $conn->real_escape_string($first_name);
                $safe_lname = $conn->real_escape_string($last_name);
                $safe_dob   = $dob       ? "'" . $conn->real_escape_string($dob)       . "'" : 'NULL';
                $safe_hire  = $hire_date ? "'" . $conn->real_escape_string($hire_date) . "'" : 'NULL';
                $safe_dept  = $dept_id ?? 'NULL';
                $safe_pos   = $pos_id  ?? 'NULL';
                $safe_hash  = $conn->real_escape_string($hashed);

                $conn->query("
                    INSERT INTO employees
                        (first_name, last_name, email, password, role, is_faculty,
                         gender, date_of_birth, hire_date, department_id, position_id, salary)
                    VALUES
                        ('$safe_fname', '$safe_lname', '$safe_email', '$safe_hash',
                         'teacher', 1, '$gender', $safe_dob, $safe_hire,
                         $safe_dept, $safe_pos, $salary)
                ");

                if ($conn->affected_rows > 0) {
                    $created++;
                } else {
                    $errors[] = "DB insert failed for: $email — " . $conn->error;
                    $skipped++;
                }
            }
        }

        json_response([
            'status'  => 'success',
            'message' => "Sync complete. Created: $created, Updated: $updated, Skipped: $skipped.",
            'created' => $created,
            'updated' => $updated,
            'skipped' => $skipped,
            'errors'  => $errors,
        ]);
    }

    // ── Action: deactivate_faculty ────────────────────────────────────────
    // HRIS notifies us that an employee is no longer active.
    // We archive them rather than hard-delete.
    // Expected payload:
    // {
    //   "action":    "deactivate_faculty",
    //   "email":     "jdoe@school.edu",
    //   "hris_id":   "EMP-001",
    //   "signature": "..."
    // }
    elseif ($action === 'deactivate_faculty') {

        $email = $conn->real_escape_string(trim($data['email'] ?? ''));
        if (!$email) {
            json_response(['status' => 'error', 'message' => 'Email is required.'], 400);
        }

        $row = $conn->query("SELECT employee_id FROM employees WHERE email='$email' AND is_faculty=1 LIMIT 1")->fetch_assoc();

        if (!$row) {
            json_response(['status' => 'error', 'message' => 'Faculty member not found.'], 404);
        }

        $eid = (int)$row['employee_id'];

        // Archive log
        $conn->query("CREATE TABLE IF NOT EXISTS archive_log (
            archive_id   INT AUTO_INCREMENT PRIMARY KEY,
            record_type  VARCHAR(50)  NOT NULL,
            record_id    INT          NOT NULL,
            record_data  LONGTEXT     NOT NULL,
            archived_by  INT          NOT NULL DEFAULT 0,
            archived_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $full = $conn->query("SELECT e.*, p.title AS pos_title, d.name AS dept_name
                              FROM employees e
                              LEFT JOIN positions   p ON p.position_id   = e.position_id
                              LEFT JOIN departments d ON d.department_id = e.department_id
                              WHERE e.employee_id = $eid LIMIT 1")->fetch_assoc();

        if ($full) {
            $conn->query("DELETE FROM archive_log WHERE record_type='employees' AND record_id=$eid");
            $json_data = $conn->real_escape_string(json_encode($full, JSON_UNESCAPED_UNICODE));
            $conn->query("INSERT INTO archive_log (record_type, record_id, record_data, archived_by)
                          VALUES ('employees', $eid, '$json_data', 0)");
        }

        // Cascade — remove classes, assignments, quizzes, enrollments
        $class_res = $conn->query("SELECT class_id FROM classes WHERE instructor_id=$eid");
        while ($cl = $class_res->fetch_assoc()) {
            $cid = (int)$cl['class_id'];
            $conn->query("DELETE FROM quiz_attempts  WHERE quiz_id IN (SELECT quiz_id FROM quizzes WHERE class_id=$cid)");
            $conn->query("DELETE FROM quiz_questions WHERE quiz_id IN (SELECT quiz_id FROM quizzes WHERE class_id=$cid)");
            $conn->query("DELETE FROM quizzes        WHERE class_id=$cid");
            $conn->query("DELETE FROM submissions    WHERE assignment_id IN (SELECT assignment_id FROM assignments WHERE class_id=$cid)");
            $conn->query("DELETE FROM assignments    WHERE class_id=$cid");
            $conn->query("DELETE FROM enrollments    WHERE class_id=$cid");
            $conn->query("DELETE FROM classes        WHERE class_id=$cid");
        }
        $conn->query("DELETE FROM employees WHERE employee_id=$eid");

        json_response(['status' => 'success', 'message' => "Faculty member ($email) deactivated and archived."]);
    }

    else {
        json_response(['status' => 'error', 'message' => 'Unknown action. Supported: sync_faculty, deactivate_faculty.'], 400);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// DIRECTION 2 — LMS pulls faculty FROM HRIS (GET ?action=pull)
// Admin only — requires active session
// ═════════════════════════════════════════════════════════════════════════════
elseif ($method === 'GET') {

    if (session_status() === PHP_SESSION_NONE) session_start();

    if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
        json_response(['status' => 'error', 'message' => 'Unauthorized. Admin session required.'], 401);
    }

    $action = $_GET['action'] ?? '';

    if ($action !== 'pull') {
        json_response(['status' => 'error', 'message' => 'Supported GET action: pull'], 400);
    }

    // Call HRIS API
    $ch = curl_init(HRIS_API_URL);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'X-API-Key: ' . HRIS_API_KEY,
        ],
    ]);
    $response = curl_exec($ch);
    $curl_err = curl_error($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($curl_err || $http_code !== 200) {
        json_response([
            'status'    => 'error',
            'message'   => 'Failed to reach HRIS system.',
            'curl_error'=> $curl_err,
            'http_code' => $http_code,
        ], 502);
    }

    $hris_data = json_decode($response, true);
    if (!$hris_data || empty($hris_data['faculty'])) {
        json_response(['status' => 'error', 'message' => 'HRIS returned no faculty data.'], 502);
    }

    // Reuse the same sync logic — forward as a POST to ourselves
    // by processing the faculty array directly
    $faculty_list = $hris_data['faculty'];
    $created = $updated = $skipped = 0;
    $errors  = [];

    foreach ($faculty_list as $f) {
        $email      = trim($f['email']         ?? '');
        $first_name = trim($f['first_name']    ?? '');
        $last_name  = trim($f['last_name']     ?? '');
        $gender     = in_array($f['gender'] ?? '', ['M','F','Other']) ? $f['gender'] : 'M';
        $dob        = !empty($f['date_of_birth']) ? $f['date_of_birth'] : null;
        $hire_date  = !empty($f['hire_date'])     ? $f['hire_date']     : date('Y-m-d');
        $salary     = (float)($f['salary']        ?? 0);

        if (!$email || !$first_name || !$last_name) { $skipped++; continue; }

        $dept_id = null;
        if (!empty($f['department'])) {
            $dept_name = $conn->real_escape_string(trim($f['department']));
            $dept_row  = $conn->query("SELECT department_id FROM departments WHERE name='$dept_name' LIMIT 1")->fetch_assoc();
            if ($dept_row) {
                $dept_id = (int)$dept_row['department_id'];
            } else {
                $conn->query("INSERT INTO departments (name) VALUES ('$dept_name')");
                $dept_id = (int)$conn->insert_id;
            }
        }

        $pos_id = null;
        if (!empty($f['position'])) {
            $pos_title = $conn->real_escape_string(trim($f['position']));
            $pos_row   = $conn->query("SELECT position_id FROM positions WHERE title='$pos_title' LIMIT 1")->fetch_assoc();
            if ($pos_row) {
                $pos_id = (int)$pos_row['position_id'];
            } else {
                $conn->query("INSERT INTO positions (title) VALUES ('$pos_title')");
                $pos_id = (int)$conn->insert_id;
            }
        }

        $safe_email = $conn->real_escape_string($email);
        $existing   = $conn->query("SELECT employee_id FROM employees WHERE email='$safe_email' LIMIT 1")->fetch_assoc();

        if ($existing) {
            $eid        = (int)$existing['employee_id'];
            $safe_fname = $conn->real_escape_string($first_name);
            $safe_lname = $conn->real_escape_string($last_name);
            $safe_dob   = $dob       ? "'" . $conn->real_escape_string($dob)       . "'" : 'NULL';
            $safe_hire  = $hire_date ? "'" . $conn->real_escape_string($hire_date) . "'" : 'NULL';
            $safe_dept  = $dept_id ?? 'NULL';
            $safe_pos   = $pos_id  ?? 'NULL';
            $conn->query("UPDATE employees SET first_name='$safe_fname', last_name='$safe_lname', gender='$gender', date_of_birth=$safe_dob, hire_date=$safe_hire, department_id=$safe_dept, position_id=$safe_pos, salary=$salary, is_faculty=1, role='teacher' WHERE employee_id=$eid");
            $updated++;
        } else {
            $chars    = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
            $tmp_pass = 'FAC-';
            for ($i = 0; $i < 6; $i++) $tmp_pass .= $chars[random_int(0, strlen($chars) - 1)];
            $hashed     = password_hash($tmp_pass, PASSWORD_DEFAULT);
            $safe_fname = $conn->real_escape_string($first_name);
            $safe_lname = $conn->real_escape_string($last_name);
            $safe_dob   = $dob       ? "'" . $conn->real_escape_string($dob)       . "'" : 'NULL';
            $safe_hire  = $hire_date ? "'" . $conn->real_escape_string($hire_date) . "'" : 'NULL';
            $safe_dept  = $dept_id ?? 'NULL';
            $safe_pos   = $pos_id  ?? 'NULL';
            $safe_hash  = $conn->real_escape_string($hashed);
            $conn->query("INSERT INTO employees (first_name, last_name, email, password, role, is_faculty, gender, date_of_birth, hire_date, department_id, position_id, salary) VALUES ('$safe_fname','$safe_lname','$safe_email','$safe_hash','teacher',1,'$gender',$safe_dob,$safe_hire,$safe_dept,$safe_pos,$salary)");
            $conn->affected_rows > 0 ? $created++ : $skipped++;
        }
    }

    json_response([
        'status'  => 'success',
        'message' => "HRIS pull complete. Created: $created, Updated: $updated, Skipped: $skipped.",
        'created' => $created,
        'updated' => $updated,
        'skipped' => $skipped,
        'errors'  => $errors,
    ]);

} else {
    http_response_code(405);
    json_response(['status' => 'error', 'message' => 'Method not allowed.']);
}