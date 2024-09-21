
/**********************************************************************************************************************
 *                                                                                                                    *
 * This file is part of the LGS1920/backend project.                                                                  *
 *                                                                                                                    *
 *                                                                                                                    *
 * File: backend-test.config.js                                                                                       *
 * Path: /home/christian/devs/assets/lgs1920/backend/deployment/pm2-config/backend-test.config.js                     *
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

module.exports = {
    apps : [{
        name   : "backend-test",
        script : "/home/.bun/bin/bun run backend.js",
        watch : true,
        wait_ready: true
    }]
}