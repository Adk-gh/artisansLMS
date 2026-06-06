# ArtisansLMS

A comprehensive Learning Management System (LMS) built with PHP, MySQL, and Node.js. Supports multiple user roles (students, instructors, admins) with features like course management, real-time collaboration, grading, analytics, and gamification.

***

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Technology Stack](#technology-stack)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Running the Application](#running-the-application)
6. [WebSocket Server Setup](#websocket-server-setup)
7. [External Integrations](#external-integrations)
8. [Default Users & Roles](#default-users--roles)
9. [Project Structure](#project-structure)
10. [Troubleshooting](#troubleshooting)

***

## System Requirements

| Requirement    | Version      | Description                     |
| -------------- | ------------ | ------------------------------- |
| **PHP**        | >= 8.1       | Server-side scripting           |
| **MySQL**      | 5.7+         | Database (XAMPP or Aiven Cloud) |
| **Node.js**    | 14+          | WebSocket server runtime        |
| **npm**        | 6+           | Node.js package manager         |
| **Web Server** | Apache/Nginx | Local development with XAMPP    |

### Development Tools (Optional)

* **XAMPP** - Local Apache, MySQL, PHP stack
* **phpMyAdmin** - Database management (included with XAMPP)
* **Composer** - PHP dependency manager
* **Git** - Version control

***

## Technology Stack

### Backend

| Technology | Version | Purpose                  |
| ---------- | ------- | ------------------------ |
| PHP        | >= 8.1  | Server-side API handling |
| PHPMailer  | ^7.0    | SMTP email sending       |
| Brevo SDK  | ^1.0    | Email API integration    |

### Frontend

| Technology                | Purpose                    |
| ------------------------- | -------------------------- |
| Vanilla JavaScript (ES6+) | Client-side logic          |
| HTML5                     | Page structure             |
| CSS3                      | Responsive styling         |
| Font Awesome              | Icon library               |
| Fetch API                 | Asynchronous HTTP requests |

### Real-Time

| Technology   | Purpose                         |
| ------------ | ------------------------------- |
| Node.js      | WebSocket server runtime        |
| ws (library) | WebSocket communication         |
| Firebase     | Real-time database (production) |

### Database

| Technology          | Purpose             |
| ------------------- | ------------------- |
| MySQL (Aiven Cloud) | Production database |
| MySQL (XAMPP)       | Local development   |

***

## Installation

### 1. Clone the Repository

```Shell
git clone <repository-url> artisansLMS
cd artisansLMS
```

### 2. Install PHP Dependencies

If using Composer locally:

```Shell
composer install
```

Or via Docker (dependencies are installed automatically):

```Shell
# The Dockerfile handles composer install automatically
```

### 3. Install Node.js Dependencies (WebSocket Server)

```Shell
cd server/ws
npm install
```

### 4. Set Up the Database

#### Option A: Local Development with XAMPP

1. Start Apache and MySQL in XAMPP Control Panel
2. Open phpMyAdmin (<http://localhost/phpmyadmin>)
3. Create a new database named `artisansLMS`
4. Import the database schema (if provided)

#### Option B: Production with Aiven MySQL

1. Create an account at [Aiven](https://aiven.io/)
2. Create a new MySQL service
3. Note the connection credentials (host, port, user, password)

***

## Configuration

### 1. Environment Variables (.env)

Create a `.env` file in the project root directory:

```env
# =======================
# DATABASE (Aiven MySQL)
# =======================
DB_HOST=your_database_host
DB_USER=your_database_user
DB_PASS=your_database_password
DB_NAME=artisansLMS
DB_PORT=3306

# =======================
# API KEYS FOR EXTERNAL INTEGRATIONS
# =======================

# Classes API
CLASSES_API_KEY=your_classes_api_key_here

# Tuition API
TUITION_API_KEY=your_tuition_api_key_here
TUITION_WEBHOOK_SECRET=your_tuition_webhook_secret_here

# Student Performance API
PERF_API_KEY=your_perf_api_key_here

# HRIS Faculty API
HRIS_API_KEY=your_hris_api_key_here
HRIS_WEBHOOK_SECRET=your_hris_webhook_secret_here

# Scheduling/Room API
SCHEDULING_API_URL=http://localhost/api/room_requests.php
LMS_SECRET_TOKEN=your_lms_secret_token_here

# Firebase (optional for production)
FIREBASE_DB_URL=https://your-project.firebaseio.com
FIREBASE_API_KEY=your_firebase_api_key_here
```

### 2. Database Configuration

The application automatically loads environment variables from `.env` file. Make sure your database credentials are correctly configured.

***

## Running the Application

### Option 1: Local Development with XAMPP

1. **Start XAMPP Services**
   * Open XAMPP Control Panel
   * Start Apache
   * Start MySQL

2. **Place Project in Document Root**
   * Copy the project folder to `C:\xampp\htdocs\artisansLMS` (Windows)
   * Or to `/opt/lampp/htdocs/artisansLMS` (Linux/Mac)

3. **Access the Application**
   * Open your browser and navigate to:
   ```
   http://localhost/artisansLMS
   ```

4. **Start the WebSocket Server** (for real-time features)
   ```Shell
   cd server/ws
   node server.js
   ```
   * WebSocket runs on `ws://localhost:8080`

### Option 2: Using Docker

1. **Build and Run the Container**
   ```Shell
   docker build -t artisans-lms .
   docker run -p 8080:80 artisans-lms
   ```

2. **Access the Application**
   * Open your browser and navigate to:
   ```
   http://localhost:8080
   ```

### Option 3: Production Deployment (Render)

1. **Set Up Database**
   * Use Aiven MySQL for the database
   * Set environment variables in Render dashboard

2. **Deploy Backend**
   * Create a PHP web service on Render
   * Connect to your Git repository
   * Set environment variables in Render

3. **Deploy WebSocket Server** (optional)
   * Create a Node.js web service
   * Set environment variables for database connection

***

## WebSocket Server Setup

The WebSocket server handles real-time features like:

* Live attendance tracking
* XP/points updates
* Instant messaging in collaboration rooms

### Starting the WebSocket Server

```Shell
# Navigate to WebSocket directory
cd server/ws

# Install dependencies (first time only)
npm install

# Start the server
node server.js
```

### WebSocket Configuration

The WebSocket server connects to MySQL with these default settings (editable in `server/ws/server.js`):

```JavaScript
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'itprofel3'
});
```

### WebSocket Port

* **Port**: 8080
* **Connection URL**: `ws://localhost:8080`

***

## External Integrations

### Email Services

#### PHPMailer (SMTP)

* Used for traditional email sending
* Configure SMTP settings in your PHP code

#### Brevo (Email API)

* Modern cloud-based email service
* Install: `composer require getbrevo/brevo-php`
* Configure API key in .env

### Firebase (Optional)

* Real-time database for production WebSocket
* Configure in .env file:
  * `FIREBASE_DB_URL`
  * `FIREBASE_API_KEY`

***

## Default Users & Roles

| Role           | Description           | Access                                            |
| -------------- | --------------------- | ------------------------------------------------- |
| **Student**    | Enrolled learners     | View courses, submit assignments, view grades     |
| **Instructor** | Teachers/faculty      | Create courses, manage classes, grade submissions |
| **Admin**      | System administrators | Full system access, user management, reports      |

*Contact your system administrator to create initial user accounts.*

***

## Project Structure

```
artisansLMS/
├── .env                    # Environment variables
├── composer.json           # PHP dependencies
├── Dockerfile              # Docker configuration
├── README.md               # This file
├── TECHNOLOGY_STACK.md    # Detailed tech documentation
│
├── backend/
│   ├── api/               # External API endpoints
│   ├── endpoints/         # Main API endpoints
│   ├── middleware/        # CORS, session, JSON headers
│   └── models/            # Data models
│
├── server/
│   ├── config/            # Database configuration
│   ├── controllers/       # Business logic
│   └── ws/                # WebSocket server
│       ├── server.js      # WebSocket main file
│       └── package.json   # Node.js dependencies
│
├── public/
│   ├── components/        # Reusable UI components
│   ├── pages/             # Page templates
│   ├── styles/            # CSS files
│   └── modules/           # JavaScript modules
│
└── vendor/                # Composer dependencies
```

***

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed

**Error**: `Database connection failed`

**Solution**:

* Verify MySQL is running
* Check .env credentials are correct
* Ensure database exists

#### 2. WebSocket Connection Failed

**Error**: `Cannot connect to ws://localhost:8080`

**Solution**:

* Ensure Node.js WebSocket server is running
* Check port 8080 is not blocked by firewall

#### 3. PHP Extensions Missing

**Error**: `Call to undefined function mysqli_connect()`

**Solution**:

* Ensure `mysqli` and `pdo_mysql` PHP extensions are enabled
* In XAMPP, enable them in php.ini

#### 4. Session Errors

**Error**: `Session start failed`

**Solution**:

* Check session.save\_path in php.ini is writable
* Ensure cookies are enabled in browser

#### 5. CORS Errors

**Error**: `Access-Control-Allow-Origin` issues

**Solution**:

* Update allowed origins in `backend/middleware/cors.php`
* Ensure your frontend origin is listed

### Getting Help

* Check `TECHNOLOGY_STACK.md` for detailed architecture documentation
* Review `PROJECT_FILES_DOCUMENTATION.md` for file descriptions
* Check system logs for detailed error messages

***

## License

ISC License - See LICENSE file for details

***

## Author

**Aderik P. Bermas**
