# ArtisansLMS System Flow & Architecture

## Overview

ArtisansLMS is a Learning Management System (LMS) built with PHP, MySQL, and JavaScript. It manages courses, classes, enrollments, assignments, quizzes, grades, and real-time collaboration features through WebSockets.

***

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Client)                              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ login.html  │  │dashboard.html│  │courses.html │  │collaborations.html│ │
│  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘  │
│         │                │                │                   │            │
│         └────────────────┴────────────────┴───────────────────┘            │
│                                    │                                        │
│                              JavaScript (app.js)                            │
│                    (Handles API calls, session management)                 │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
                          ┌──────────┴──────────┐
                          │   Web Server       │
                          │   (Apache/XAMPP)   │
                          └──────────┬──────────┘
                                     │
┌────────────────────────────────────┼────────────────────────────────────────┐
│                          BACKEND (PHP API)                                 │
│                                    │                                        │
│                    ┌───────────────┴───────────────┐                       │
│                    │    backend/index.php          │                       │
│                    │    (Main Router)             │                       │
│                    └───────────┬───────────────────┘                       │
│                                │                                            │
│         ┌──────────────────────┼──────────────────────┐                   │
│         │                      │                      │                   │
│  ┌──────┴──────┐        ┌───────┴───────┐      ┌──────┴──────┐           │
│  │ middleware │        │   endpoints/   │      │     api/     │           │
│  │  (CORS,    │        │   (Auth,       │      │ (Webhooks,   │           │
│  │  JSON)     │        │   Courses,     │      │  Export)     │           │
│  └────────────┘        │   Enrollments) │      └──────────────┘           │
│                        └────────────────┘                                   │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                 ┌────────────────┴────────────────┐
                 │      server/                   │
                 │  ┌─────────┐  ┌────────────┐  │
                 │  │ config/ │  │ controllers/│  │
                 │  │ db.php  │  │ AuthController │ │
                 │  │         │  │ DashboardController│ │
                 │  └─────────┘  │ MessagesController│  │
                 │               │ AnalyticsController│ │
                 │               └────────────┘    │
                 │  ┌─────────────┐                │
                 │  │   models/   │                │
                 │  │   User.php  │                │
                 │  └─────────────┘                │
                 └─────────────────────────────────┘
                                  │
                 ┌────────────────┴────────────────┐
                 │        MySQL Database         │
                 │   (itprofel3 on XAMPP)         │
                 └────────────────────────────────┘
```

***

## Request Flow

### 1. HTTP Request Lifecycle

```
Browser (Client)
      │
      │ HTTP Request (GET/POST)
      ▼
Apache Web Server (XAMPP)
      │
      │ Routes to backend/index.php
      ▼
backend/index.php (Main Router)
      │
      │ Reads 'route' parameter from GET or POST body
      │
      ▼
   match ($route) ─────────────────────────────────────┐
      │                                                  │
      ├── 'auth'        ──► backend/endpoints/auth.php │
      ├── 'courses'     ──► backend/endpoints/courses.php
      ├── 'enrollments'──► backend/endpoints/enrollments.php
      ├── 'classes'     ──► backend/endpoints/classes.php
      ├── 'students'    ──► backend/endpoints/students.php
      ├── 'instructors' ──► backend/endpoints/instructors.php
      ├── 'assignments' ──► backend/endpoints/assignments.php
      ├── 'quizzes'     ──► backend/endpoints/quizzes.php
      ├── 'grades'      ──► backend/endpoints/grades.php
      ├── 'messages'    ──► backend/endpoints/messages.php
      ├── 'resources'   ──► backend/endpoints/resources.php
      ├── 'collaborations'─► backend/endpoints/collaborations.php
      ├── 'analytics'   ──► backend/endpoints/analytics.php
      ├── 'dashboard'   ──► backend/endpoints/dashboard.php
      └── (default)     ──► Returns 404 error
```

### 2. Endpoint Processing

Each endpoint file follows a similar pattern:

```
Endpoint File (e.g., courses.php)
      │
      ├── 1. Error Reporting Setup
      │     error_reporting(0);
      │     ini_set('display_errors', 0);
      │
      ├── 2. Include Dependencies
      │     require_once db.php (database)
      │     require_once json_response.php (middleware)
      │
      ├── 3. Session Check
      │     session_start()
      │     Check $_SESSION['user_id'] & role
      │
      ├── 4. Get Database Connection
      │     $conn = getConnection();
      │
      ├── 5. Route Actions
      │     switch ($action) {
      │         case 'get_all': ...
      │         case 'create': ...
      │         case 'update': ...
      │         case 'archive': ...
      │     }
      │
      └── 6. Return JSON Response
            json_response([...])
