<?php
/**
 * AJAX Cross Domain (PHP) Proxy 0.8
 *    by Iacovos Constantinou (http://www.iacons.net)
 *
 * Released under CC-GNU GPL
 *
 * ------------------------------------------------------------
 * ✨ Modified by Christian Denat (christian.denat@orange.fr)
 * ✨ Further modified to add Server-Sent Events (SSE) support
 *
 * ➕ Enhancements:
 *   - Added support for file uploads via multipart/form-data
 *   - Uploaded files are moved to /tmp and passed to backend via `file` field
 *   - Added support for Server-Sent Events (SSE) for real-time event streaming
 *   - Improved documentation and inline comments in English
 *   - Preserved original license and structure
 *
 * ------------------------------------------------------------
 *
 * This proxy forwards HTTP requests to allowed backend domains.
 * It supports GET, POST, PUT, DELETE, and Server-Sent Events (SSE).
 * For file uploads, use multipart/form-data; the backend receives a `file` field with the temp path.
 * For SSE, the client must send an `Accept: text/event-stream` header.
 *
 * Usage:
 *  - Send requests with `csurl` parameter pointing to the backend URL
 *  - For file uploads, use multipart/form-data
 *  - For SSE, include `Accept: text/event-stream` in the request headers
 *  - The backend will receive a `file` field for uploads or stream events for SSE
 */

// Load allowed backend domains from config
$config = json_decode(file_get_contents('./servers.json'), true);
$SETTING_ALLOWED_HOSTS = array(
    $config['backend']['domain'],
    '127.0.0.1',
);

$ALLOWED_HOSTS = isset($SETTING_ALLOWED_HOSTS) ? $SETTING_ALLOWED_HOSTS : array();

// Proxy settings
define('CSAJAX_FILTERS', true);           // Enable domain filtering
define('CSAJAX_FILTER_DOMAIN', true);     // Filter by domain only
define('CSAJAX_DEBUG', false);            // Enable debug messages

$valid_requests = $ALLOWED_HOSTS;

// Collect request headers
$request_headers = array();
$setContentType = true;
$isMultiPart = false;
$isEventStream = false;

foreach ($_SERVER as $key => $value) {
    if (preg_match('/Content.Type/i', $key)) {
        $setContentType = false;
        $content_type = explode(";", $value)[0];
        $isMultiPart = preg_match('/multipart/i', $content_type);
        $request_headers[] = "Content-Type: " . $content_type;
        continue;
    }
    if (preg_match('/Accept/i', $key) && strpos($value, 'text/event-stream') !== false) {
        $isEventStream = true;
        $request_headers[] = "Accept: text/event-stream";
        continue;
    }
    if (substr($key, 0, 5) == 'HTTP_') {
        $headername = str_replace('_', ' ', substr($key, 5));
        $headername = str_replace(' ', '-', ucwords(strtolower($headername)));
        if (!in_array($headername, array('Host', 'X-Proxy-Url'))) {
            $request_headers[] = "$headername: $value";
        }
    }
}

if ($setContentType && !$isEventStream) {
    $request_headers[] = "Content-Type: application/json";
}

// Determine request method and parameters
$request_method = $_SERVER['REQUEST_METHOD'];
if ($request_method == 'GET') {
    $request_params = $_GET;
} elseif ($request_method == 'POST') {
    $request_params = $_POST;
    if (empty($request_params)) {
        $data = file_get_contents('php://input');
        if (!empty($data)) {
            $request_params = $data;
        }
    }
} elseif ($request_method == 'PUT' || $request_method == 'DELETE') {
    $request_params = file_get_contents('php://input');
} else {
    $request_params = null;
}

// Get target URL from `csurl` or `X-Proxy-URL`
if (isset($_REQUEST['csurl'])) {
    $request_url = urldecode($_REQUEST['csurl']);
} elseif (isset($_SERVER['HTTP_X_PROXY_URL'])) {
    $request_url = urldecode($_SERVER['HTTP_X_PROXY_URL']);
} else {
    header($_SERVER['SERVER_PROTOCOL'] . ' 404 Not Found');
    header('Status: 404 Not Found');
    $_SERVER['REDIRECT_STATUS'] = 404;
    exit;
}

$p_request_url = parse_url($request_url);

// Remove csurl from parameters
if (is_array($request_params) && array_key_exists('csurl', $request_params)) {
    unset($request_params['csurl']);
}

// Prevent proxying itself
if (preg_match('!' . $_SERVER['SCRIPT_NAME'] . '!', $request_url) || empty($request_url) || count($p_request_url) == 1) {
    csajax_debug_message('Invalid request - make sure that csurl variable is not empty');
    exit;
}

