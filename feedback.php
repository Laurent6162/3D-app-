<?php
// feedback.php - small guestbook backend for the About page
// GET  -> returns latest 20 entries as JSON
// POST -> takes {name, message} as JSON body, writes a row

header('Content-Type: application/json');

$db = new PDO('sqlite:' . __DIR__ . '/feedback.sqlite');
$db->exec("CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)");

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    $name = trim($body['name'] ?? '');
    $msg  = trim($body['message'] ?? '');

    if ($name === '' || $msg === '') {
        http_response_code(400);
        echo json_encode(['error' => 'name and message required']);
        exit;
    }

    $stmt = $db->prepare('INSERT INTO feedback (name, message) VALUES (?, ?)');
    $stmt->execute([$name, $msg]);
    echo json_encode(['ok' => true]);
    exit;
}

// GET: list
$rows = $db->query('SELECT name, message, created_at FROM feedback ORDER BY id DESC LIMIT 20')
           ->fetchAll(PDO::FETCH_ASSOC);
echo json_encode($rows);
