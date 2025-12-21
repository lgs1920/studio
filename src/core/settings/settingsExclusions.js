/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: settingsExclusions.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-21
 * Last modified: 2025-12-21
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

    // List of settings exclusions (ie we keep the user choice)
    // This array is then sorted alphabetically by object depth.
export const SETTING_EXCLUSIONS = [
        'layers.base', 'layers.terrain', 'layers.overlay',
        'layers.filter', 'layers.colorSettings',
        'app', 'scene', 'starter', 'coordinateSystem', 'unitSystem', 'poi.filter',
        'ui.camera', 'ui.welcome', 'swatches.current',
        'ui.menu', 'ui.poi.rotate', 'ui.poi.focusOnEdit', 'ui.journeyToolbar',
        'ui.compass.mode', 'ui.video.fps', 'ui.video.quality', 'ui.video.ratio', 'ui.pwa',
    ].sort((a, b) => {
        const segmentsA = a.split('.')
        const segmentsB = b.split('.')

        for (let i = 0; i < Math.max(segmentsA.length, segmentsB.length); i++) {
            if (segmentsA[i] === undefined) {
                return -1
            }
            if (segmentsB[i] === undefined) {
                return 1
            }
            if (segmentsA[i] < segmentsB[i]) {
                return -1
            }
            if (segmentsA[i] > segmentsB[i]) {
                return 1
            }
        }
        return 0
    })
