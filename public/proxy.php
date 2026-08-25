<?php
declare(strict_types=1);

/**
 * LGS1920 backend proxy.
 *
 * This proxy is intentionally narrow: it only forwards requests to the backend
 * declared in servers.json and explicit external services required by the app.
 * It is not a generic cross-domain proxy.
 */

const PROXY_DEBUG_ENV = 'LGS1920_PROXY_DEBUG';
const CLOUD_SESSION_COOKIE = 'lgs_cloud_session';

const REQUEST_HEADER_ALLOWLIST = [
    'Accept',
    'Accept-Language',
    'Content-Type',
    'Origin',
    'X-Requested-With',
];

const RESPONSE_HEADER_ALLOWLIST = [
    'Cache-Control',
    'Content-Disposition',
    'Content-Length',
    'Content-Type',
    'ETag',
    'Expires',
    'Last-Modified',
    'Location',
    'X-Accel-Buffering',
];

const HOP_BY_HOP_HEADERS = [
    'Connection',
    'Keep-Alive',
    'Proxy-Authenticate',
    'Proxy-Authorization',
    'TE',
    'Trailer',
    'Transfer-Encoding',
    'Upgrade',
];

const EXTERNAL_PROXY_TARGETS = [
    [
        'host' => 'nominatim.openstreetmap.org',
        'scheme' => 'https',
        'port' => 443,
    ],
    [
        'host' => 'wms.pcn.minambiente.it',
        'scheme' => 'https',
        'port' => 443,
    ],
    [
        'host' => 'wms.pcn.minambiente.it',
        'scheme' => 'http',
        'port' => 80,
    ],
];

$config = load_config();
apply_security_headers();
apply_cors_headers($config);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    header('Allow: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    exit;
}

try {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($method, ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], true)) {
        send_error(405, 'Method not allowed.');
    }

    $targetUrl = resolve_target_url();
    validate_target_url($targetUrl, $config);
    ensure_curl_available();

    $isEventStream = is_event_stream_request($targetUrl);
    $requestHeaders = build_request_headers($isEventStream);

    if ($method === 'GET') {
        $targetUrl = append_passthrough_query($targetUrl);
    }

    if ($isEventStream) {
        stream_event_response($targetUrl, $requestHeaders);
        exit;
    }

    proxy_standard_response($targetUrl, $method, $requestHeaders);
}
catch (Throwable $error) {
    $status = (int)($error->getCode() ?: 500);
    if ($status < 400 || $status > 599) {
        $status = 500;
    }
    send_error($status, $error->getMessage());
}

function load_config(): array
{
    $content = false;
    foreach ([__DIR__ . '/servers.json', dirname(__DIR__) . '/servers.json'] as $configPath) {
        $content = @file_get_contents($configPath);
        if ($content !== false) {
            break;
        }
    }

    if ($content === false) {
        send_error(500, 'Proxy configuration not found.');
    }

    $config = json_decode($content, true);
    if (!is_array($config) || !isset($config['backend'], $config['studio'])) {
        send_error(500, 'Proxy configuration is invalid.');
    }

    foreach (['domain', 'protocol', 'port'] as $key) {
        if (!isset($config['backend'][$key]) || $config['backend'][$key] === '') {
            send_error(500, 'Backend proxy configuration is incomplete.');
        }
    }

    return $config;
}

function resolve_target_url(): string
{
    $raw = $_GET['csurl'] ?? $_POST['csurl'] ?? $_SERVER['HTTP_X_PROXY_URL'] ?? '';
    if (!is_string($raw) || trim($raw) === '') {
        send_error(404, 'Missing target URL.');
    }

    if (preg_match('/[\r\n]/', $raw)) {
        send_error(400, 'Invalid target URL.');
    }

    return trim($raw);
}

function validate_target_url(string $url, array $config): void
{
    $parts = parse_url($url);
    if (!is_array($parts) || empty($parts['scheme']) || empty($parts['host'])) {
        send_error(400, 'Invalid target URL.');
    }

    if (isset($parts['user']) || isset($parts['pass'])) {
        send_error(400, 'Target URL credentials are not allowed.');
    }

    $scheme = strtolower((string)$parts['scheme']);
    if (!in_array($scheme, ['http', 'https'], true)) {
        send_error(400, 'Target URL protocol is not allowed.');
    }

    $host = normalize_host((string)$parts['host']);
    $port = isset($parts['port']) ? (int)$parts['port'] : default_port($scheme);

    foreach (allowed_targets($config) as $allowed) {
        if (
            $host === $allowed['host']
            && $scheme === $allowed['scheme']
            && $port === $allowed['port']
        ) {
            return;
        }
    }

    send_error(403, 'Target backend is not allowed.');
}

