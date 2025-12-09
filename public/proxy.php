<?php
/**
 * AJAX Cross Domain (PHP) Proxy 0.8
 *    by Iacovos Constantinou (http://www.iacons.net)
 *
 * Released under CC-GNU GPL
 *
 * ------------------------------------------------------------
 * ✨ Modified by Christian Denat (christian.denat@orange.fr)
 * ✨ Further modified to fix Server-Sent Events (SSE) response issues
 *
 * ➕ Enhancements:
 *   - Added support for file uploads via multipart/form-data
 *   - Uploaded files are moved to /tmp and passed to backend via `file` field
 *   - Added support for Server-Sent Events (SSE) for real-time event streaming
 *   - Detect SSE requests via `?sse=true` in addition to `Accept: text/event-stream`
 *   - Explicitly disable PHP output buffering for SSE with ob_implicit_flush
 *   - Configured cURL timeouts and connection reuse for SSE
 *   - Added initial SSE comment to keep connection alive
 *   - Added Transfer-Encoding: chunked for SSE
 *   - Enabled debug logging temporarily to diagnose issues
 *   - Removed heartbeat to keep proxy agnostic
 */

// Load allowed backend domains from config
$config = json_decode(file_get_contents('./servers.json'), true);
$ALLOWED_HOSTS = array(
    $config['backend']['domain'],
    '127.0.0.1',
);

// Proxy settings
define('CSAJAX_FILTERS', true);           // Enable domain filtering
define('CSAJAX_FILTER_DOMAIN', true);     // Filter by domain only
define('CSAJAX_DEBUG', true);             // Enable debug messages temporarily

$valid_requests = $ALLOWED_HOSTS;

// Collect request headers
$request_headers = array();
$setContentType = true;
$isMultiPart = false;
$isEventStream = false;
$originalContentType = null;

foreach ($_SERVER as $key => $value) {
    if (preg_match('/Content.Type/i', $key)) {
        $setContentType = false;
        $originalContentType = $value; // Garder le Content-Type complet avec boundary
        $content_type = explode(";", $value)[0];
        $isMultiPart = preg_match('/multipart/i', $content_type);

        // Pour multipart, transmettre le Content-Type COMPLET avec la boundary
        if ($isMultiPart) {
            $request_headers[] = "Content-Type: " . $originalContentType;
        } else {
            $request_headers[] = "Content-Type: " . $content_type;
        }
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

// Check for ?sse=true in csurl to enable SSE mode  
if (isset($_REQUEST['csurl'])) {
    $parsed_csurl = parse_url($_REQUEST['csurl']);
    if (isset($parsed_csurl['query'])) {
        parse_str($parsed_csurl['query'], $query_params);
        if (isset($query_params['sse']) && $query_params['sse'] === 'true') {
            $isEventStream = true;
            $request_headers[] = "Accept: text/event-stream";
        }
    }
    // Fallback pour la détection simple
    if (!$isEventStream && strpos($_REQUEST['csurl'], 'sse=true') !== false) {
        $isEventStream = true;
        $request_headers[] = "Accept: text/event-stream";
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

// Handle Server-Sent Events (SSE) BEFORE cURL setup
if ($isEventStream) {
    // Disable ALL output buffering immediately
    while (ob_get_level()) {
        ob_end_clean();
    }

    // Set SSE headers immediately
    header('Content-Type: text/event-stream');
    header('Cache-Control: no-cache');
    header('Connection: keep-alive');
    header('X-Accel-Buffering: no'); // Disable Nginx buffering
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Credentials: true');

    // Headers anti-buffering serveur web
    header('X-Proxy-Buffering: off');
    header('Proxy-Buffering: off');
    
    // Pour Apache
    if (function_exists('apache_setenv')) {
        apache_setenv('no-gzip', '1');
        apache_setenv('dont-vary', '1');
    }
    
    // Forcer la taille de buffer à 0
    if (ini_get('output_buffering')) {
        ini_set('output_buffering', 'off');
    }

    // Force immediate output
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    }

    // Send initial SSE comment
    echo ": SSE proxy initialized\n\n";
    flush();

    // Configure for streaming
    set_time_limit(0); // No time limit for SSE
    ignore_user_abort(false); // Stop if client disconnects
}

// Initialize cURL
$ch = curl_init($request_url);
curl_setopt($ch, CURLOPT_HTTPHEADER, $request_headers);

// Configuration différente selon le type de requête
if ($isEventStream) {
    // Pour SSE : pas de buffer, streaming direct
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, false); // Pas de buffer
    curl_setopt($ch, CURLOPT_HEADER, false); // Pas de headers dans le body
    curl_setopt($ch, CURLOPT_TIMEOUT, 0); // Pas de timeout
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 30);
    curl_setopt($ch, CURLOPT_FORBID_REUSE, false);
    curl_setopt($ch, CURLOPT_FRESH_CONNECT, false);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

    // Stream directement vers la sortie avec forçage du flush
    curl_setopt($ch, CURLOPT_WRITEFUNCTION, function ($curl, $data) {
        echo $data;
        
        // FORCER le flush immédiat - CRITIQUE
        if (ob_get_level()) {
            ob_flush();
        }
        flush();
        
        // Pour certains serveurs web
        if (function_exists('fastcgi_finish_request')) {
            fastcgi_finish_request();
        }
        
        // Vérifier déconnexion client
        if (connection_aborted()) {
            return 0;
        }
        
        return strlen($data);
    });
} else {
    // Pour requêtes normales (GET, POST) : comportement standard
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true); // Retourner le résultat
    curl_setopt($ch, CURLOPT_HEADER, false); // NE PAS inclure les headers dans le body
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
}

