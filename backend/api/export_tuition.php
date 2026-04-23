<?php
// export_tuition.php
// ─────────────────────────────────────────────────────────────────────────────
// READ/WRITE Finance API — exposes tuition and enrollment data, and handles
// enrollment approval on behalf of the Finance department.
//
// Base URL  : /artisansLMS/backend/api/export_tuition.php
//
// GET Endpoints :
//   GET  ?action=get_overview          — system-wide tuition & enrollment summary
//   GET  ?action=get_pending           — all enrollments awaiting finance approval
//   GET  ?action=get_approved          — all approved enrollments (billable records)
//   GET  ?action=get_by_student&student_id=5  — full tuition record for one student
//   GET  ?action=get_by_semester&semester=1st&year=2025  — enrollments for a term
//
// POST Endpoints :
//   POST ?action=approve               — approve a single enrollment by enrollment_id
//                                        Body: { "enrollment_id": 12 }
//   POST ?action=approve_student       — approve ALL pending for a student
//                                        Body: { "student_id": 5 }
//
// Auth : X-API-Key header  OR  ?api_key= query param
// ─────────────────────────────────────────────────────────────────────────────

error_reporting(0);
ini_set('display_errors', 0);

require_once __DIR__ . '/../../server/config/db.php';
require_once __DIR__ . '/../middleware/json_response.php';

define('TUITION_API_KEY', 'fN3kzPqLmW8xRtYcJ2sDhUeVbA7gXo1Q');

// ── Webhook config ────────────────────────────────────────────────────────────
// Set WEBHOOK_URL to your finance system's receiver endpoint.
// Set WEBHOOK_SECRET to a shared secret for HMAC signature verification.
// Leave WEBHOOK_URL empty to disable outbound webhooks from this file.
define('WEBHOOK_URL',    '');   // e.g. 'https://finance.example.com/webhooks/lms'
define('WEBHOOK_SECRET', '');   // e.g. 'whsec_your_secret_here'

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: X-API-Key, Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'GET' && $method !== 'POST') {
    json_response(['status' => 'error', 'message' => 'Method not allowed. Use GET or POST.'], 405);
}

$provided_key = trim(
    $_SERVER['HTTP_X_API_KEY']
    ?? $_SERVER['HTTP_X_Api_Key']
    ?? $_GET['api_key']
    ?? ''
);

if ($provided_key !== trim(TUITION_API_KEY)) {
    json_response(['status' => 'error', 'message' => 'Unauthorized. Invalid or missing API key.'], 401);
}

$conn   = getConnection();
$action = trim($_GET['action'] ?? '');

// ── Shared base query fragment ────────────────────────────────────────────────
$BASE_SELECT = "
    SELECT
        e.enrollment_id,
        e.status                                      AS enrollment_status,
        e.enroll_date,

        s.student_id,
        s.first_name,
        s.last_name,
        CONCAT(s.first_name, ' ', s.last_name)        AS full_name,
        s.email,

        c.class_id,
        c.semester,
        c.year,

        co.course_id,
        co.course_code,
        co.name                                       AS course_name,
        co.credits AS units,

        d.department_id,
        d.name                                        AS department_name,

        CONCAT(emp.first_name, ' ', emp.last_name)    AS instructor_name
    FROM enrollments e
    JOIN students   s   ON s.student_id    = e.student_id
    JOIN classes    c   ON c.class_id      = e.class_id
    JOIN courses    co  ON co.course_id    = c.course_id
    LEFT JOIN departments d   ON d.department_id = co.department_id
    JOIN employees  emp ON emp.employee_id = c.instructor_id
";

// ── Helper: cast & shape one enrollment row ───────────────────────────────────
function shape_row(array $row): array {
    $row['enrollment_id'] = (int)$row['enrollment_id'];
    $row['student_id']    = (int)$row['student_id'];
    $row['class_id']      = (int)$row['class_id'];
    $row['course_id']     = (int)$row['course_id'];
    $row['department_id'] = $row['department_id'] !== null ? (int)$row['department_id'] : null;
    $row['units']         = $row['units']         !== null ? (int)$row['units']         : null;
    return $row;
}