function allowed_targets(array $config): array
{
    $scheme = strtolower((string)$config['backend']['protocol']);
    $port = (int)$config['backend']['port'];
    $targets = [[
        'host' => normalize_host((string)$config['backend']['domain']),
        'scheme' => $scheme,
        'port' => $port,
    ]];

    if (($config['platform'] ?? '') === 'development') {
        $targets[] = ['host' => '127.0.0.1', 'scheme' => $scheme, 'port' => $port];
        $targets[] = ['host' => 'localhost', 'scheme' => $scheme, 'port' => $port];
    }

    return array_merge($targets, EXTERNAL_PROXY_TARGETS);
}

function default_port(string $scheme): int
{
    return $scheme === 'https' ? 443 : 80;
}

function normalize_host(string $host): string
{
    return rtrim(strtolower($host), '.');
}

function append_passthrough_query(string $targetUrl): string
{
    $params = $_GET;
    unset($params['csurl']);

    if (count($params) === 0) {
        return $targetUrl;
    }

    $separator = str_contains($targetUrl, '?') ? '&' : '?';
    return $targetUrl . $separator . http_build_query($params);
}

function is_event_stream_request(string $targetUrl): bool
{
    $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
    if (is_string($accept) && str_contains(strtolower($accept), 'text/event-stream')) {
        return true;
    }

    $parts = parse_url($targetUrl);
    if (!is_array($parts) || empty($parts['query'])) {
        return false;
    }

    parse_str((string)$parts['query'], $query);
    return ($query['sse'] ?? '') === 'true';
}

function build_request_headers(bool $isEventStream): array
{
    $headers = [];
    $allowlist = array_flip(REQUEST_HEADER_ALLOWLIST);
    $hopByHop = array_flip(HOP_BY_HOP_HEADERS);

    foreach ($_SERVER as $key => $value) {
        if (!is_string($value)) {
            continue;
        }

        if ($key === 'CONTENT_TYPE') {
            add_request_header($headers, 'Content-Type', $value, $allowlist, $hopByHop);
            continue;
        }

        if (!str_starts_with($key, 'HTTP_')) {
            continue;
        }

        $name = canonical_header_name(substr($key, 5));
        add_request_header($headers, $name, $value, $allowlist, $hopByHop);
    }

    $cookie = filtered_cookie_header();
    if ($cookie !== '') {
        $headers[] = 'Cookie: ' . $cookie;
    }

    if ($isEventStream) {
        replace_header($headers, 'Accept', 'text/event-stream');
    }

    return array_values(array_unique($headers));
}

function add_request_header(array &$headers, string $name, string $value, array $allowlist, array $hopByHop): void
{
    if (!isset($allowlist[$name]) || isset($hopByHop[$name])) {
        return;
    }

    if (!is_safe_header_value($value)) {
        send_error(400, 'Invalid request header.');
    }

    $headers[] = $name . ': ' . $value;
}

function replace_header(array &$headers, string $name, string $value): void
{
    $prefix = strtolower($name) . ':';
    $headers = array_values(array_filter($headers, static function (string $header) use ($prefix): bool {
        return !str_starts_with(strtolower($header), $prefix);
    }));
    $headers[] = $name . ': ' . $value;
}

function canonical_header_name(string $serverKey): string
{
    return implode('-', array_map(
        static fn(string $part): string => ucfirst(strtolower($part)),
        explode('_', $serverKey)
    ));
}

function is_safe_header_value(string $value): bool
{
    return !preg_match('/[\r\n]/', $value);
}

function filtered_cookie_header(): string
{
    $raw = $_SERVER['HTTP_COOKIE'] ?? '';
    if (!is_string($raw) || $raw === '' || !is_safe_header_value($raw)) {
        return '';
    }

    $cookies = [];
    foreach (explode(';', $raw) as $cookie) {
        $cookie = trim($cookie);
        if (str_starts_with($cookie, CLOUD_SESSION_COOKIE . '=')) {
            $cookies[] = $cookie;
        }
    }

    return implode('; ', $cookies);
}

function proxy_standard_response(string $targetUrl, string $method, array $requestHeaders): void
{
    $responseHeaders = [];
    $ch = create_curl_handle($targetUrl, $requestHeaders, $responseHeaders);
    configure_request_body($ch, $method, $requestHeaders);

    $response = curl_exec($ch);
    $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($response === false) {
        log_debug('cURL error: ' . $curlError);
        send_error(502, 'Backend request failed.');
    }

    http_response_code($httpCode >= 100 ? $httpCode : 502);
    emit_response_headers($responseHeaders);
    echo $response;
}

