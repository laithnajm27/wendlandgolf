<?php
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require __DIR__ . '/bootstrap.php';
$readSecret = static function (string $prompt): string {
    fwrite(STDOUT, $prompt);
    $hidden = DIRECTORY_SEPARATOR === '/' && function_exists('shell_exec') && trim((string)shell_exec('stty -g 2>/dev/null')) !== '';
    if ($hidden) shell_exec('stty -echo');
    $value = rtrim((string)fgets(STDIN), "\r\n");
    if ($hidden) shell_exec('stty echo');
    fwrite(STDOUT, "\n");
    return $value;
};
$password = $readSecret('Neues Admin-Passwort eingeben (mindestens 14 Zeichen): ');
if (strlen($password) < 14) {
    fwrite(STDERR, "Das Passwort muss mindestens 14 Zeichen lang sein.\n");
    exit(1);
}
$confirm = $readSecret('Passwort wiederholen: ');
if (!hash_equals($password, $confirm)) {
    fwrite(STDERR, "Die Passwörter stimmen nicht überein.\n");
    exit(1);
}
$directory = oe_admin_private_dir();
if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
    fwrite(STDERR, "Privater Konfigurationsordner konnte nicht angelegt werden.\n");
    exit(1);
}
$config = "<?php\nreturn ['password_hash' => '" . password_hash($password, PASSWORD_DEFAULT) . "'];\n";
$path = oe_admin_config_path();
if (file_put_contents($path, $config, LOCK_EX) === false) {
    fwrite(STDERR, "Admin-Konfiguration konnte nicht geschrieben werden.\n");
    exit(1);
}
@chmod($path, 0600);
fwrite(STDOUT, "Admin-Passwort gesetzt. Konfigurationsdatei: " . $path . "\n");
