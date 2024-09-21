<?php
function checkAlive($bin, $platform) {
    $list = json_decode(shell_exec(sprintf('%s jlist', $bin)), true);
    foreach ($list as $item) {
        if ($item['name'] === "backend-$platform" && $item['pm2_env']['status'] === 'online') {
            return true;
        }
    }
    return false;
}


/**
 * Run backend command
 */
$config = json_decode(file_get_contents('servers.json'), true);

$response=['alive'=> false];

if (checkAlive($config['backend']['pm2']['bin'], $config['platform'])) {
    $response['alive'] = true;
} else {
    // Start backend
    shell_exec($config['backend']['pm2']['command']);
    $response['alive']=checkAlive($config['backend']['pm2']['bin'], $config['platform']);
}

// Return the status
    print json_encode($response);