function create_curl_handle(string $targetUrl, array $requestHeaders, array &$responseHeaders)
{
    $ch = curl_init($targetUrl);
    if ($ch === false) {
        send_error(500, 'Unable to initialize backend request.');
    }

    curl_setopt_array($ch, [
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_FAILONERROR => false,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_HEADER => false,
        CURLOPT_HTTPHEADER => $requestHeaders,
        CURLOPT_NOSIGNAL => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_USERAGENT => 'LGS1920 Studio (studio@lgs1920.fr)',
    ]);

    set_curl_protocols($ch);

    curl_setopt($ch, CURLOPT_HEADERFUNCTION, static function ($curl, string $headerLine) use (&$responseHeaders): int {
        $length = strlen($headerLine);
        $headerLine = trim($headerLine);

        if ($headerLine === '' || !str_contains($headerLine, ':')) {
            return $length;
        }

        [$name, $value] = array_map('trim', explode(':', $headerLine, 2));
        $name = canonical_response_header_name($name);

        if (is_allowed_response_header($name, $value)) {
            $responseHeaders[$name] = $value;
        }

        return $length;
    });

    return $ch;
}

function configure_request_body($ch, string $method, array $requestHeaders): void
{
    if ($method === 'GET') {
        return;
    }

    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
    }
    else {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    }

    if (is_multipart_request() && has_uploaded_files()) {
        $fields = build_multipart_fields();
        remove_content_type_header($requestHeaders);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $requestHeaders);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $fields);
        return;
    }

    $body = file_get_contents('php://input');
    if ($body !== false && $body !== '') {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    }
}

function is_multipart_request(): bool
{
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    return is_string($contentType) && str_contains(strtolower($contentType), 'multipart/form-data');
}

function has_uploaded_files(): bool
{
    foreach ($_FILES as $file) {
        if (is_uploaded_file_entry($file)) {
            return true;
        }
    }

    return false;
}