```

***

## File Descriptions

### Backend Entry Point

| File                | Description                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/index.php` | Main router that parses the `route` parameter and includes the appropriate endpoint file. Also loads CORS and JSON response middleware. |

### Middleware

| File                                   | Description                                                                                                                              |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/middleware/cors.php`          | Handles Cross-Origin Resource Sharing (CORS) headers. Allows specific origins, methods, and headers. Handles preflight OPTIONS requests. |
| `backend/middleware/json_response.php` | Utility function to consistently output JSON responses with proper HTTP status codes.                                                    |
| `backend/middleware/session_info.php`  | Provides session information utilities.                                                                                                  |

### Endpoints (API Routes)

| File                                           | Description                                                                                          |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `backend/endpoints/auth.php`                   | Authentication endpoint. Handles login, registration, logout, session check, and department listing. |
| `backend/endpoints/courses.php`                | Admin-only course management. CRUD operations, archive, resource upload/delete.                      |
| `backend/endpoints/classes.php`                | Admin-only class section management. Create/update/archive class sections.                           |
| `backend/endpoints/enrollments.php`            | Enrollment management. Student enrollment, rejection, dropping. Supports finance approval workflow.  |
| `backend/endpoints/students.php`               | Student CRUD operations, archive, department assignment.                                             |
| `backend/endpoints/instructors.php`            | Instructor management (read-only from HRIS). Generate temporary passwords, archive.                  |
| `backend/endpoints/dashboard.php`              | Dashboard statistics for admin. Returns counts, charts, and recent activity data.                    |
| `backend/endpoints/assignments.php`            | Assignment management for students.                                                                  |
| `backend/endpoints/instructor_assignments.php` | Assignment management for instructors.                                                               |
| `backend/endpoints/quizzes.php`                | Quiz management for students.                                                                        |
| `backend/endpoints/grades.php`                 | Student grades viewing.                                                                              |
| `backend/endpoints/my_grades.php`              | Personal grades viewing.                                                                             |
| `backend/endpoints/messages.php`               | Messaging/chat functionality.                                                                        |
| `backend/endpoints/resources.php`              | Course resource management.                                                                          |
| `backend/endpoints/collaborations.php`         | Real-time collaboration features.                                                                    |
| `backend/endpoints/analytics.php`              | Analytics data for admin.                                                                            |
| `backend/endpoints/my_analytics.php`           | Personal analytics for students.                                                                     |
| `backend/endpoints/instructor_courses.php`     | Courses assigned to specific instructors.                                                            |
| `backend/endpoints/instructor_dashboard.php`   | Dashboard for instructors.                                                                           |
| `backend/endpoints/profile.php`                | User profile management.                                                                             |
| `backend/endpoints/archived.php`               | View archived records.                                                                               |
| `backend/endpoints/reports.php`                | Report generation.                                                                                   |

### API (External Integrations)

| File                                         | Description                                                                                                                                   |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/api/get_faculty.php`                | HRIS webhook receiver. Syncs faculty, departments, positions from external HRIS system. Handles `sync_faculty` and `archive_faculty` actions. |
| `backend/api/export_tuition.php`             | Tuition payment webhook for finance department. Approves enrollments.                                                                         |
| `backend/api/webhook_room.php`               | Room management webhook.                                                                                                                      |
| `backend/api/webhook_tuition.php`            | Alternative tuition webhook.                                                                                                                  |
| `backend/api/export_student_performance.php` | Export student performance data.                                                                                                              |
| `backend/api/export_classes.php`             | Export class data.                                                                                                                            |

### Server-Side Logic (MVC Pattern)

