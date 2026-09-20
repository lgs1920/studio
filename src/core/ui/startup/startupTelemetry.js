/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: startupTelemetry.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-20
 * Last modified: 2026-09-20
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

const STARTUP_MARK_PREFIX = 'lgs.startup.'

const markName = name => `${STARTUP_MARK_PREFIX}${name}`

export const markStartup = (name, detail) => {
    if (typeof performance === 'undefined' || typeof performance.mark !== 'function') {
        return null
    }

    const nameValue = markName(name)
    try {
        performance.mark(nameValue, detail === undefined ? undefined : {detail})
    }
    catch {
        performance.mark(nameValue)
    }
    return nameValue
}

export const measureStartup = (name, start, end) => {
    if (typeof performance === 'undefined' || typeof performance.measure !== 'function') {
        return null
    }

    try {
        return performance.measure(markName(name), markName(start), end ? markName(end) : undefined)
    }
    catch {
        return null
    }
}
