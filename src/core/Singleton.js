/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Singleton.js
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

export class Singleton {

    constructor() {
        if (Singleton.instance) {
            return Singleton.instance
        }
        Singleton.instance = this
        return this
    }
}