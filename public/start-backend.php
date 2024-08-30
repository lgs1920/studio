<?php
/**
 * Run backend command
 */
$config = json_decode(file_get_contents('./config.json'), true);
// Start backend
shell_exec(sprintf('%s %s',$config['backend']['pm2'],$config['backend']['command'])) ;
// Now verify if it is online
$list = json_decode(shell_exec(sprintf('%s jlist',$config['backend']['pm2'])),true) ;


// check if backend is active
$response = array('alive' => false);
foreach ($list as $item) {
    if ($item['name'] === 'backend' && $item['pm2_env']['status'] === 'online') {
        $response['alive'] = true;
        break;
    }
}

// Return the status
print json_encode($response);

