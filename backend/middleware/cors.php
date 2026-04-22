<?php
/**
 * cors.php
 * Middleware to allow Cross-Origin Resource Sharing (CORS)
 */

// 1. Define who is allowed to talk to your API.
// For local development, it's usually localhost:3000 or 5173. 
// For production, put your Vercel/Netlify URL here.
$allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://your-ui-site.vercel.app' 
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (in_array($origin, $allowedOrigins)) {
    header("Access-Control-Allow-Origin: $origin");
}

// 2. Allow cookies/sessions to be sent across domains (Crucial for your login system)
header("Access-Control-Allow-Credentials: true");

// 3. Allow these specific methods
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");

// 4. Allow these specific headers (Content-Type is needed for JSON POSTs)
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

// 5. Handle the "Preflight" OPTIONS request
// The browser sends an OPTIONS request before a POST. We just need to say "OK" and stop.
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(); // Stop running the rest of the PHP script
}
?>