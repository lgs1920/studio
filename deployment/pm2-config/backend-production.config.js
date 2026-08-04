/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: backend-production.config.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
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
        wait_ready: true
    }]
}
