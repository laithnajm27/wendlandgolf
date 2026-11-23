<?php
require __DIR__ . '/bootstrap.php';
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('Content-Security-Policy: default-src \'none\'; frame-ancestors \'none\'; base-uri \'none\'; form-action \'self\'');
$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
$host = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
if (!$https && !in_array($host, ['localhost', '127.0.0.1', 'localhost:8000', '127.0.0.1:8000'], true)) oe_admin_json_response(['error' => 'Bitte öffne die Verwaltung über eine HTTPS-Adresse.'], 400);
oe_admin_start_session();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') oe_admin_json_response(['error' => 'Methode nicht erlaubt.'], 405);
$raw = file_get_contents('php://input');
if ($raw === false || strlen($raw) > 400000) oe_admin_json_response(['error' => 'Die Anfrage ist zu groß.'], 413);
$request = json_decode($raw, true);
if (!is_array($request) || !is_string($request['action'] ?? null)) oe_admin_json_response(['error' => 'Ungültige Anfrage.'], 400);
$action = $request['action'];

if ($action === 'login') {
    $configPath = oe_admin_config_path();
    if (!is_file($configPath)) oe_admin_json_response(['error' => 'Der Admin-Zugang wurde noch nicht eingerichtet. Bitte das Passwort-Setup auf dem Webspace ausführen.'], 503);
    $config = require $configPath;
    if (!is_array($config) || !is_string($config['password_hash'] ?? null)) oe_admin_json_response(['error' => 'Die Admin-Konfiguration ist ungültig.'], 500);
    $now = time();
    $lock = $_SESSION['login_lock'] ?? 0;
    if ($lock > $now) oe_admin_json_response(['error' => 'Zu viele Versuche. Bitte in einigen Minuten erneut anmelden.'], 429);
    $password = is_string($request['password'] ?? null) ? $request['password'] : '';
    if (!password_verify($password, $config['password_hash'])) {
        $_SESSION['login_failures'] = (int)($_SESSION['login_failures'] ?? 0) + 1;
        if ($_SESSION['login_failures'] >= 7) {
            $_SESSION['login_lock'] = $now + 600;
            $_SESSION['login_failures'] = 0;
        }
        oe_admin_json_response(['error' => 'Das Passwort stimmt nicht.'], 401);
    }
    session_regenerate_id(true);
    $_SESSION['authenticated'] = true;
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    $_SESSION['login_failures'] = 0;
    oe_admin_json_response(['ok' => true, 'csrf' => $_SESSION['csrf']]);
}

if ($action === 'check') {
    if (empty($_SESSION['authenticated'])) oe_admin_json_response(['authenticated' => false], 401);
    oe_admin_json_response(['authenticated' => true, 'csrf' => $_SESSION['csrf'] ?? '']);
}

if (empty($_SESSION['authenticated'])) oe_admin_json_response(['error' => 'Bitte melde dich erneut an.'], 401);
if ($action === 'logout') {
    if (!hash_equals((string)($_SESSION['csrf'] ?? ''), (string)($request['csrf'] ?? ''))) oe_admin_json_response(['error' => 'Sitzung abgelaufen.'], 403);
    $_SESSION = [];
    session_destroy();
    oe_admin_json_response(['ok' => true]);
}
if (!hash_equals((string)($_SESSION['csrf'] ?? ''), (string)($request['csrf'] ?? ''))) oe_admin_json_response(['error' => 'Sitzung abgelaufen. Bitte neu anmelden.'], 403);

