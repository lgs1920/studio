/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropperManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-19
 * Last modified: 2025-07-19
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/
import { faCropSimple, faRectangle, faRectangleVertical, faSquare } from '@fortawesome/pro-regular-svg-icons'

export class CropperManager {
    static instance = null

    constructor() {
        if (CropperManager.instance) {
            return CropperManager.instance
        }

        this.icons = {
            '9x16':    faRectangleVertical,
            '16x9':    faRectangle,
            '1x1':     faSquare,
            'free':    faCropSimple,
            'unknown': faCropSimple,
        }


        CropperManager.instance = this

    }

    initialize = () => {

    }
}