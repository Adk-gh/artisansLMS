# ArtisansLMS - Technology Stack & Architecture Documentation

## Overview

ArtisansLMS is a comprehensive Learning Management System (LMS) built with custom PHP backend, vanilla JavaScript frontend, and MySQL database. It supports multiple user roles including students, instructors, and administrators with features like course management, real-time collaboration, grading, and analytics.

***

## Table of Contents

1. [Technologies Used](#technologies-used)
2. [Security Implementations](#security-implementations)
3. [LMS Features & Architecture](#lms-features--architecture)
4. [Terminology Guide](#terminology-guide)
5. [System Flow](#system-flow)
6. [Database Overview](#database-overview)

***

## Technologies Used

### Backend Technologies

| Technology                     | Version | Purpose                                |
| ------------------------------ | ------- | -------------------------------------- |
| **PHP**                        | >= 8.1  | Server-side scripting and API handling |
| **MySQL** (Aiven Cloud)        | -       | Primary relational database            |
| **PHPMailer**                  | ^7.0    | Email sending via SMTP                 |
| **Brevo** (getbrevo/brevo-php) | ^1.0    | Email API integration                  |

#### Why PHP?

* Lightweight and widely supported on shared hosting
* Direct MySQLi support for database operations
* Session management built-in
* Low learning curve for maintenance

***

### Frontend Technologies

| Technology                      | Purpose                                      |
| ------------------------------- | -------------------------------------------- |
| **Vanilla JavaScript** (ES6+)   | Client-side logic without framework overhead |
| **HTML5**                       | Page structure                               |
| **CSS3** (Bootstrap-influenced) | Styling with responsive design               |
| **Font Awesome**                | Icon library                                 |
| **Fetch API**                   | Asynchronous HTTP requests                   |

#### Why Vanilla JavaScript?

* No build step required
* Faster initial page load
* Easier debugging for small-to-medium projects
* Full control over DOM manipulation

***

### Real-Time Technologies

| Technology                 | Purpose                               |
| -------------------------- | ------------------------------------- |
| **WebSocket (ws library)** | Bidirectional real-time communication |
| **Node.js**                | WebSocket server runtime              |
| **Firebase** (optional)    | Real-time database for production     |

#### What is WebSocket?

WebSocket is a communication protocol that provides full-duplex (two-way) communication channels over a single TCP connection. Unlike HTTP where the client must request and the server responds, WebSocket allows either party to send data at any time - perfect for real-time features like:

* Live attendance tracking
* XP/points updates
* Instant messaging

***

### Database

| Service                      | Details                               |
| ---------------------------- | ------------------------------------- |
| **Aiven MySQL**              | Cloud-hosted MySQL database           |
| **phpMyAdmin** (XAMPP local) | Local development database management |

#### Database Schema Overview

```
students          - Student user records
employees         - Staff/instructor records
courses           - Course definitions
classes           - Class sections tied to courses
enrollments       - Student-class enrollments
assignments       - Course assignments
submissions       - Student assignment submissions
grades            - Student grades
quizzes           - Quiz definitions
quiz_questions    - Quiz question bank
quiz_attempts     - Student quiz attempts
messages          - User-to-user messages
collaborations    - Collaboration room data
course_resources  - Learning materials
departments       - Academic departments
archive_log       - Archive tracking
```

***

## Security Implementations

### 1. Cross-Origin Resource Sharing (CORS)

**File:** `backend/middleware/cors.php`

```PHP
$allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://artisanslms.onrender.com'
];
```

**What it does:**

* Restricts which domains can access your API
* Prevents unauthorized cross-site requests
* Allows cookies for authenticated sessions

**Why it matters:**
Without CORS, malicious websites could make requests to your LMS API using the user's session, potentially exposing grades or personal information.

***

### 2. Session-Based Authentication

**File:** `backend/middleware/session_info.php`

```PHP
if (session_status() === PHP_SESSION_NONE) session_start();

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Not authenticated']);
    exit;
}
```

**What it does:**

* Uses PHP sessions to track logged-in users
* Stores user\_id, role, name, and email in session
* Validates authentication before returning user data

**Session vs JWT:**

* **Session:** Server-side storage, automatically invalidated on logout, harder to scale across servers
* **JWT:** Client-side token, valid until expiration, easier horizontal scaling

This project uses Sessions for simplicity and security with PHP's built-in session handling.

***

### 3. Password Hashing

**File:** `server/controllers/AuthController.php`

**What it does:**

* Uses `password_hash()` with bcrypt algorithm
* Never stores plain-text passwords
* Uses `password_verify()` for login

**Why bcrypt?**

Bcrypt is a password hashing algorithm designed for secure password storage. Here's why it's used:

* **Adaptive Work Factor:** The cost factor (or "work factor") can be increased as hardware improves, making it always resistant to brute force attacks. In PHP, you can set this with `cost => 12` or higher.

* **Built-in Salt:** Bcrypt automatically generates a random 128-bit salt for each password. This means even if two users have the same password, their hashes will be completely different.

* **Slow by Design:** Bcrypt is intentionally slow (unlike fast cryptographic hashes like MD5 or SHA-256). This makes it extremely expensive for attackers to try millions of password combinations.

* **Built into PHP:** No external libraries needed - use `password_hash()` and `password_verify()` functions that are part of PHP core.

**Example Usage:**

```PHP
// Hashing a password (when user registers/changes password)
$hashed = password_hash($plainPassword, PASSWORD_BCRYPT, ['cost' => 12]);

// Verifying login
if (password_verify($inputPassword, $storedHash)) {
    // Password correct
    // Optionally rehash if work factor has increased
    if (password_needs_rehash($storedHash, PASSWORD_BCRYPT, ['cost' => 13])) {
        $newHash = password_hash($inputPassword, PASSWORD_BCRYPT, ['cost' => 13]);
        // Update in database
    }
}
```

**What would happen without it?**
If your database is breached and passwords are stored in plain text or with weak hashes (like MD5), attackers can immediately access all user accounts - including those who reuse passwords on other sites.

***

### 4. SQL Injection Prevention

**File:** `server/config/db.php`

```PHP
$stmt = $conn->prepare("SELECT * FROM users WHERE email = ?");
$stmt->bind_param("s", $email);
```

**What it does:**

* Uses prepared statements with parameterized queries
* Separates SQL logic from data
* Automatically escapes special characters

**Why it matters:**
SQL injection attacks insert malicious SQL code through user inputs. Prepared statements ensure user input is treated as data, not executable code.

***

### 5. Environment Variables (.env)

**File:** `.env`

```env
DB_HOST=mysql-xxx.aivencloud.com
DB_USER=avnadmin
DB_PASS=
```

**What it dos:**

* Stores sensitive credentials outside source control
* Different configurations for development vs production
* Loaded at runtime by `db.php`

**Best Practice:**
Never commit `.env` files to Git. The `.gitignore` should contain `.env` to prevent accidentally exposing credentials.

***

### 6. API Key Authentication

**Files:** `backend/api/*.php`

```PHP
$api_key = $_GET['api_key'] ?? '';
if ($api_key !== getenv('TUITION_API_KEY')) {
    http_response_code(403);
    exit;
}
```

**What it does:**

* Validates API keys for external integrations
* Protects webhook endpoints from unauthorized calls
* Rate limiting can be added per key

***

### 7. Role-Based Access Control (RBAC)

**Session Data:**

```PHP
$_SESSION['role'] = 'student'; // or 'instructor', 'admin'
```

**What it does:**

* Different UI elements shown based on role
* Backend endpoints can filter data by role
* Prevents students from accessing instructor features

***

### 8. WebSocket Enrollment Verification

**File:** `server/ws/server.js`

```JavaScript
function verifyEnrollment(studentId, classId, callback) {
    const query = `SELECT enrollment_id FROM enrollments
                   WHERE student_id = ? AND class_id = ?`;
    db.query(query, [studentId, classId], (err, rows) => {
        callback(rows.length > 0);
    });
}
```

**What it does:**

* Verifies student is actually enrolled before allowing XP or attendance
* Prevents unauthorized students from manipulating class data
* Query happens on each WebSocket event

***

## LMS Features & Architecture

### User Roles

| Role           | Description           | Access Level                                                                 |
| -------------- | --------------------- | ---------------------------------------------------------------------------- |
| **Student**    | Enrolled learners     | View courses, submit assignments, view grades, participate in collaborations |
| **Instructor** | Teachers/faculty      | Create courses, manage classes, grade submissions, view analytics            |
| **Admin**      | System administrators | Full system access, user management, reports                                 |

***

### Core Features

#### 1. Course Management

* Create, edit, archive courses
* Assign instructors to courses
* Upload learning resources (PDF, DOCX, PPT, etc.)
* View course completion statistics

**Endpoint:** `backend/endpoints/courses.php`

#### 2. Class Management

* Create class sections under courses
* Set schedules and capacities
* Manage enrollment periods

**Endpoint:** `backend/endpoints/classes.php`

#### 3. Enrollment System

* Students enroll in available classes
* Track enrollment status
* Handle waitlists

**Endpoint:** `backend/endpoints/enrollments.php`

#### 4. Assignment System

* Create assignments with deadlines
* File upload submissions
* Grading workflow

**Endpoint:** `backend/endpoints/assignments.php`

#### 5. Quiz System

* Create quizzes with multiple questions
* Timed quiz attempts
* Automatic grading

**Endpoint:** `backend/endpoints/quizzes.php`

#### 6. Grading

* Manual and automatic grading
* Grade book per class
* Student grade viewing

**Endpoints:** `backend/endpoints/grades.php`, `backend/endpoints/my_grades.php`

#### 7. Messaging

* Internal messaging between users
* Notifications for assignments and grades
* Message threading

**Endpoint:** `backend/endpoints/messages.php`

#### 8. Collaboration Rooms

* Real-time chat rooms per class
* XP system for participation
* Room request/approval workflow

**Endpoint:** `backend/endpoints/collaborations.php`

#### 9. Analytics & Reporting

* Student performance tracking
* Course completion rates
* Grade distributions
* Export capabilities

**Endpoints:** `backend/endpoints/analytics.php`, `backend/endpoints/reports.php`

#### 10. XP & Gamification

* Points earned for activities
* Achievement boards
* Badges system

**Real-time:** `server/ws/server.js`

***

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   Pages    │  │Components   │  │   JS Mods  │          │
│  │  (HTML)    │  │ (Header,    │  │  (Vanilla  │          │
│  │             │  │  Sidebar)  │  │   JS)      │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└────────────────────────────┬──────────────────────────────────┘
                             │ HTTP/Fetch
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (API)                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ Endpoints  │  │ Middleware  │  │  Export API │          │
│  │            │  │ (CORS, JSON,│  │  (Webhooks) │          │
│  │ auth.php   │  │  Session)   │  │             │          │
│  │ courses.php│  │             │  │             │          │
│  │ grades.php │  │             │  │             │          │
│  │    ...     │  │             │  │             │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└────────────────────────────┬──────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Controllers  │   │   WebSocket  │   │   External   │
│   (PHP)      │   │   Server     │   │     APIs     │
│              │   │  (Node.js)   │   │  (Brevo,     │
│ AuthController│  │              │   │   Firebase) │
│ Dashboard... │   │ Real-time    │   │              │
└──────────────┘   └──────────────┘   └──────────────┘
        │                    │
        ▼                    ▼
┌──────────────┐   ┌──────────────┐
│    MySQL     │   │    In-Memory │
│  Database    │   │    (Runtime) │
│  (Aiven)     │   │    (XP,      │
│              │   │    Active)   │
└──────────────┘   └──────────────┘
```

***

### API Request Flow

```
1. User clicks button in browser
2. JavaScript (modules/xxx.js) calls fetch('/backend/endpoints/xxx.php?action=xxx')
3. Backend endpoint receives request
   a. CORS middleware checks origin
   b. Session middleware validates auth
   c. Endpoint executes controller logic
4. Controller queries database
5. JSON response sent back
6. JavaScript updates DOM
```

***

## Terminology Guide

### Core Terms

| Term                   | Definition                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| **LMS**                | Learning Management System - software for delivering, tracking, and managing educational courses |
| **API**                | Application Programming Interface - how two programs communicate                                 |
| **Endpoint**           | A specific URL path that handles a type of request (e.g., `/backend/endpoints/auth.php`)         |
| **Middleware**         | Software that sits between the request and response, handling cross-cutting concerns             |
| **CORS**               | Cross-Origin Resource Sharing - security mechanism controlling cross-domain requests             |
| **Session**            | Server-side storage of user state across requests                                                |
| **JWT**                | JSON Web Token - alternative to sessions for authentication                                      |
| **CRUD**               | Create, Read, Update, Delete - the four basic database operations                                |
| **Prepared Statement** | SQL query with placeholders that prevents SQL injection                                          |
| **WebSocket**          | Protocol for real-time bidirectional communication                                               |

### LMS-Specific Terms

| Term                   | Definition                                                        |
| ---------------------- | ----------------------------------------------------------------- |
| **Course**             | A complete educational unit containing multiple classes           |
| **Class**              | A specific section of a course with its own schedule and students |
| **Enrollment**         | The action of a student signing up for a class                    |
| **Assignment**         | Task given to students with a deadline                            |
| **Submission**         | Student's submitted work for an assignment                        |
| **Grade**              | Score or evaluation of student work                               |
| **Quiz**               | Timed assessment with multiple questions                          |
| **Resource**           | Learning material (PDF, video, etc.)                              |
| **Collaboration Room** | Real-time chat/workspace for a class                              |
| **XP**                 | Experience Points - gamification metric                           |
| **Badge**              | Achievement earned by students                                    |

### Technical Terms

| Term            | Definition                                               |
| --------------- | -------------------------------------------------------- |
| **MySQLi**      | MySQL Improved extension - PHP's interface to MySQL      |
| **Aiven Cloud** | Managed cloud database service                           |
| **PHP Session** | Built-in PHP mechanism for maintaining user state        |
| **Fetch API**   | Modern JavaScript API for HTTP requests                  |
| **DOM**         | Document Object Model - browser's representation of HTML |
| **ES6**         | ECMAScript 2015 - modern JavaScript standard             |
| **ws**          | Node.js WebSocket library                                |
| **Node.js**     | JavaScript runtime for server-side code                  |
| **PHPMailer**   | PHP library for sending emails via SMTP                  |
| **Brevo**       | Email API service for transactional emails               |
| **Firebase**    | Google's real-time database and authentication service   |

***

## External Integrations

### 1. Classes API

* Export class data to external systems
* API Key: `CLASSES_API_KEY`

### 2. Tuition API

* Sync financial/tuition data
* Webhook endpoint for payment notifications
* API Key: `TUITION_API_KEY`

### 3. Student Performance API

* Export student performance reports
* API Key: `PERF_API_KEY`

### 4. HRIS Faculty API

* Import instructor/faculty data from HR system
* Webhook for real-time updates
* API Key: `HRIS_API_KEY`

### 5. Room Scheduling API

* External room booking system integration
* Real-time room availability via Firebase
* API Key: `SCHEDULING_API_URL`

### 6. Email Services

* **PHPMailer:** SMTP-based email for traditional setups
* **Brevo:** API-based email for modern cloud deployments

***

## Development Workflow

### Local Development (XAMPP)

```
1. Start Apache and MySQL in XAMPP Control Panel
2. Database: Create 'artisansLMS' database in phpMyAdmin
3. Config: .env file with local credentials
4. Access: http://localhost/artisansLMS
```

### Production Deployment (Render)

```
1. Database: Aiven MySQL (cloud-hosted)
2. Backend: PHP service on Render
3. Frontend: Static hosting or CDN
4. WebSocket: Node.js service (optional)
5. Environment: Set variables in Render dashboard
```

***

## Security Checklist

* [x] CORS configured for allowed origins only
* [x] Sessions used for authentication
* [x] Passwords hashed with bcrypt
* [x] Prepared statements for all SQL queries
* [x] API keys for external endpoints
* [x] Role-based access control
* [x] WebSocket enrollment verification
* [x] Environment variables for secrets
* [x] .env in .gitignore

***

## Performance Considerations

* **Database Indexing:** Add indexes on frequently queried columns (student\_id, class\_id, enrollment\_id)
* **Caching:** Consider Redis for session storage in production
* **WebSocket:** Use Firebase or dedicated WebSocket service for horizontal scaling
* **File Uploads:** Consider object storage (S3) for large files
* **Pagination:** Implement for large data sets (messages, enrollments)

***

## Future Enhancements

* Replace empty model files with proper ORM
* Add Redis for session caching
* Implement JWT authentication for API scalability
* Add rate limiting to prevent abuse
* Integrate video conferencing
* Add mobile app support
* Implement SSO (Single Sign-On)

***

## Support & Documentation

* **Project Files:** `PROJECT_FILES_DOCUMENTATION.md`
* **System Flow:** `System.Flow.md`
* **Todo List:** `xtodo.md`

