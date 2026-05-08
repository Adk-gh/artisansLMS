<?php
// C:\xampp\htdocs\artisansLMS\server\models\User.php
require_once __DIR__ . '/../config/db.php';

class User {

    private $db;

    public function __construct() {
        $this->db = getConnection();
    }

    public function findByEmail(string $email): ?array {
        // 1. Check the STUDENTS table first
        $queryStudent = "SELECT student_id AS id, first_name, last_name, email, password_hash AS password, 'student' AS role
                         FROM students WHERE email = ? LIMIT 1";

        $stmt = $this->db->prepare($queryStudent);
        if ($stmt) {
            $stmt->bind_param('s', $email);
            $stmt->execute();
            $result = $stmt->get_result();
            if ($user = $result->fetch_assoc()) {
                return $user;
            }
        }

        // 2. If not a student, check the EMPLOYEES table
        $queryEmployee = "SELECT employee_id AS id, first_name, last_name, email, password_hash AS password,
                                 IF(is_faculty = 1, 'teacher', 'admin') AS role
                          FROM employees WHERE email = ? LIMIT 1";

        $stmt2 = $this->db->prepare($queryEmployee);
        if ($stmt2) {
            $stmt2->bind_param('s', $email);
            $stmt2->execute();
            $result2 = $stmt2->get_result();
            if ($user2 = $result2->fetch_assoc()) {
                return $user2;
            }
        }

        // 3. User not found in either table
        return null;
    }

    public function create(array $data): bool {
        $stmt = $this->db->prepare("
            INSERT INTO students
                (first_name, last_name, dob, gender, email, password_hash, department_id, enrollment_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");

        if (!$stmt) return false;

        $current_date = date('Y-m-d');
        $dept_id      = $data['department_id'] ?? null;

        // s=string, i=integer — dept_id is nullable int
        $stmt->bind_param(
            'ssssssis',
            $data['first_name'],
            $data['last_name'],
            $data['dob'],
            $data['gender'],
            $data['email'],
            $data['password'],
            $dept_id,
            $current_date
        );

        $stmt->execute();
        return $stmt->affected_rows > 0;
    }
}