$root = dirname(__DIR__);
$dataDir = $root . DIRECTORY_SEPARATOR . 'data';
$allowed = ['home' => 'home.json', 'training' => 'training.json', 'trainer' => 'trainer.json'];
if ($action === 'load') {
    $data = [];
    foreach ($allowed as $key => $file) {
        $path = $dataDir . DIRECTORY_SEPARATOR . $file;
        $decoded = is_file($path) ? json_decode((string)file_get_contents($path), true) : null;
        if (!is_array($decoded)) oe_admin_json_response(['error' => 'Website-Inhalte konnten nicht gelesen werden.'], 500);
        $data[$key] = $decoded;
    }
    oe_admin_json_response(['data' => $data]);
}
if ($action !== 'save') oe_admin_json_response(['error' => 'Unbekannte Aktion.'], 400);
$incoming = $request['data'] ?? null;
if (!is_array($incoming)) oe_admin_json_response(['error' => 'Die Formulardaten sind ungültig.'], 400);
$documents = [];
foreach ($allowed as $key => $file) {
    if (isset($incoming[$key]) && is_array($incoming[$key])) $documents[$key] = $incoming[$key];
}
if (count($documents) !== count($allowed)) oe_admin_json_response(['error' => 'Bitte lade die Inhalte neu und versuche es erneut.'], 400);

$updates = [];
foreach ($allowed as $key => $file) {
    $json = json_encode($documents[$key], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) oe_admin_json_response(['error' => 'Ein Inhalt konnte nicht verarbeitet werden.'], 400);
    $updates[$dataDir . DIRECTORY_SEPARATOR . $file] = $json . "\n";
}
$home = $documents['home'];
$trainer = $documents['trainer'];
$training = $documents['training'];
$indexPath = $root . DIRECTORY_SEPARATOR . 'index.html';
$index = is_file($indexPath) ? (string)file_get_contents($indexPath) : '';
$index = oe_admin_replace_cms_fields($index, $home);
$index = oe_admin_replace_data_attr($index, 'data-cms-trainer-name', (string)($trainer['name'] ?? ''));
$index = oe_admin_replace_data_attr($index, 'id="trainer-intro"', (string)($trainer['intro'] ?? ''));
$updates[$indexPath] = $index;

$trainingPath = $root . DIRECTORY_SEPARATOR . 'training.html';
$trainingHtml = is_file($trainingPath) ? (string)file_get_contents($trainingPath) : '';
$trainingHtml = oe_admin_replace_cms_fields($trainingHtml, $training);
$trainingHtml = oe_admin_replace_id_list($trainingHtml, 'training-benefits', $training['offer']['benefits'] ?? []);
$trainingHtml = oe_admin_replace_id_list($trainingHtml, 'individual-benefits', $training['individual']['benefits'] ?? []);
$updates[$trainingPath] = $trainingHtml;

$aboutPath = $root . DIRECTORY_SEPARATOR . 'ueber-mich.html';
$about = is_file($aboutPath) ? (string)file_get_contents($aboutPath) : '';
$about = oe_admin_replace_data_attr($about, 'data-cms-trainer-name', (string)($trainer['name'] ?? ''));
$about = oe_admin_replace_data_attr($about, 'data-cms-trainer-intro', (string)($trainer['intro'] ?? ''));
$about = oe_admin_update_timeline($about, $trainer['career'] ?? []);
$updates[$aboutPath] = $about;

$originals = [];
foreach ($updates as $path => $contents) {
    $originals[$path] = is_file($path) ? (string)file_get_contents($path) : null;
}
$written = [];
foreach ($updates as $path => $contents) {
    $temp = $path . '.tmp-' . bin2hex(random_bytes(5));
    if (file_put_contents($temp, $contents, LOCK_EX) === false || !rename($temp, $path)) {
        @unlink($temp);
        foreach ($written as $done) {
            if ($originals[$done] === null) @unlink($done);
            else file_put_contents($done, $originals[$done], LOCK_EX);
        }
        oe_admin_json_response(['error' => 'Speichern fehlgeschlagen. Die Änderungen wurden zurückgesetzt.'], 500);
    }
    $written[] = $path;
}
oe_admin_json_response(['ok' => true, 'message' => 'Änderungen gespeichert und in die Seiten übernommen.']);