// ── Helper: fire outbound webhook (non-blocking best-effort) ──────────────────
function fire_webhook(string $event, array $payload): void {
    if (!defined('WEBHOOK_URL') || WEBHOOK_URL === '') return;

    $body      = json_encode(['event' => $event, 'data' => $payload, 'timestamp' => date('c')]);
    $signature = hash_hmac('sha256', $body, WEBHOOK_SECRET);

    $ctx = stream_context_create([
        'http' => [
            'method'        => 'POST',
            'header'        => implode("\r\n", [
                'Content-Type: application/json',
                'X-LMS-Event: '     . $event,
                'X-LMS-Signature: ' . $signature,
            ]),
            'content'       => $body,
            'timeout'       => 5,
            'ignore_errors' => true,
        ]
    ]);

    // Intentionally ignoring return value — fire and forget
    @file_get_contents(WEBHOOK_URL, false, $ctx);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST ACTIONS (Finance writes)
// ─────────────────────────────────────────────────────────────────────────────

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];

    // ── Approve a single enrollment ───────────────────────────────────────────
    if ($action === 'approve') {
        $eid = (int)($input['enrollment_id'] ?? 0);

        if (!$eid) {
            json_response(['status' => 'error', 'message' => 'Missing or invalid enrollment_id.'], 400);
        }

        // Fetch full record before updating (for response + webhook)
        $conn2 = getConnection();
        $check = $conn2->query("
            SELECT e.enrollment_id, e.status, e.student_id,
                   CONCAT(s.first_name,' ',s.last_name) AS full_name,
                   s.email,
                   co.course_code, co.name AS course_name,
                   c.semester, c.year
            FROM enrollments e
            JOIN students s  ON s.student_id = e.student_id
            JOIN classes  c  ON c.class_id   = e.class_id
            JOIN courses  co ON co.course_id  = c.course_id
            WHERE e.enrollment_id = $eid
            LIMIT 1
        ");

        if (!$check || $check->num_rows === 0) {
            json_response(['status' => 'error', 'message' => 'Enrollment not found.'], 404);
        }

        $record = $check->fetch_assoc();

        if ($record['status'] !== 'Pending Finance') {
            json_response([
                'status'  => 'error',
                'message' => "Enrollment is already '{$record['status']}'. Only 'Pending Finance' can be approved."
            ], 409);
        }

        $stmt = $conn->prepare(
            "UPDATE enrollments SET status = 'Approved', enroll_date = CURDATE()
             WHERE enrollment_id = ? AND status = 'Pending Finance'"
        );
        $stmt->bind_param("i", $eid);
        $stmt->execute();

        if ($stmt->affected_rows > 0) {
            fire_webhook('enrollment.approved', [
                'enrollment_id' => $eid,
                'student_id'    => (int)$record['student_id'],
                'full_name'     => $record['full_name'],
                'email'         => $record['email'],
                'course_code'   => $record['course_code'],
                'course_name'   => $record['course_name'],
                'semester'      => $record['semester'],
                'year'          => $record['year'],
                'approved_date' => date('Y-m-d'),
            ]);

            json_response([
                'status'  => 'success',
                'message' => "Enrollment #{$eid} approved.",
                'data'    => [
                    'enrollment_id' => $eid,
                    'student_id'    => (int)$record['student_id'],
                    'full_name'     => $record['full_name'],
                    'course_code'   => $record['course_code'],
                    'approved_date' => date('Y-m-d'),
                ]
            ]);
        } else {
            json_response(['status' => 'error', 'message' => 'Approval failed. Enrollment may have already been processed.'], 409);
        }
    }

    // ── Approve ALL pending for a student ─────────────────────────────────────
    elseif ($action === 'approve_student') {
        $student_id = (int)($input['student_id'] ?? 0);

        if (!$student_id) {
            json_response(['status' => 'error', 'message' => 'Missing or invalid student_id.'], 400);
        }

        // Fetch all pending records for this student first
        $records_res = $conn->query("
            SELECT e.enrollment_id, e.student_id,
                   CONCAT(s.first_name,' ',s.last_name) AS full_name,
                   s.email,
                   co.course_code, co.name AS course_name,
                   c.semester, c.year
            FROM enrollments e
            JOIN students s  ON s.student_id = e.student_id
            JOIN classes  c  ON c.class_id   = e.class_id
            JOIN courses  co ON co.course_id  = c.course_id
            WHERE e.student_id = $student_id AND e.status = 'Pending Finance'
        ");

        if (!$records_res || $records_res->num_rows === 0) {
            json_response(['status' => 'error', 'message' => 'No pending enrollments found for this student.'], 404);
        }

        $records = [];
        while ($row = $records_res->fetch_assoc()) {
            $records[] = $row;
        }

        $stmt = $conn->prepare(
            "UPDATE enrollments SET status = 'Approved', enroll_date = CURDATE()
             WHERE student_id = ? AND status = 'Pending Finance'"
        );
        $stmt->bind_param("i", $student_id);
        $stmt->execute();
        $affected = $stmt->affected_rows;

        if ($affected > 0) {
            fire_webhook('enrollment.bulk_approved', [
                'student_id'   => $student_id,
                'full_name'    => $records[0]['full_name'],
                'email'        => $records[0]['email'],
                'count'        => $affected,
                'approved_date'=> date('Y-m-d'),
                'enrollments'  => array_map(fn($r) => [
                    'enrollment_id' => (int)$r['enrollment_id'],
                    'course_code'   => $r['course_code'],
                    'course_name'   => $r['course_name'],
                    'semester'      => $r['semester'],
                    'year'          => $r['year'],
                ], $records),
            ]);

            json_response([
                'status'  => 'success',
                'message' => "{$affected} enrollment(s) approved for student #{$student_id}.",
                'data'    => [
                    'student_id'    => $student_id,
                    'full_name'     => $records[0]['full_name'],
                    'approved_count'=> $affected,
                    'approved_date' => date('Y-m-d'),
                ]
            ]);
        } else {
            json_response(['status' => 'error', 'message' => 'Approval failed.'], 500);
        }
    }

    else {
        json_response([
            'status'  => 'error',
            'message' => 'Invalid POST action. Supported: approve, approve_student.',
        ], 400);
    }

    exit;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET ACTIONS (Finance reads)
// ─────────────────────────────────────────────────────────────────────────────

// ── 1. System-wide Tuition Overview ──────────────────────────────────────────
if ($action === 'get_overview') {

    $total_enrollments = (int)$conn->query(
        "SELECT COUNT(*) FROM enrollments"
    )->fetch_row()[0];

    $pending_count = (int)$conn->query(
        "SELECT COUNT(*) FROM enrollments WHERE status = 'Pending Finance'"
    )->fetch_row()[0];

    $approved_count = (int)$conn->query(
        "SELECT COUNT(*) FROM enrollments WHERE status = 'Approved'"
    )->fetch_row()[0];

    $rejected_count = (int)$conn->query(
        "SELECT COUNT(*) FROM enrollments WHERE status = 'Rejected'"
    )->fetch_row()[0];

    $unique_students_enrolled = (int)$conn->query(
        "SELECT COUNT(DISTINCT student_id) FROM enrollments WHERE status = 'Approved'"
    )->fetch_row()[0];

    $unique_students_pending = (int)$conn->query(
        "SELECT COUNT(DISTINCT student_id) FROM enrollments WHERE status = 'Pending Finance'"
    )->fetch_row()[0];

    // Per-semester breakdown
    $sem_res = $conn->query("
        SELECT c.semester, c.year,
               COUNT(e.enrollment_id)            AS total_enrollments,
               SUM(e.status = 'Approved')        AS approved,
               SUM(e.status = 'Pending Finance') AS pending,
               SUM(e.status = 'Rejected')        AS rejected,
               COUNT(DISTINCT e.student_id)      AS unique_students
        FROM enrollments e
        JOIN classes c ON c.class_id = e.class_id
        GROUP BY c.semester, c.year
        ORDER BY c.year DESC, c.semester ASC
    ");
    $by_semester = [];
    if ($sem_res) {
        while ($row = $sem_res->fetch_assoc()) {
            $row['total_enrollments'] = (int)$row['total_enrollments'];
            $row['approved']          = (int)$row['approved'];
            $row['pending']           = (int)$row['pending'];
            $row['rejected']          = (int)$row['rejected'];
            $row['unique_students']   = (int)$row['unique_students'];
            $by_semester[] = $row;
        }
    }

    json_response([
        'status' => 'success',
        'data'   => [
            'total_enrollments'        => $total_enrollments,
            'approved_count'           => $approved_count,
            'pending_count'            => $pending_count,
            'rejected_count'           => $rejected_count,
            'unique_students_enrolled' => $unique_students_enrolled,
            'unique_students_pending'  => $unique_students_pending,
            'by_semester'              => $by_semester,
        ]
    ]);
}

// ── 2. Pending Finance Enrollments ────────────────────────────────────────────
elseif ($action === 'get_pending') {

    $res = $conn->query($BASE_SELECT . "
        WHERE e.status = 'Pending Finance'
        ORDER BY e.enroll_date ASC, s.last_name ASC
    ");

    if (!$res) {
        json_response(['status' => 'error', 'message' => $conn->error], 500);
    }

    $rows = [];
    while ($row = $res->fetch_assoc()) {
        $rows[] = shape_row($row);
    }

    // Group by student for finance readability
    $grouped = [];
    foreach ($rows as $r) {
        $sid = $r['student_id'];
        if (!isset($grouped[$sid])) {
            $grouped[$sid] = [
                'student_id'  => $sid,
                'full_name'   => $r['full_name'],
                'email'       => $r['email'],
                'enrollments' => []
            ];
        }
        unset($r['full_name'], $r['email']);
        $grouped[$sid]['enrollments'][] = $r;
    }

    json_response([
        'status'        => 'success',
        'count'         => count($rows),
        'student_count' => count($grouped),
        'data'          => array_values($grouped),
    ]);
}

// ── 3. Approved Enrollments (Billable Records) ────────────────────────────────
elseif ($action === 'get_approved') {

    $res = $conn->query($BASE_SELECT . "
        WHERE e.status = 'Approved'
        ORDER BY e.enroll_date DESC, s.last_name ASC
    ");

    if (!$res) {
        json_response(['status' => 'error', 'message' => $conn->error], 500);
    }

    $rows = [];
    while ($row = $res->fetch_assoc()) {
        $rows[] = shape_row($row);
    }

    json_response([
        'status' => 'success',
        'count'  => count($rows),
        'data'   => $rows,
    ]);
}

// ── 4. Single Student Tuition Record ─────────────────────────────────────────
elseif ($action === 'get_by_student') {

    $student_id = isset($_GET['student_id']) ? (int)$_GET['student_id'] : 0;
    if (!$student_id) {
        json_response(['status' => 'error', 'message' => 'Missing or invalid student_id parameter.'], 400);
    }

    $res = $conn->query($BASE_SELECT . "
        WHERE e.student_id = $student_id
        ORDER BY c.year DESC, c.semester ASC, e.enroll_date DESC
    ");

    if (!$res) {
        json_response(['status' => 'error', 'message' => $conn->error], 500);
    }

    $rows = [];
    while ($row = $res->fetch_assoc()) {
        $rows[] = shape_row($row);
    }

    if (empty($rows)) {
        json_response(['status' => 'error', 'message' => 'Student not found or has no enrollments.'], 404);
    }

    $counts = ['Approved' => 0, 'Pending Finance' => 0, 'Rejected' => 0];
    foreach ($rows as $r) {
        if (isset($counts[$r['enrollment_status']])) {
            $counts[$r['enrollment_status']]++;
        }
    }

    json_response([
        'status'  => 'success',
        'student' => [
            'student_id' => $rows[0]['student_id'],
            'full_name'  => $rows[0]['full_name'],
            'email'      => $rows[0]['email'],
        ],
        'summary' => [
            'total'    => count($rows),
            'approved' => $counts['Approved'],
            'pending'  => $counts['Pending Finance'],
            'rejected' => $counts['Rejected'],
        ],
        'data'    => $rows,
    ]);
}

// ── 5. Enrollments by Semester/Year ──────────────────────────────────────────
elseif ($action === 'get_by_semester') {

    $semester = trim($_GET['semester'] ?? '');
    $year     = isset($_GET['year']) ? (int)$_GET['year'] : 0;

    if (!$semester || !$year) {
        json_response(['status' => 'error', 'message' => 'Missing semester or year parameter. Example: ?action=get_by_semester&semester=1st&year=2025'], 400);
    }

    $stmt = $conn->prepare($BASE_SELECT . "
        WHERE c.semester = ? AND c.year = ?
        ORDER BY e.status ASC, s.last_name ASC
    ");
    $stmt->bind_param("si", $semester, $year);
    $stmt->execute();
    $res = $stmt->get_result();

    if (!$res) {
        json_response(['status' => 'error', 'message' => $conn->error], 500);
    }

    $rows = [];
    while ($row = $res->fetch_assoc()) {
        $rows[] = shape_row($row);
    }

    $counts = ['Approved' => 0, 'Pending Finance' => 0, 'Rejected' => 0];
    foreach ($rows as $r) {
        if (isset($counts[$r['enrollment_status']])) {
            $counts[$r['enrollment_status']]++;
        }
    }

    json_response([
        'status'   => 'success',
        'semester' => $semester,
        'year'     => $year,
        'summary'  => [
            'total'    => count($rows),
            'approved' => $counts['Approved'],
            'pending'  => $counts['Pending Finance'],
            'rejected' => $counts['Rejected'],
        ],
        'data'     => $rows,
    ]);
}

// ── Unknown action ────────────────────────────────────────────────────────────
else {
    json_response([
        'status'  => 'error',
        'message' => 'Invalid action. Supported GET: get_overview, get_pending, get_approved, get_by_student, get_by_semester. Supported POST: approve, approve_student.',
    ], 400);
}