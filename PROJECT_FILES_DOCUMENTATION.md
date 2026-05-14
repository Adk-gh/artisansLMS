# ArtisansLMS - Project Files Documentation

## Overview

ArtisansLMS is a Learning Management System (LMS) built with PHP (backend), vanilla JavaScript (frontend), and MySQL database. It supports multiple user roles: students, teachers (instructors), and administrators.

***

## Project Structure

```
artisansLMS/
├── client/                    # Frontend (HTML/CSS/JS)
├── server/                    # Server-side PHP controllers & models
├── backend/                   # API endpoints & middleware
├── vendor/                    # Composer dependencies
├── index.php                  # Main entry point
├── .env                       # Environment configuration
├── composer.json              # Composer dependencies config
├── Dockerfile                 # Docker configuration
├── .php-preview-router.php    # Development preview router
├── System.Flow.md             # System documentation
└── xtodo.md                   # Todo list
```

***

## Working Files

### Root Directory

| File                      | Purpose                                              |
| ------------------------- | ---------------------------------------------------- |
| `index.php`               | Main entry point for the application                 |
| `.env`                    | Environment variables (DB credentials, API keys)     |
| `composer.json`           | Defines PHP dependencies                             |
| `composer.lock`           | Locked versions of dependencies                      |
| `Dockerfile`              | Docker container configuration                       |
| `.php-preview-router.php` | Development server router for HTML preview extension |
| `System.Flow.md`          | System flow documentation                            |
| `xtodo.md`                | Pending task list                                    |

### Backend API (`backend/`)

The backend folder contains API endpoints and middleware that handle all server-side logic.

#### Endpoints (`backend/endpoints/`)

| File                         | Purpose                                                 |
| ---------------------------- | ------------------------------------------------------- |
| `auth.php`                   | Authentication (login, register, logout, session check) |
| `courses.php`                | Course management (CRUD, archiving, resources)          |
| `enrollments.php`            | Student enrollment in classes                           |
| `classes.php`                | Class management                                        |
| `students.php`               | Student management                                      |
| `instructors.php`            | Instructor management                                   |
| `instructors.schedule.php`   | Instructor schedule management                          |
| `instructor_courses.php`     | Courses assigned to instructors                         |
| `instructor_assignments.php` | Assignment management for instructors                   |
| `instructor_dashboard.php`   | Instructor dashboard data                               |
| `assignments.php`            | Assignment management                                   |
| `grades.php`                 | Grade management                                        |
| `my_grades.php`              | Student grades view                                     |
| `my_analytics.php`           | Student analytics                                       |
| `messages.php`               | Messaging system                                        |
| `collaborations.php`         | Collaboration rooms                                     |
| `archived.php`               | Archived courses/classes                                |
| `resources.php`              | Course resources                                        |
| `quizzes.php`                | Quiz management                                         |
| `analytics.php`              | Analytics data                                          |
| `reports.php`                | Report generation                                       |
| `profile.php`                | User profile management                                 |
| `dashboard.php`              | Admin dashboard data                                    |

#### Middleware (`backend/middleware/`)

| File                | Purpose                                    |
| ------------------- | ------------------------------------------ |
| `cors.php`          | CORS headers for cross-origin API requests |
| `json_response.php` | Helper function for JSON responses         |
| `session_info.php`  | Session management utilities               |

#### API Export Scripts (`backend/api/`)

| File                             | Purpose                            |
| -------------------------------- | ---------------------------------- |
| `export_classes.php`             | Export class data                  |
| `export_student_performance.php` | Export student performance reports |
| `export_tuition.php`             | Export tuition/financial data      |
| `get_faculty.php`                | Get faculty/instructor data        |
| `webhook_room.php`               | Webhook for collaboration rooms    |
| `webhook_tuition.php`            | Webhook for tuition payments       |

### Server-Side PHP (`server/`)

#### Controllers (`server/controllers/`)

| File                                 | Purpose                                         |
| ------------------------------------ | ----------------------------------------------- |
| `AuthController.php`                 | Authentication logic (login, register, session) |
| `AnalyticsController.php`            | Analytics processing                            |
| `AssignmentController.php`           | Assignment CRUD operations                      |
| `CollaborationsController.php`       | Collaboration room logic                        |
| `DashboardController.php`            | Dashboard data processing                       |
| `InstructorAssignmentController.php` | Instructor assignment management                |
| `MessagesController.php`             | Messaging logic                                 |

#### Models (`server/models/`)

| File             | Purpose                                               |
| ---------------- | ----------------------------------------------------- |
| `User.php`       | User authentication and creation (ONLY WORKING MODEL) |
| `Assignment.php` | (Empty - not used)                                    |
| `Class_.php`     | (Empty - not used)                                    |
| `Course.php`     | (Empty - not used)                                    |
| `Enrollment.php` | (Empty - not used)                                    |
| `Grade.php`      | (Empty - not used)                                    |
| `Message.php`    | (Empty - not used)                                    |
| `Quiz.php`       | (Empty - not used)                                    |
| `Resource.php`   | (Empty - not used)                                    |

#### Configuration (`server/config/`)

| File            | Purpose                                |
| --------------- | -------------------------------------- |
| `db.php`        | Database connection function (ACTIVE)  |
| `db copy.php`   | Old database config (backup, not used) |
| `composer.json` | Server config dependencies             |

#### Helpers (`server/helpers/`)

| File               | Purpose                              |
| ------------------ | ------------------------------------ |
| `quiz_handler.php` | Quiz statistics calculation function |

#### WebSocket Server (`server/ws/`)

