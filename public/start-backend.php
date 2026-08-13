<?php
declare(strict_types=1);

const START_BACKEND_ALLOWED_METHODS = 'POST, OPTIONS';

apply_security_headers();

if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'OPTIONS') {
    send_json(['alive' => false, 'error' => 'Method not allowed.'], 405);
}

$config = load_config();
apply_cors_headers($config);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    header('Allow: ' . START_BACKEND_ALLOWED_METHODS);
    exit;
}

if (!is_same_origin_xhr($config)) {
    send_json(['alive' => false, 'error' => 'Forbidden.'], 403);
}

$pm2Bin = $config['backend']['pm2']['bin'] ?? '';
$backendHome = $config['backend']['home'] ?? '';
$platform = $config['platform'] ?? '';

if (!is_safe_absolute_path($pm2Bin) || !is_safe_absolute_path($backendHome) || !is_safe_platform($platform)) {
    send_json(['alive' => false, 'error' => 'Invalid backend startup configuration.'], 500);
}

$response = ['alive' => false];

if (check_alive($pm2Bin, $platform)) {
    $response['alive'] = true;
    send_json($response);
}

$start = run_command([
    $pm2Bin,
    'start',
    '--cwd',
    $backendHome,
    'ecosystem.config.js',
], $backendHome);

if ($start['status'] === 0) {
    run_command([$pm2Bin, 'save'], $backendHome);
}

$response['alive'] = check_alive($pm2Bin, $platform);
send_json($response, $response['alive'] ? 200 : 502);

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
        send_json(['alive' => false, 'error' => 'Server configuration not found.'], 500);
    }

    $config = json_decode($content, true);
    if (!is_array($config) || !isset($config['backend'], $config['studio'])) {
        send_json(['alive' => false, 'error' => 'Server configuration is invalid.'], 500);
    }

    return $config;
}

function check_alive(string $pm2Bin, string $platform): bool
{
    $result = run_command([$pm2Bin, 'jlist']);
    if ($result['status'] !== 0 || $result['stdout'] === '') {
        return false;
    }

    $list = json_decode($result['stdout'], true);
    if (!is_array($list)) {
        return false;
    }

    $expectedName = 'backend-' . $platform;
    foreach ($list as $item) {
        if (($item['name'] ?? '') === $expectedName && ($item['pm2_env']['status'] ?? '') === 'online') {
            return true;
        }
    }

    return false;
}

function run_command(array $args, ?string $cwd = null): array
{
    $command = implode(' ', array_map('escapeshellarg', $args));
    $descriptorSpec = [
        0 => ['pipe', 'r'],
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w'],
    ];

    $process = proc_open($command, $descriptorSpec, $pipes, $cwd ?: null);
    if (!is_resource($process)) {
        return ['status' => 1, 'stdout' => '', 'stderr' => 'Unable to start process.'];
    }

    fclose($pipes[0]);
    $stdout = stream_get_contents($pipes[1]) ?: '';
    $stderr = stream_get_contents($pipes[2]) ?: '';
    fclose($pipes[1]);
    fclose($pipes[2]);

    return [
        'status' => proc_close($process),
        'stdout' => $stdout,
        'stderr' => $stderr,
    ];
}

function is_safe_absolute_path(string $path): bool
{
    return $path !== ''
        && str_starts_with($path, '/')
        && !str_contains($path, '..')
        && preg_match('/^[A-Za-z0-9_\/.+-]+$/', $path) === 1;
}

function is_safe_platform(string $platform): bool
{
    return preg_match('/^[A-Za-z0-9_-]+$/', $platform) === 1;
}

function is_same_origin_xhr(array $config): bool
{
    $requestedWith = $_SERVER['HTTP_X_REQUESTED_WITH'] ?? '';
    if (!is_string($requestedWith) || strtolower($requestedWith) !== 'xmlhttprequest') {
        return false;
    }

    $allowedOrigins = allowed_origins($config);
    if (count($allowedOrigins) === 0) {
        return false;
    }

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (is_string($origin) && $origin !== '') {
        return in_array(rtrim(strtolower($origin), '/'), $allowedOrigins, true);
    }

    $referer = $_SERVER['HTTP_REFERER'] ?? '';
    if (is_string($referer) && $referer !== '') {
        $parts = parse_url($referer);
        if (!is_array($parts) || empty($parts['scheme']) || empty($parts['host'])) {
            return false;
        }

        $port = isset($parts['port']) ? ':' . (int)$parts['port'] : '';
        $refererOrigin = strtolower((string)$parts['scheme']) . '://' . normalize_host((string)$parts['host']) . $port;
        return in_array($refererOrigin, $allowedOrigins, true);
    }

    return false;
}

function apply_security_headers(): void
{
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
}

function apply_cors_headers(array $config): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (!is_string($origin) || $origin === '') {
        return;
    }

    if (!in_array(rtrim(strtolower($origin), '/'), allowed_origins($config), true)) {
        return;
    }

    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: ' . START_BACKEND_ALLOWED_METHODS);
    header('Access-Control-Allow-Headers: Accept, Content-Type, X-Requested-With');
    header('Cache-Control: no-store');
    header('Vary: Origin', false);
}

/**
 * Resolve the exact browser origins allowed to request a backend restart.
 *
 * @param array $config Runtime server configuration.
 * @return array Normalized allowed origins.
 */
function allowed_origins(array $config): array
{
    return array_values(array_filter(array_unique([
        origin_from_config($config['studio'] ?? []),
        origin_from_config($config['site'] ?? []),
    ])));
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

function normalize_host(string $host): string
{
    return rtrim(strtolower($host), '.');
}

function send_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Cache-Control: no-store');
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}
