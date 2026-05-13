<?php
/**
 * LMS — instructors.php  (backend/endpoints/instructors.php)
 */

error_reporting(0);
ini_set('display_errors', 0);

// Load Composer dependencies (Resend PHP SDK)
$autoload_path = __DIR__ . '/../../vendor/autoload.php';
if (file_exists($autoload_path)) {
    require_once $autoload_path;
}

require_once __DIR__ . '/../../server/config/db.php';
require_once __DIR__ . '/../middleware/json_response.php';

if (session_status() === PHP_SESSION_NONE) session_start();

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
    json_response(['status' => 'error', 'message' => 'Unauthorized access.'], 401);
}

$conn   = getConnection();
$action = $_GET['action'] ?? '';

switch ($action) {

    // ── GET ALL ───────────────────────────────────────────────────────────────
    case 'get_all':
        $depts_arr = [];
        $dq = $conn->query("SELECT * FROM departments ORDER BY name ASC");
        if ($dq) while ($d = $dq->fetch_assoc()) $depts_arr[] = $d;

        $pos_arr = [];
        $pq = $conn->query("SELECT * FROM positions ORDER BY title ASC");
        if ($pq) while ($p = $pq->fetch_assoc()) $pos_arr[] = $p;

        $instructors_arr = [];
        $sql = "
            SELECT e.*, p.title AS pos_title, d.name AS dept_name
            FROM   employees   e
            LEFT JOIN positions   p ON e.position_id   = p.position_id
            LEFT JOIN departments d ON e.department_id = d.department_id
            WHERE  e.is_faculty  = 1
              AND  e.is_archived = 0
            ORDER BY e.last_name ASC
        ";
        $res = $conn->query($sql);

        if ($res) {
            $count_stmt = $conn->prepare("SELECT COUNT(*) FROM classes WHERE instructor_id = ?");
            while ($row = $res->fetch_assoc()) {
                $eid = (int)$row['employee_id'];
                $count_stmt->bind_param("i", $eid);
                $count_stmt->execute();
                $count_stmt->bind_result($class_count);
                $count_stmt->fetch();
                $count_stmt->reset();

                $row['class_count']     = (int)$class_count;
                $row['managed_by_hris'] = true;
                $instructors_arr[]      = $row;
            }
        }

        json_response([
            'status'      => 'success',
            'data'        => $instructors_arr,
            'departments' => $depts_arr,
            'positions'   => $pos_arr,
        ]);
        break;

    // ── CREATE / UPDATE ───────────────────────────────────────────────────────
    case 'create':
    case 'update':
        json_response([
            'status'  => 'error',
            'message' => 'Profiles are managed via the HRIS. Updates happen automatically.',
        ], 403);
        break;

    // ── GENERATE TEMPORARY PASSWORD ───────────────────────────────────────────
    case 'generate_password':
        $input = json_decode(file_get_contents('php://input'), true);
        $eid   = (int)($input['employee_id'] ?? 0);

        if (!$eid) {
            json_response(['status' => 'error', 'message' => 'Invalid instructor ID.'], 400);
        }

        $chk = $conn->prepare("SELECT first_name, last_name, email FROM employees WHERE employee_id = ? LIMIT 1");
        $chk->bind_param("i", $eid);
        $chk->execute();
        $instructor = $chk->get_result()->fetch_assoc();

        if (!$instructor) {
            json_response(['status' => 'error', 'message' => 'Instructor not found.'], 404);
        }

        $chars    = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
        $tmp_pass = 'FAC-';
        for ($i = 0; $i < 6; $i++) {
            $tmp_pass .= $chars[random_int(0, strlen($chars) - 1)];
        }
        $hashed = password_hash($tmp_pass, PASSWORD_DEFAULT);

        $upd = $conn->prepare("UPDATE employees SET password_hash = ? WHERE employee_id = ?");
        $upd->bind_param("si", $hashed, $eid);

        if ($upd->execute()) {
            json_response([
                'status'           => 'success',
                'message'          => 'Password generated.',
                'instructor_name'  => $instructor['first_name'] . ' ' . $instructor['last_name'],
                'instructor_email' => $instructor['email'],
                'temp_password'    => $tmp_pass,
            ]);
        } else {
            json_response(['status' => 'error', 'message' => 'Failed to update password.'], 500);
        }
        break;

    // ── SEND CREDENTIALS EMAIL (Resend PHP SDK) ───────────────────────────────
    case 'send_credentials_email':
        $body  = json_decode(file_get_contents('php://input'), true);
        $email = filter_var(trim($body['email'] ?? ''), FILTER_VALIDATE_EMAIL);
        $name  = htmlspecialchars(trim($body['name'] ?? 'Instructor'));
        $pass  = htmlspecialchars(trim($body['temp_password'] ?? ''));

        // Use the BREVO_API_KEY saved in your Render Environment Variables
        $api_key = getenv('BREVO_API_KEY');

        $data = [
            "sender" => ["name" => "Artisans LMS", "email" => "your-verified-gmail@gmail.com"],
            "to" => [["email" => $email, "name" => $name]],
            "subject" => "Your Artisans LMS Login Credentials",
            "htmlContent" => "<html><body><p>Hello {$name}, your temp password is: <b>{$pass}</b></p></body></html>"
        ];

        $ch = curl_init('https://api.brevo.com/v3/smtp/email');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'api-key: ' . $api_key,
            'Content-Type: application/json'
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode >= 200 && $httpCode < 300) {
            json_response(['status' => 'success', 'message' => 'Email sent via Brevo API.']);
        } else {
            json_response(['status' => 'error', 'message' => 'Email failed.'], 500);
        }
        break;

    // ── ARCHIVE ───────────────────────────────────────────────────────────────
    case 'archive':
        $input = json_decode(file_get_contents('php://input'), true);
        $id    = (int)($input['archive_id'] ?? 0);

        if (!$id) {
            json_response(['status' => 'error', 'message' => 'Invalid instructor ID.'], 400);
        }

        $stmt = $conn->prepare("UPDATE employees SET is_archived = 1 WHERE employee_id = ?");
        $stmt->bind_param("i", $id);

        if ($stmt->execute()) {
            json_response(['status' => 'success', 'message' => 'Instructor archived successfully.']);
        } else {
            json_response(['status' => 'error', 'message' => 'Failed to archive instructor.'], 500);
        }
        break;

    // ── DEFAULT ───────────────────────────────────────────────────────────────
    default:
        json_response(['status' => 'error', 'message' => 'Invalid action.'], 400);
        break;
}