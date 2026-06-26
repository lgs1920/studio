/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: settingsExclusions.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-07
 * Last modified: 2026-06-07
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

    // List of settings exclusions (ie we keep the user choice)
    // This array is then sorted alphabetically by object depth.
export const SETTING_EXCLUSIONS = [
        'layers.base', 'layers.base3d', 'layers.tiles3d', 'layers.terrain', 'layers.overlay',
        'layers.filter', 'layers.colorSettings',
        'app', 'scene', 'starter', 'coordinateSystem', 'unitSystem', 'poi.filter',
        'ion.usageSeconds', 'ion.introSeen',
        'journey.activity',
        'ui.camera', 'ui.welcome', 'swatches.current',
        'ui.menu', 'ui.poi.rotate', 'ui.poi.focusOnEdit', 'ui.journeyToolbar',
        'ui.compass.mode', 'ui.video.fps', 'ui.video.quality', 'ui.video.ratio', 'ui.pwa',
        'ui.flythrough',
        'widgets',
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

export const SETTING_EXCLUSION_ALLOWLIST = [
    'ui.flythrough.clips',
]

const isPathMatch = (path, rule) => path === rule || path.startsWith(`${rule}.`)

export const isSettingPathExcluded = (path, excludeKeys = SETTING_EXCLUSIONS, allowKeys = SETTING_EXCLUSION_ALLOWLIST) => {
    const normalizedPath = `${path ?? ''}`
    if (normalizedPath.length === 0) {
        return false
    }

    if (allowKeys.some(rule => isPathMatch(normalizedPath, rule))) {
        return false
    }

    return excludeKeys.some(rule => isPathMatch(normalizedPath, rule))
}

export const shouldTraverseSettingPath = (path, excludeKeys = SETTING_EXCLUSIONS, allowKeys = SETTING_EXCLUSION_ALLOWLIST) => {
    const normalizedPath = `${path ?? ''}`
    if (normalizedPath.length === 0) {
        return true
    }

    if (allowKeys.some(rule => rule === normalizedPath || rule.startsWith(`${normalizedPath}.`))) {
        return true
    }

    return !isSettingPathExcluded(normalizedPath, excludeKeys, allowKeys)
}
