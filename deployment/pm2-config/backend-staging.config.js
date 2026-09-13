/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: backend-staging.config.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2024-03-12
 * Last modified: 2026-09-13
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

module.exports = {
    apps : [{
        name   : "backend-staging",
        script : "/home/.bun/bin/bun run backend.js",
        watch : true,
        wait_ready: true,
        out_file: "/dev/null",
        error_file: "/home/www/lgs1920/staging/backend/shared/logs/backend-staging-error.log",
        log_date_format: "YYYY-MM-DD HH:mm:ss"
    }]
}