// Enable verbose logging for debugging
if (CSAJAX_DEBUG) {
    curl_setopt($ch, CURLOPT_VERBOSE, true);
    $verbose_log = fopen('php://temp', 'w+');
    curl_setopt($ch, CURLOPT_STDERR, $verbose_log);
}

// Handle non-SSE requests
if (!$isEventStream) {
    // Handle POST, PUT, DELETE
    if ($request_method == 'POST') {
        $has_files = false;
        $post_data = null;

        // Pour multipart/form-data, utiliser les données brutes
        if ($isMultiPart) {
            // Lire les données brutes du body pour préserver la structure multipart
            $post_data = file_get_contents('php://input');

            // Vérifier s'il y a des fichiers uploadés via PHP
            foreach ($_FILES as $f => $file) {
                if ($file['size'] > 0) {
                    $has_files = true;
                    break;
                }
            }

            // Si pas de fichiers PHP mais des données multipart, utiliser les données brutes
            if (!$has_files && !empty($post_data)) {
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_POSTFIELDS, $post_data);
            } else if ($has_files) {
                // Reconstruire le multipart avec les fichiers déplacés
                $file_params = array();

                // Traiter les fichiers uploadés
                foreach ($_FILES as $f => $file) {
                    if ($file['size'] > 0) {
                        $tmp_name = $file['tmp_name'];
                        $original_name = basename($file['name']);
                        $target_path = sys_get_temp_dir() . '/' . uniqid('upload_', true) . '_' . $original_name;

                        if (move_uploaded_file($tmp_name, $target_path)) {
                            $file_params['file'] = new CURLFile($target_path, $file['type'], $original_name);
                        }
                    }
                }

                // Ajouter les autres champs POST
                foreach ($_POST as $key => $value) {
                    if ($key !== 'csurl') {
                        $file_params[$key] = $value;
                    }
                }

                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_POSTFIELDS, $file_params);

                // Laisser cURL générer le Content-Type avec boundary
                $request_headers = array_filter($request_headers, function($header) {
                    return !preg_match('/^Content-Type:/i', $header);
                });
                curl_setopt($ch, CURLOPT_HTTPHEADER, $request_headers);
            }
        } else {
            // Traitement normal pour les données non-multipart
            $post_data = $_POST;
            if (empty($post_data)) {
                $post_data = file_get_contents('php://input');
            }

            if (is_array($post_data)) {
                $post_data = http_build_query($post_data);
            }

            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $post_data);
        }
    } elseif ($request_method == 'PUT' || $request_method == 'DELETE') {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $request_method);
        if (!empty($request_params)) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $request_params);
        }
    }

    // Execute the request
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $content_type = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);

    // Log cURL verbose output if debugging
    if (CSAJAX_DEBUG && isset($verbose_log)) {
        rewind($verbose_log);
        $verbose_output = stream_get_contents($verbose_log);
        fclose($verbose_log);
        error_log("cURL verbose: " . $verbose_output);
    }

    curl_close($ch);

    // Handle cURL errors
    if ($response === false) {
        $error = curl_error($ch);
        csajax_debug_message("cURL Error: $error");
        header($_SERVER['SERVER_PROTOCOL'] . ' 500 Internal Server Error');
        exit;
    }

    // Set response headers and output
    header("HTTP/1.1 $http_code");
    if ($content_type) {
        header("Content-Type: $content_type");
    }
    echo $response;
} else {
    // Execute SSE request
    $result = curl_exec($ch);

    // Log any cURL errors for SSE
    if ($result === false) {
        $error = curl_error($ch);
        error_log("SSE cURL Error: $error");
        echo "event: error\n";
        echo "data: {\"error\": \"Connection failed: $error\"}\n\n";
        flush();
    }

    curl_close($ch);
}

/**
 * Debug message helper
 */
function csajax_debug_message($message) {
    if (CSAJAX_DEBUG) {
        error_log("CSAJAX Debug: $message");
        if (!headers_sent()) {
            header('X-CSAJAX-Debug: ' . $message);
        }
    }
}
?>