| File                                                    | Description                                                                                                                   |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `server/config/db.php`                                  | Database connection manager. Reads from `.env` file (local) or environment variables (production). Returns MySQLi connection. |
| `server/controllers/AuthController.php`                 | Authentication logic. Login, registration, session management, role-based redirects.                                          |
| `server/controllers/DashboardController.php`            | Dashboard statistics logic. Queries courses, enrollments, classes, gender data, department stats.                             |
| `server/controllers/MessagesController.php`             | Chat/messaging logic.                                                                                                         |
| `server/controllers/AnalyticsController.php`            | Analytics data processing.                                                                                                    |
| `server/controllers/AssignmentController.php`           | Student assignment operations.                                                                                                |
| `server/controllers/InstructorAssignmentController.php` | Instructor assignment operations.                                                                                             |
| `server/controllers/CollaborationsController.php`       | Collaboration features logic.                                                                                                 |
| `server/models/User.php`                                | User model. Handles finding users by email (checks both students and employees tables), creating new students.                |
| `server/models/Course.php`                              | Course model (currently minimal).                                                                                             |
| `server/models/Assignment.php`                          | Assignment model.                                                                                                             |
| `server/models/Quiz.php`                                | Quiz model.                                                                                                                   |
| `server/models/Grade.php`                               | Grade model.                                                                                                                  |
| `server/models/Message.php`                             | Message model.                                                                                                                |
| `server/models/Enrollment.php`                          | Enrollment model.                                                                                                             |
| `server/models/Resource.php`                            | Resource model.                                                                                                               |
| `server/models/Class_.php`                              | Class model.                                                                                                                  |
| `server/helpers/quiz_handler.php`                       | Quiz helper utilities.                                                                                                        |

### WebSocket Server (Real-Time Features)

| File                  | Description                                                                                                                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/ws/server.js` | Node.js WebSocket server running on port 8080. Handles real-time XP tracking and live attendance. Connects to MySQL for enrollment verification. Maintains in-memory state for active classes and XP tracking. |

***

## Database Schema (Key Tables)

```
┌─────────────────┐       ┌─────────────────┐
│   departments   │       │    positions    │
├─────────────────┤       ├─────────────────┤
│ department_id   │       │ position_id     │
│ name            │       │ title           │
│ description     │       │ description     │
└────────┬────────┘       └─────────────────┘
         │
         │
┌────────┴────────┐       ┌─────────────────┐       ┌─────────────────┐
│    employees    │       │    students     │       │    courses      │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ employee_id     │       │ student_id      │       │ course_id       │
│ hris_id         │       │ first_name      │       │ course_code     │
│ first_name      │       │ last_name       │       │ name            │
│ last_name       │       │ email           │       │ description     │
│ email           │       │ dob             │       │ credits         │
│ password_hash   │       │ gender          │       │ department_id   │
│ is_faculty      │       │ department_id   │       └────────┬────────┘
│ is_archived     │       │ enrollment_date  │                │
│ department_id   │       └────────┬────────┘                │
│ position_id     │                │                          │
└────────┬────────┘                │               ┌──────────┴──────────┐
         │                        │               │       classes       │
         │                        │               ├─────────────────────┤
         │                        │               │ class_id            │
         │                        │               │ course_id           │
         │                        │               │ instructor_id       │
         │                        │               │ semester            │
         │                        │               │ year                │
         │                        │               │ max_enrollment      │
         │                        │               └──────────┬──────────┘
         │                        │                          │
         │         ┌──────────────┴──────────────┐          │
         │         │      enrollments            │◄─────────┘
         │         ├─────────────────────────────┤
         │         │ enrollment_id
         │         │ student_id
         │         │ class_id
         │         │ enroll_date
         │         │ status (Pending Finance/Approved/Rejected)
         │         └──────────┬──────────────────┘
         │                    │
         │         ┌──────────┴──────────┐
         │         │     assignments      │
         │         ├──────────────────────┤
         │         │ assignment_id
         │         │ class_id
         │         │ title
         │         │ description
         │         │ due_date
         │         │ points
         │         └──────────────────────┘
         │
         │
         │         ┌──────────┐    ┌──────────┐
         │         │  quizzes │    │  grades  │
         │         ├──────────┤    ├──────────┤
         │         │ quiz_id  │    │ grade_id │
         │         │ class_id │    │ student_id│
         │         │ title    │    │ assignment_id│
         │         │ ...      │    │ score   │
         │         └──────────┘    └──────────┘
```

***

## Session Management

```
Login Flow:
1. User submits credentials to /backend/endpoints/auth.php?action=login
2. AuthController->login() validates against database
3. On success, session variables are set:
   - $_SESSION['user_id']
   - $_SESSION['role'] (student/teacher/admin)
   - $_SESSION['name']
4. Response includes redirect path based on role
5. Frontend redirects to appropriate page

