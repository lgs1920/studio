/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: backend-production.config.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

module.exports = {
    apps : [{
        name   : "backend-production",
        script : "/home/.bun/bin/bun run backend.js",
        watch : true,
        wait_ready: true,
        out_file: "/dev/null",
        error_file: "/home/www/lgs1920/production/backend/shared/logs/backend-production-error.log",
        log_date_format: "YYYY-MM-DD HH:mm:ss"
    }]
}
