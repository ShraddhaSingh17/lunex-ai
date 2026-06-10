<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST");

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    echo json_encode([
        "reply" => "Invalid request"
    ]);
    exit;
}

require_once "config.php";

$prompt = $input["prompt"] ??
    "Describe what you see in this image in one short sentence.";

$input = json_decode(file_get_contents("php://input"), true);

$image = $input["image"] ?? "";

$image = preg_replace(
    '/^data:image\/\w+;base64,/',
    '',
    $image
);

if (!$image) {
    echo json_encode([
        "reply" => "No image received"
    ]);
    exit;
}

$data = [
    "contents" => [[
        "parts" => [
            [
                "text" => $prompt
            ],
            [
                "inline_data" => [
                    "mime_type" => "image/png",
                    "data" => $image
                ]
            ]
        ]
    ]]
];

$ch = curl_init();

curl_setopt($ch, CURLOPT_URL, "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" . GEMINI_API_KEY);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Content-Type: application/json"]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));

$response = curl_exec($ch);
curl_close($ch);

$result = json_decode($response, true);
$reply =
    $result["candidates"][0]["content"]["parts"][0]["text"]
    ?? "Unable to analyze image";

echo json_encode([
    "reply" => $reply
]);
