<?php

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
require "config.php";

$data = json_decode(file_get_contents("php://input"), true);

$message = $data["message"] ?? "";

if (!$message) {
    echo json_encode(["error" => "No message"]);
    exit;
}

$memoryFile = "memory.json";

$memory = [];

if (file_exists($memoryFile)) {
    $temp = json_decode(file_get_contents($memoryFile), true);
    if (is_array($temp)) {
        $memory = $temp;
    }
}

if (!is_array($memory)) {
    $memory = [];
}

if (stripos($message, "remember") !== false) {
    $memory[] = $message;
    if (count($memory) > 20) {
        array_shift($memory); // removes oldest memory
    }

    file_put_contents($memoryFile, json_encode($memory));
}

$memoryText = "";

foreach ($memory as $m) {
    $memoryText .= "- " . $m . "\n";
}

$prompt = "You are LUNEX, an advanced AI assistant inspired by Iron Man.
You are calm, intelligent, precise, and slightly futuristic.

User Memory:
$memoryText

Rules:
- Keep responses short and clear
- Use memory when relevant
- Act like a personal assistant
- If needed, refer to past information

User: " . $message;

$payload = [
    "contents" => [
        [
            "parts" => [
                ["text" => $prompt]
            ]
        ]
    ]
];

$ch = curl_init();

curl_setopt($ch, CURLOPT_URL, "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" . GEMINI_API_KEY);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Content-Type: application/json"]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));

$response = curl_exec($ch);
curl_close($ch);

echo $response;
