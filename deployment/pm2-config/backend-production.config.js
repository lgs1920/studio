
/**********************************************************************************************************************
 *                                                                                                                    *
 * This file is part of the LGS1920/backend project.                                                                  *
 *                                                                                                                    *
 *                                                                                                                    *
 * File: backend-production.config.js                                                                                 *
 * Path: /home/christian/devs/assets/lgs1920/backend/deployment/pm2-config/backend-production.config.js               *
 *                                                                                                                    *
 * Author : Christian Denat                                                                                           *
 * email: christian.denat@orange.fr                                                                                   *
 *                                                                                                                    *
 * Created on: 2024-09-20                                                                                             *
 * Last modified: 2024-09-20                                                                                          *
 *                                                                                                                    *
 *                                                                                                                    *
 * Copyright © 2024 LGS1920                                                                                           *
 *                                                                                                                    *
 **********************************************************************************************************************/

// eslint-disable-next-line no-undef
module.exports = {
    apps : [{
        name   : "backend-production",
        script : "/home/.bun/bin/bun run backend.js",
        watch : true,
        wait_ready: true
    }]
}