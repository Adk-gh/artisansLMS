<?php
require_once __DIR__ . '/../config/db.php';

class User {

    private $db;

    public function __construct() {
        $this->db = getConnection();
    }

    public function findByEmail(string $email): ?array {
        // 1. Check the STUDENTS table first
        // We use "AS" to rename columns on the fly so AuthController gets what it expects
        $queryStudent = "SELECT student_id AS id, first_name, last_name, email, password_hash AS password, 'student' AS role 
                         FROM students WHERE email = ? LIMIT 1";
        
        $stmt = $this->db->prepare($queryStudent);
        if ($stmt) {
            $stmt->bind_param('s', $email);
            $stmt->execute();
            $result = $stmt->get_result();
            if ($user = $result->fetch_assoc()) {
                return $user; // Found a student, return them
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
                return $user2; // Found an employee, return them
            }
        }

        // 3. User not found in either table
        return null;
    }

    public function create(array $data): bool {
        // Based on your old auth.php, registration creates a STUDENT
        $stmt = $this->db->prepare("
            INSERT INTO students (first_name, last_name, dob, gender, email, password_hash, enrollment_date)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");

        if (!$stmt) {
            return false;
        }

        // Generate the current date for enrollment_date
        $current_date = date('Y-m-d');

        $stmt->bind_param(
            'sssssss',
            $data['first_name'],
            $data['last_name'],
            $data['dob'],
            $data['gender'],
            $data['email'],
            $data['password'], // Note: AuthController passes the hashed password as 'password'
            $current_date
        );
        
        $stmt->execute();
        return $stmt->affected_rows > 0;
    }
}