function is_uploaded_file_entry(array $file): bool
{
    if (isset($file['tmp_name']) && is_string($file['tmp_name'])) {
        return ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK
            && is_uploaded_file($file['tmp_name']);
    }

    if (isset($file['tmp_name']) && is_array($file['tmp_name'])) {
        foreach ($file['tmp_name'] as $index => $tmpName) {
            if (
                is_string($tmpName)
                && (($file['error'][$index] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK)
                && is_uploaded_file($tmpName)
            ) {
                return true;
            }
        }
    }

    return false;
}

function build_multipart_fields(): array
{
    $fields = [];

    foreach ($_POST as $key => $value) {
        if ($key !== 'csurl') {
            $fields[$key] = $value;
        }
    }

    foreach ($_FILES as $field => $file) {
        add_uploaded_file_field($fields, (string)$field, $file);
    }

    return $fields;
}

function add_uploaded_file_field(array &$fields, string $field, array $file): void
{
    if (isset($file['tmp_name']) && is_string($file['tmp_name'])) {
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) {
            return;
        }

        $fields[$field] = new CURLFile(
            $file['tmp_name'],
            safe_mime_type($file['type'] ?? ''),
            basename((string)($file['name'] ?? 'upload'))
        );
        return;
    }

    if (!isset($file['tmp_name']) || !is_array($file['tmp_name'])) {
        return;
    }

    foreach ($file['tmp_name'] as $index => $tmpName) {
        if (
            !is_string($tmpName)
            || (($file['error'][$index] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK)
            || !is_uploaded_file($tmpName)
        ) {
            continue;
        }

        $name = basename((string)($file['name'][$index] ?? 'upload'));
        $type = safe_mime_type((string)($file['type'][$index] ?? ''));
        $fields[$field . '[' . $index . ']'] = new CURLFile($tmpName, $type, $name);
    }
}

function safe_mime_type(string $type): string
{
    return preg_match('/^[A-Za-z0-9][A-Za-z0-9.+-]*\/[A-Za-z0-9][A-Za-z0-9.+-]*$/', $type)
        ? $type
        : 'application/octet-stream';
}

function remove_content_type_header(array &$headers): void
{
    $headers = array_values(array_filter($headers, static function (string $header): bool {
        return !str_starts_with(strtolower($header), 'content-type:');
    }));
}

function stream_event_response(string $targetUrl, array $requestHeaders): void
{
    while (ob_get_level() > 0) {
        @ob_end_flush();
    }

    @ini_set('zlib.output_compression', '0');
    @ini_set('output_buffering', 'off');
    @set_time_limit(0);
    ignore_user_abort(false);

    header('Content-Type: text/event-stream');
    header('Cache-Control: no-cache, no-transform');
    header('Connection: keep-alive');
    header('X-Accel-Buffering: no');

    echo ": SSE proxy initialized\n\n";
    flush();

    $responseHeaders = [];
    $ch = create_curl_handle($targetUrl, $requestHeaders, $responseHeaders);
    curl_setopt_array($ch, [
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_CUSTOMREQUEST => 'GET',
        CURLOPT_HEADER => false,
        CURLOPT_RETURNTRANSFER => false,
        CURLOPT_TIMEOUT => 0,
        CURLOPT_WRITEFUNCTION => static function ($curl, string $data): int {
            echo $data;
            flush();

            return connection_aborted() ? 0 : strlen($data);
        },
    ]);

    if (defined('CURLOPT_TCP_KEEPALIVE')) {
        curl_setopt($ch, CURLOPT_TCP_KEEPALIVE, 1);
    }

    $result = curl_exec($ch);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($result === false && !connection_aborted()) {
        log_debug('SSE cURL error: ' . $curlError);
        echo "event: error\n";
        echo 'data: {"error":"Backend stream failed."}' . "\n\n";
        flush();
    }
}

function set_curl_protocols($ch): void
{
    $protocols = CURLPROTO_HTTP | CURLPROTO_HTTPS;

    if (defined('CURLOPT_PROTOCOLS')) {
        curl_setopt($ch, CURLOPT_PROTOCOLS, $protocols);
    }

    if (defined('CURLOPT_REDIR_PROTOCOLS')) {
        curl_setopt($ch, CURLOPT_REDIR_PROTOCOLS, $protocols);
    }
}

function ensure_curl_available(): void
{
    if (!function_exists('curl_init')) {
        send_error(500, 'The PHP cURL extension is required by the proxy.');
    }
}

function emit_response_headers(array $headers): void
{
    foreach ($headers as $name => $value) {
        if ($name === 'Set-Cookie') {
            header($name . ': ' . $value, false);
            continue;
        }

        header($name . ': ' . $value);
    }
}

function canonical_response_header_name(string $name): string
{
    return implode('-', array_map(
        static fn(string $part): string => ucfirst(strtolower($part)),
        explode('-', $name)
    ));
}

function is_allowed_response_header(string $name, string $value): bool
{
    if (!is_safe_header_value($value)) {
        return false;
    }

    if ($name === 'Set-Cookie') {
        return str_starts_with($value, CLOUD_SESSION_COOKIE . '=');
    }

    return in_array($name, RESPONSE_HEADER_ALLOWLIST, true)
        && !in_array($name, HOP_BY_HOP_HEADERS, true);
}

function apply_security_headers(): void
{
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
}

function apply_cors_headers(array $config): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (!is_string($origin) || $origin === '' || !is_allowed_origin($origin, $config)) {
        return;
    }

    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Accept, X-Requested-With');
    header('Access-Control-Expose-Headers: Content-Disposition');
    header('Vary: Origin', false);
}

function is_allowed_origin(string $origin, array $config): bool
{
    $allowed = [
        origin_from_config($config['studio'] ?? []),
        origin_from_config($config['site'] ?? []),
    ];

    if (($config['platform'] ?? '') === 'development') {
        $allowed[] = 'http://localhost:5173';
        $allowed[] = 'http://dev.lgs1920.fr:5173';
        $allowed[] = 'https://dev.lgs1920.fr';
    }

    return in_array(rtrim($origin, '/'), array_filter($allowed), true);
}

function origin_from_config(array $server): string
{
    if (empty($server['protocol']) || empty($server['domain'])) {
        return '';
    }

    $port = isset($server['port']) && $server['port'] !== ''
        ? ':' . (int)$server['port']
        : '';

    return strtolower((string)$server['protocol']) . '://' . normalize_host((string)$server['domain']) . $port;
}

function send_error(int $status, string $message): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'error' => proxy_debug_enabled() ? $message : public_error_message($status),
    ], JSON_UNESCAPED_SLASHES);
    exit;
}

function public_error_message(int $status): string
{
    return match (true) {
        $status === 400 => 'Bad proxy request.',
        $status === 403 => 'Proxy target is not allowed.',
        $status === 404 => 'Proxy target is missing.',
        $status === 405 => 'Proxy method is not allowed.',
        $status >= 500 => 'Proxy request failed.',
        default => 'Proxy error.',
    };
}

function proxy_debug_enabled(): bool
{
    return getenv(PROXY_DEBUG_ENV) === 'true';
}

function log_debug(string $message): void
{
    if (proxy_debug_enabled()) {
        error_log('[LGS1920 proxy] ' . $message);
    }
}
