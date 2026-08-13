/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: BuildInfoUtils.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-05
 * Last modified: 2026-05-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

export const UNKNOWN_BUILD_INFO = 'Unknown build'

export const getRawBuildInfo = build => build?.date ?? build?.buildTime ?? build?.id ?? build?.hash

export const formatBuildInfo = build => {
    const rawBuild = getRawBuildInfo(build)
    if (rawBuild === null || rawBuild === undefined || rawBuild === '') {
        return UNKNOWN_BUILD_INFO
    }

    const timestamp = Number(rawBuild)
    if (Number.isFinite(timestamp) && timestamp > 0) {
        return new Date(timestamp).toLocaleString()
    }

    return String(rawBuild)
}