Role-Based Redirects:
- teacher  → ../../client/pages/instructor_dashboard.html
- student → ../../client/pages/collaborations.html
- admin   → ../../client/pages/dashboard.html
```

***

## HRIS Integration (Faculty Sync)

```
External HRIS System
        │
        │ POST with X-API-Key header
        ▼
backend/api/get_faculty.php
        │
        ├── Verifies API Key
        │
        ▼
   Action: sync_faculty
        │
        ├── 1. Sync Departments (force exact ID match)
        ├── 2. Sync Positions (force exact ID match)
        └── 3. Process Faculty (insert/update by hris_id or email)
             │
             └── Generates temp password "FAC-XXXXXX" for new faculty
```

***

## WebSocket Real-Time Features

```
Frontend (collaborations.html)
        │
        │ Connect to ws://localhost:8080
        ▼
server/ws/server.js
        │
        ├── 1. Verify enrollment (query MySQL)
        ├── 2. Process events:
        │     - POST_MESSAGE: Award XP (+10)
        │     - ATTENDANCE: Track join/leave
        │
        └── 3. Maintain in-memory state:
              - xpTracker: { student_id: total_xp }
              - activeClasses: { class_id: Set(student_ids) }
```

***

## Security Features

| Feature                  | Implementation                                            |
| ------------------------ | --------------------------------------------------------- |
| Session Authentication   | `$_SESSION['user_id']` checked on all protected endpoints |
| Role-Based Access        | Role check (`$_SESSION['role']`) for admin-only endpoints |
| CORS                     | Whitelist of allowed origins in `cors.php`                |
| API Key Authentication   | HRIS webhook uses `X-API-Key` header                      |
| Password Hashing         | `password_hash()` with BCRYPT                             |
| SQL Injection Prevention | Prepared statements (`$stmt->bind_param()`)               |
| JSON Error Shielding     | `error_reporting(0)` and `ini_set('display_errors', 0)`   |

### Authentication

ArtisansLMS uses **session-based authentication** with PHP sessions. Users authenticate by providing email and password, which are verified against the database.

**Login Flow:**

```
1. User submits credentials (email + password) to auth endpoint
2. AuthController->login() validates against database
3. User model searches for email in both 'students' and 'employees' tables
4. Password verified using password_verify()
5. On success, session variables are set:
   - $_SESSION['user_id']   → User's unique ID
   - $_SESSION['role']      → 'student', 'teacher', or 'admin'
   - $_SESSION['name']      → User's full name
6. Response includes redirect path based on role
```

### Authorization

**Role-Based Access Control (RBAC):**

| Role      | Description        | Access Level                           |
| --------- | ------------------ | -------------------------------------- |
| `admin`   | Administrator      | Full access to all admin endpoints     |
| `teacher` | Faculty/Instructor | Access to instructor-specific features |
| `student` | Enrolled student   | Access to courses, assignments, grades |

Admin-only endpoints verify role:

```PHP
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
    json_response(['status' => 'error', 'message' => 'Unauthorized access'], 401);
}
```

**Protected Endpoints by Role:**

| Endpoint             | Required Role     |
| -------------------- | ----------------- |
| `courses.php`        | admin             |
| `classes.php`        | admin             |
| `enrollments.php`    | admin             |
| `students.php`       | admin             |
| `instructors.php`    | admin             |
| `dashboard.php`      | admin, teacher    |
| `quizzes.php`        | student, teacher  |
| `assignments.php`    | student, teacher  |
| `grades.php`         | student           |
| `messages.php`       | all authenticated |
| `collaborations.php` | student, teacher  |

### Password Security

**Hashing Algorithm:** Uses Bcrypt via PHP's `password_hash()` function.

```PHP
// Registration - hash new password
$hashed = password_hash($password, PASSWORD_BCRYPT);

// Login - verify password
if (password_verify($password, $user['password'])) {
    // Authentication successful
}
```

**Password Requirements:**

* Minimum 8 characters
* Email format validation

**Temporary Password Generation (HRIS sync):**

```PHP
$chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
$tmp_pass = 'FAC-';
for ($i = 0; $i < 6; $i++) {
    $tmp_pass .= $chars[random_int(0, strlen($chars) - 1)];
}
$hashed = password_hash($tmp_pass, PASSWORD_DEFAULT);
```

### Session Management

```PHP
// Start session if not already started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Validate session on protected endpoints
if (!isset($_SESSION['user_id'])) {
    json_response(['status' => 'error', 'message' => 'Unauthorized']);
    exit;
}

