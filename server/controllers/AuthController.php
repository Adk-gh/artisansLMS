<?php
require_once __DIR__ . '/../../backend/middleware/json_response.php';
require_once __DIR__ . '/../models/User.php';

class AuthController {

    private User $user;

    public function __construct() {
        if (session_status() === PHP_SESSION_NONE) session_start();
        $this->user = new User();
    }

    public function checkSession(): void {
        if (isset($_SESSION['user_id'])) {
            json_response([
                'status'    => 'success',
                'logged_in' => true,
                'user' => [
                    'id'   => $_SESSION['user_id'],
                    'name' => $_SESSION['name'], // Uses the combined name we set in login
                    'role' => $_SESSION['role']
                ],
                'redirect'  => $this->resolveRedirect($_SESSION['role'])
            ]);
        } else {
            json_response(['status' => 'success', 'logged_in' => false]);
        }
    }

    public function login(array $data): void {
        $email    = trim($data['email']    ?? '');
        $password = trim($data['password'] ?? '');

        if (!$email || !$password) {
            json_response(['status' => 'error', 'message' => 'Email and password are required.']);
            return;
        }

        $user = $this->user->findByEmail($email);
        
        // verify the password against the 'password' key returned by the AS alias in User.php
        if (!$user || !password_verify($password, $user['password'])) {
            json_response(['status' => 'error', 'message' => 'Invalid email or password.']);
            return;
        }

        $_SESSION['user_id'] = $user['id'];
        $_SESSION['role']    = $user['role'];
        // Combine names immediately for the header to use
        $_SESSION['name']    = trim($user['first_name'] . ' ' . $user['last_name']);

        json_response([
            'status'   => 'success',
            'redirect' => $this->resolveRedirect($user['role'])
        ]);
    }

    public function logout(): void {
        session_destroy();
        json_response(['status' => 'success', 'redirect' => '../../client/pages/login.html']);
    }

    private function resolveRedirect(string $role): string {
        return match($role) {
            'student'    => '../../client/pages/collaborations.html',
            default      => '../../client/pages/dashboard.html'
        };
    }
    

    // register method to be implemented
    public function register(array $data): void {
    $firstName = trim($data['first_name'] ?? '');
    $lastName  = trim($data['last_name']  ?? '');
    $dob       = trim($data['dob']        ?? '');
    $gender    = trim($data['gender']     ?? '');
    $email     = trim($data['email']      ?? '');
    $password  = trim($data['password']   ?? '');

    // Basic validation
    if (!$firstName || !$lastName || !$dob || !$gender || !$email || !$password) {
        json_response(['status' => 'error', 'message' => 'All fields are required.']);
        return;
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_response(['status' => 'error', 'message' => 'Invalid email address.']);
        return;
    }

    if (strlen($password) < 8) {
        json_response(['status' => 'error', 'message' => 'Password must be at least 8 characters.']);
        return;
    }

    // Check if email already exists
    if ($this->user->findByEmail($email)) {
        json_response(['status' => 'error', 'message' => 'Email is already registered.']);
        return;
    }

    $hashed = password_hash($password, PASSWORD_BCRYPT);

    $created = $this->user->create([
        'first_name' => $firstName,
        'last_name'  => $lastName,
        'dob'        => $dob,
        'gender'     => $gender,
        'email'      => $email,
        'password'   => $hashed,
        'role'       => 'student'
    ]);

    if ($created) {
        json_response(['status' => 'success', 'message' => 'Account created! Redirecting to login...']);
    } else {
        json_response(['status' => 'error', 'message' => 'Registration failed. Please try again.']);
    }
}
}