<?php

class MessagesController {
    private $conn;

    public function __construct($db_connection) {
        $this->conn = $db_connection;
    }

    public function getInitialChatData($user_id, $role, $user_name) {
        $my_uid = ($role === 'student' ? 'S_' : 'E_') . $user_id;
        $all_users = [];

        // Fetch Students
        $student_res = $this->conn->query("SELECT CONCAT('S_', student_id) as uid, CONCAT(first_name, ' ', last_name) as name, 'Student' as role, student_id as display_id FROM students");
        if ($student_res) {
            while ($row = $student_res->fetch_assoc()) { 
                if ($row['uid'] !== $my_uid) {
                    $all_users[] = $row; 
                }
            }
        }

        // Fetch Employees / Teachers
        $emp_res = $this->conn->query("SELECT CONCAT('E_', employee_id) as uid, CONCAT(first_name, ' ', last_name) as name, 'Teacher' as role, employee_id as display_id FROM employees WHERE is_faculty = 1");
        if ($emp_res) {
            while ($row = $emp_res->fetch_assoc()) { 
                if ($row['uid'] !== $my_uid) {
                    $all_users[] = $row; 
                }
            }
        }

        // Sort alphabetically by name
        usort($all_users, fn($a, $b) => strcmp($a['name'], $b['name']));

        return [
            'my_uid' => $my_uid,
            'my_name' => $user_name,
            'all_users' => $all_users
        ];
    }
}