// Logout destroys session
session_destroy();
```

### API Security (HRIS Webhook)

External systems must authenticate using an **API Key**:

```PHP
define('HRIS_WEBHOOK_SECRET', getenv('HRIS_WEBHOOK_SECRET') ?: '81af90f1c04ba06b06bb79ac8c184794');

$received_key = $_SERVER['HTTP_X_API_KEY'] ?? '';

if ($received_key !== HRIS_WEBHOOK_SECRET) {
    json_response(['status' => 'error', 'message' => 'Invalid API Key.'], 401);
}
```

**HRIS Sync Request Flow:**

```
External HRIS System
        │
        │ POST /backend/api/get_faculty.php
        │ Header: X-API-Key: {secret_key}
        │ Body: { "action": "sync_faculty", ... }
        ▼
1. Verify API Key
2. Parse JSON payload
3. Execute sync operations
4. Return success/error response
```

### CORS Configuration

`backend/middleware/cors.php` handles Cross-Origin Resource Sharing:

```PHP
$allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://your-ui-site.vercel.app'
];

header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

// Preflight handling
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
```

### SQL Injection Prevention

All database queries use **prepared statements**:

```PHP
// Safe query with prepared statement
$stmt = $conn->prepare("INSERT INTO students (first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?)");
$stmt->bind_param("ssss", $firstName, $lastName, $email, $hashed);
$stmt->execute();

// Parameter types: i=integer, s=string, d=double, b=blob
```

### Input Validation

```PHP
// Required field validation
if (!$email || !$password) {
    json_response(['status' => 'error', 'message' => 'Email and password are required.']);
}

// Type casting for numeric inputs
$userId = (int)$_SESSION['user_id'];
$courseId = (int)($input['course_id'] ?? 0);

// Email validation
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_response(['status' => 'error', 'message' => 'Invalid email address.']);
}
```

### Error Handling

```PHP
// Shield JSON from HTML errors
error_reporting(0);
ini_set('display_errors', 0);

// Force JSON content type
header('Content-Type: application/json');

// Clean output buffer
ob_clean();
echo json_encode($response);
```

### File Upload Security

```PHP
// Validate upload
if (!isset($_FILES['file_to_upload']) || $_FILES['file_to_upload']['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(["status" => "error", "message" => "Invalid file or upload error."]);
    exit;
}

// Use unique filenames
$new_filename = uniqid('res_') . '.' . $ext;

// Verify uploaded file
if (move_uploaded_file($file['tmp_name'], $dest_path)) {
    // Save to database
}
```

### Security Checklist

| Security Feature         | Status | Implementation File(s)          |
| ------------------------ | ------ | ------------------------------- |
| Session Authentication   | ✅      | All endpoint files              |
| Password Hashing         | ✅      | AuthController.php, profile.php |
| Role-Based Access        | ✅      | Admin endpoints                 |
| SQL Injection Prevention | ✅      | All database queries            |
| CORS Protection          | ✅      | middleware/cors.php             |
| API Key Authentication   | ✅      | api/get\_faculty.php            |
| Input Validation         | ✅      | All endpoint files              |
| Error Shielding          | ✅      | All endpoint files              |
| File Upload Security     | ✅      | endpoints/courses.php           |

### Recommended Enhancements

For production deployment, consider adding:

* HTTPS enforcement
* Session timeout/expiration
* Rate limiting (prevent brute force)
* CSRF tokens for forms
* Account lockout after failed attempts
* Two-factor authentication for admin accounts
* Security event logging

***

## File Dependencies Summary

```
backend/index.php
├── backend/middleware/cors.php
├── backend/middleware/json_response.php
└── backend/endpoints/{route}.php
    ├── server/config/db.php
    ├── server/controllers/{Controller}.php
    │   └── server/models/{Model}.php
    │       └── server/config/db.php
    └── backend/middleware/json_response.php
```

***

## Environment Configuration

* **Local Development (XAMPP)**: Uses `.env` file in project root
* **Production (Render)**: Uses environment variables

Database configuration is read from environment with fallback:

```PHP
$host = getenv('DB_HOST');
$user = getenv('DB_USER');
$pass = getenv('DB_PASS');
$db   = getenv('DB_NAME');
$port = getenv('DB_PORT') ?: 3306;
```

