<?php
function oe_admin_private_dir(): string
{
    $configured = getenv('OE_ADMIN_PRIVATE_DIR');
    if ($configured !== false && $configured !== '') return rtrim($configured, DIRECTORY_SEPARATOR);
    return dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'private';
}

function oe_admin_config_path(): string
{
    return oe_admin_private_dir() . DIRECTORY_SEPARATOR . 'admin-config.php';
}

function oe_admin_start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name('oe_admin_session');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/admin/',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

function oe_admin_json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, private');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function oe_admin_escape(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function oe_admin_replace_data_cms(string $html, string $field, string $value): string
{
    $field = preg_quote($field, '~');
    $pattern = '~(<([a-z][a-z0-9:-]*)\\b[^>]*\\bdata-cms="' . $field . '"[^>]*>).*?(</\\2\\s*>)~is';
    return preg_replace_callback($pattern, static function ($match) use ($value) {
        return $match[1] . oe_admin_escape($value) . $match[3];
    }, $html) ?? $html;
}

function oe_admin_replace_data_attr(string $html, string $attribute, string $value): string
{
    $attribute = preg_quote($attribute, '~');
    $pattern = '~(<([a-z][a-z0-9:-]*)\\b(?=[^>]*\\b' . $attribute . '(?:\\s|>))[^>]*>).*?(</\\2\\s*>)~is';
    return preg_replace_callback($pattern, static function ($match) use ($value) {
        return $match[1] . oe_admin_escape($value) . $match[3];
    }, $html) ?? $html;
}

function oe_admin_replace_id_list(string $html, string $id, array $items): string
{
    $id = preg_quote($id, '~');
    $pattern = '~(<ul\\b(?=[^>]*\\bid="' . $id . '")[^>]*>).*?(</ul\\s*>)~is';
    $list = '';
    foreach ($items as $item) {
        if (is_string($item) && trim($item) !== '') $list .= '<li>' . oe_admin_escape(trim($item)) . '</li>';
    }
    return preg_replace_callback($pattern, static function ($match) use ($list) { return $match[1] . $list . $match[2]; }, $html, 1) ?? $html;
}

function oe_admin_update_timeline(string $html, array $career): string
{
    $entries = '';
    foreach ($career as $entry) {
        if (!is_array($entry)) continue;
        $year = trim((string)($entry['year'] ?? ''));
        $achievements = $entry['achievements'] ?? [];
        if ($year === '' || !is_array($achievements)) continue;
        $items = '';
        foreach ($achievements as $achievement) {
            if (is_string($achievement) && trim($achievement) !== '') $items .= '<li>' . oe_admin_escape(trim($achievement)) . '</li>';
        }
        if ($items === '') continue;
        $entries .= '<li class="career-timeline-item"><span class="career-year">' . oe_admin_escape($year) . '</span><div><ul>' . $items . '</ul></div></li>';
    }
    $pattern = '~(<ol\\b(?=[^>]*\\bclass="[^"]*\\bcareer-timeline\\b[^"]*")[^>]*>).*?(</ol\\s*>)~is';
    return preg_replace_callback($pattern, static function ($match) use ($entries) { return $match[1] . $entries . $match[2]; }, $html, 1) ?? $html;
}

function oe_admin_replace_cms_fields(string $html, array $data, string $prefix = ''): string
{
    foreach ($data as $key => $value) {
        if (!is_array($value)) {
            if (is_string($value)) $html = oe_admin_replace_data_cms($html, $prefix . $key, $value);
            continue;
        }
        $html = oe_admin_replace_cms_fields($html, $value, $prefix . $key . '.');
    }
    return $html;
}