// Validate domain
if (CSAJAX_FILTERS) {
    $parsed = $p_request_url;
    if (CSAJAX_FILTER_DOMAIN) {
        if (!in_array($parsed['host'], $valid_requests)) {
            csajax_debug_message('Invalid domain - ' . $parsed['host'] . ' is not included in valid request domains');
            exit;
        }
    } else {
        $check_url = (isset($parsed['scheme']) ? $parsed['scheme'] . '://' : '') .
                     (isset($parsed['user']) ? $parsed['user'] . ($parsed['pass'] ? ':' . $parsed['pass'] : '') . '@' : '') .
                     (isset($parsed['host']) ? $parsed['host'] : '') .
                     (isset($parsed['port']) ? ':' . $parsed['port'] : '') .
                     (isset($parsed['path']) ? $parsed['path'] : '');
        if (!in_array($check_url, $valid_requests)) {
            csajax_debug_message('Invalid domain - ' . $request_url . ' is not included in valid request domain');
            exit;
        }
    }
}

// Append query string for GET requests
if ($request_method == 'GET' && count($request_params) > 0 && (!array_key_exists('query', $p_request_url) || empty($p_request_url['query']))) {
    $request_url .= '?' . http_build_query($request_params);
}

// Initialize cURL
$ch = curl_init($request_url);
curl_setopt($ch, CURLOPT_HTTPHEADER, $request_headers);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, true);

// Handle Server-Sent Events (SSE)
if ($isEventStream) {
    // Set SSE headers for the client
    header('Content-Type: text/event-stream');
    header('Cache-Control: no-cache');
    header('Connection: keep-alive');
    header('X-Accel-Buffering: no'); // Disable buffering in Nginx if used

    // Configure cURL for streaming
    curl_setopt($ch, CURLOPT_WRITEFUNCTION, function ($curl, $data) {
        // Forward each chunk of the event stream to the client
        echo $data;
        flush(); // Ensure data is sent immediately
        return strlen($data);
    });
} else {
    // Handle POST, PUT, DELETE
    if ($request_method == 'POST') {
        $post_data = is_array($request_params) ? http_build_query($request_params) : $request_params;

        $has_files = false;
        $file_params = array();

        // 🧩 Move uploaded files to /tmp and pass their paths to the backend
        foreach ($_FILES as $f => $file) {
            if ($file['size']) {
                $tmp_name = $file['tmp_name'];
                $original_name = basename($file['name']);
                $target_path = sys_get_temp_dir() . '/' . uniqid('upload_', true) . '_' . $original_name;

                if (move_uploaded_file($tmp_name, $target_path)) {
                    $file_params['file'] = $target_path;       // Path to temp file
                    $file_params['file_field'] = $f;           // Original field name
                    $has_files = true;
                }
            }
        }

        // Merge other POST fields if multipart or files present
        if ($isMultiPart || $has_files) {
            foreach (explode("&", $post_data) as $param) {
                $params = explode("=", $param);
                $xvarname = $params[0];
                if (!empty($xvarname)) {
                    $file_params[$xvarname] = $params[1];
                }
            }
        }

        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $isMultiPart || $has_files ? $file_params : $post_data);
    } elseif ($request_method == 'PUT' || $request_method == 'DELETE') {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $request_method);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $request_params);
    }
}

// Execute request
if ($isEventStream) {
    // For SSE, execute cURL and let the WRITEFUNCTION handle streaming
    curl_exec($ch);
} else {
    // For non-SSE requests, handle as before
    $response = curl_exec($ch);
    if ($response) {
        list($response_headers, $response_content) = preg_split('/(\r\n){2}/', $response, 2);

        // Forward response headers
        $response_headers = preg_split('/(\r\n){1}/', $response_headers);
        foreach ($response_headers as $response_header) {
            if (preg_match('/^Location:/', $response_header)) {
                list($header, $value) = preg_split('/: /', $response_header, 2);
                $response_header = 'Location: ' . $_SERVER['REQUEST_URI'] . '?csurl=' . $value;
            }
            if (!preg_match('/^(Transfer-Encoding):/', $response_header)) {
                header($response_header, false);
            }
        }

        // Output response content
        print($response_content);
    } else {
        print '';
    }
}

curl_close($ch);

// Debug helper
/**
 * Outputs debug messages if CSAJAX_DEBUG is enabled.
 *
 * @param string $message The debug message to output.
 * @return void
 */
function csajax_debug_message($message)
{
    if (true == CSAJAX_DEBUG) {
        print $message . PHP_EOL;
    }
}