/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: backend-nightly.config.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-13
 * Last modified: 2026-09-13
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

module.exports = {
    apps: [{
        name:        'backend-nightly',
        script:      '/home/.bun/bin/bun run backend.js',
        watch:       true,
        wait_ready:  true,
        out_file:    '/dev/null',
        error_file:  '/home/www/lgs1920/nightly/backend/shared/logs/backend-nightly-error.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss',
    }],
}