| File                | Purpose                                                                   |
| ------------------- | ------------------------------------------------------------------------- |
| `server.js`         | Node.js WebSocket server for real-time features (XP tracking, attendance) |
| `package.json`      | Node.js dependencies for WebSocket server                                 |
| `package-lock.json` | Locked Node.js dependencies                                               |

### Frontend (`client/`)

#### HTML Pages (`client/pages/`)

| File                          | Purpose                          |
| ----------------------------- | -------------------------------- |
| `login.html`                  | User login page                  |
| `register.html`               | User registration page           |
| `dashboard.html`              | Admin dashboard                  |
| `courses.html`                | Course management (admin)        |
| `classes.html`                | Class management                 |
| `students.html`               | Student management               |
| `instructors.html`            | Instructor management            |
| `instructors.schedule.html`   | Instructor schedule view         |
| `instructor_dashboard.html`   | Instructor dashboard             |
| `instructor_courses.html`     | Instructor's assigned courses    |
| `instructor_assignments.html` | Instructor assignment management |
| `grades.html`                 | Grade view                       |
| `my_grades.html`              | Student's grades                 |
| `my_analytics.html`           | Student analytics                |
| `enrollment.html`             | Enrollment management            |
| `todo.html`                   | Todo/task page                   |
| `archived.html`               | Archived items                   |
| `collaborations.html`         | Collaboration rooms              |
| `messages.html`               | Messaging interface              |
| `profile.html`                | User profile                     |
| `modules.html`                | Modules page                     |
| `reports.html`                | Reports page                     |

#### Components (`client/components/`)

| File           | Purpose                    |
| -------------- | -------------------------- |
| `header.html`  | Reusable header component  |
| `sidebar.html` | Reusable sidebar component |

#### JavaScript (`client/assets/js/`)

| File                                     | Purpose                                   |
| ---------------------------------------- | ----------------------------------------- |
| `app.js`                                 | Main application initialization & routing |
| `modules/auth.js`                        | Authentication handling                   |
| `modules/header.js`                      | Header component logic                    |
| `modules/profile.js`                     | Profile management                        |
| `modules/tasks.js`                       | Task management                           |
| `modules/dashboard.js`                   | Dashboard logic                           |
| `modules/courses.js`                     | Course management                         |
| `modules/students.js`                    | Student management                        |
| `modules/enrollment.js`                  | Enrollment logic                          |
| `modules/instructor_courses.js`          | Instructor courses                        |
| `modules/instructor_dashboard.js`        | Instructor dashboard                      |
| `modules/instructor_assignments.js`      | Instructor assignments                    |
| `modules/my_analytics.js`                | Student analytics                         |
| `modules/my_grades.js`                   | Student grades                            |
| `modules/instructors.js`                 | Instructor management                     |
| `modules/classes.js`                     | Class management                          |
| `modules/instructors.schedule.js`        | Instructor schedule                       |
| `modules/archived.js`                    | Archived items                            |
| `modules/collaborations.js`              | Collaboration rooms                       |
| `modules/collaborations_room_request.js` | Room join requests                        |
| `modules/messages.js`                    | Messaging                                 |
| `modules/reports.js`                     | Report generation                         |
| `modules/modules.js`                     | General modules                           |

#### CSS (`client/assets/css/`)

| File        | Purpose         |
| ----------- | --------------- |
| `style.css` | Main stylesheet |

#### Assets (`client/assets/`)

| Directory  | Purpose                                                   |
| ---------- | --------------------------------------------------------- |
| `img/`     | Static images (logos, icons)                              |
| `uploads/` | User uploaded files (assignments, submissions, resources) |

***

## Files That Are Not Needed / Unused

### Empty Model Files

These model files exist but are completely empty (0 bytes) and do nothing:

* `server/models/Assignment.php`
* `server/models/Class_.php`
* `server/models/Course.php`
* `server/models/Enrollment.php`
* `server/models/Grade.php`
* `server/models/Message.php`
* `server/models/Quiz.php`
* `server/models/Resource.php`

**Recommendation:** These empty model files should be deleted as the application uses direct SQL queries in endpoints rather than an ORM/Model pattern.

### Backup Files

* `server/config/db copy.php` - This is a duplicate/backup of `db.php` and is not used

### Todo/Development Files

* `xtodo.md` - A simple todo list file that should be cleaned up or converted to proper task tracking

### Documentation

* `System.Flow.md` - System flow documentation (may be useful but can be moved to a docs folder)

### Unused Helper Files

* `server/helpers/quiz_handler.php` - Contains only a `calculateQuizStats` function that doesn't appear to be actively used in the codebase

***

## Dependencies (vendor/)

The `vendor/` directory contains Composer dependencies:

* **guzzlehttp/guzzle** - HTTP client for API requests
* **guzzlehttp/promises** - Promise library for Guzzle
* **phpmailer/phpmailer** - Email sending library
* **psr/http-client** - PSR HTTP Client interface
* **psr/http-factory** - PSR HTTP Factory interfaces
* **psr/http-message** - PSR HTTP Message interfaces
* **ralouphie/getallheaders** - Get all HTTP headers polyfill

***

## Database

* **Database Name:** `itprofel3`
* **Tables:** students, employees, courses, classes, enrollments, assignments, submissions, grades, quizzes, quiz\_questions, quiz\_attempts, messages, collaborations, course\_resources, departments, archive\_log

***

## Summary

* **Active PHP Backend:** `backend/endpoints/` - All API logic is here
* **Active Controllers:** `server/controllers/` - Only AuthController is actively used
* **Active Models:** Only `User.php` is functional
* **Frontend:** Vanilla JS in `client/assets/js/modules/`
* **Real-time:** WebSocket server in `server/ws/server.js`

