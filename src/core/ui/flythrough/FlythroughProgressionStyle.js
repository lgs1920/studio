/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FlythroughProgressionStyle.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-05
 * Last modified: 2026-05-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

export const FLYTHROUGH_PROGRESSION_FILL_MIN_WIDTH = 1
export const FLYTHROUGH_PROGRESSION_FILL_MAX_WIDTH = 10
export const FLYTHROUGH_PROGRESSION_BORDER_MIN_WIDTH = 0
export const FLYTHROUGH_PROGRESSION_BORDER_MAX_WIDTH = 4
export const FLYTHROUGH_LABEL = 'Flythrough'
export const DEFAULT_FLYTHROUGH_SCOPE = 'visible-tracks'
export const DEFAULT_FLYTHROUGH_DURATION = 60

export const DEFAULT_FLYTHROUGH_PROGRESSION = {
    fill:   {
        color:   '#ff6a00',
        opacity: 1,
        width:   2,
    },
    border: {
        color:   '#ffffff',
        opacity: 1,
        width:   0.75,
    },
}

export const DEFAULT_FLYTHROUGH_PROFILE_INFO = {
    color: '#ffffff',
}

export const defaultFlythroughProgressionStyle = () => ({
    fill:   {...DEFAULT_FLYTHROUGH_PROGRESSION.fill},
    border: {...DEFAULT_FLYTHROUGH_PROGRESSION.border},
})

export const defaultFlythroughProfileInfoStyle = () => ({...DEFAULT_FLYTHROUGH_PROFILE_INFO})

export const defaultFlythroughSettings = () => ({
    duration:    DEFAULT_FLYTHROUGH_DURATION,
    direction:   1,
    loop:        false,
    scope:       DEFAULT_FLYTHROUGH_SCOPE,
    progression: defaultFlythroughProgressionStyle(),
    profileInfo: defaultFlythroughProfileInfoStyle(),
})

const finiteNumber = value => {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

export const clampFlythroughNumber = (value, fallback, min, max) => {
    const number = finiteNumber(value) ?? fallback
    return Math.min(max, Math.max(min, number))
}

export const normalizeFlythroughProgressionStyle = (progression = {}) => {
    const fill = progression?.fill ?? {}
    const border = progression?.border ?? {}

    return {
        fill:   {
            color:   fill.color ?? DEFAULT_FLYTHROUGH_PROGRESSION.fill.color,
            opacity: clampFlythroughNumber(fill.opacity, DEFAULT_FLYTHROUGH_PROGRESSION.fill.opacity, 0, 1),
            width:   clampFlythroughNumber(
                fill.width,
                DEFAULT_FLYTHROUGH_PROGRESSION.fill.width,
                FLYTHROUGH_PROGRESSION_FILL_MIN_WIDTH,
                FLYTHROUGH_PROGRESSION_FILL_MAX_WIDTH,
            ),
        },
        border: {
            color:   border.color ?? DEFAULT_FLYTHROUGH_PROGRESSION.border.color,
            opacity: clampFlythroughNumber(border.opacity, DEFAULT_FLYTHROUGH_PROGRESSION.border.opacity, 0, 1),
            width:   clampFlythroughNumber(
                border.width,
                DEFAULT_FLYTHROUGH_PROGRESSION.border.width,
                FLYTHROUGH_PROGRESSION_BORDER_MIN_WIDTH,
                FLYTHROUGH_PROGRESSION_BORDER_MAX_WIDTH,
            ),
        },
    }
}

export const normalizeFlythroughProfileInfo = (profileInfo = {}) => ({
    color: profileInfo?.color ?? DEFAULT_FLYTHROUGH_PROFILE_INFO.color,
})

export const normalizeFlythroughSettings = (settings = {}) => {
    const duration = finiteNumber(settings?.duration) ?? DEFAULT_FLYTHROUGH_DURATION
    const direction = Number(settings?.direction) < 0 ? -1 : 1

    return {
        duration:    Math.max(1, duration),
        direction,
        loop:        settings?.loop === true,
        scope:       settings?.scope ?? DEFAULT_FLYTHROUGH_SCOPE,
        progression: normalizeFlythroughProgressionStyle(settings?.progression),
        profileInfo: normalizeFlythroughProfileInfo(settings?.profileInfo),
    }
}

export const getFlythroughSettings = () => normalizeFlythroughSettings(
    globalThis.lgs?.settings?.ui?.flythrough
    ?? globalThis.lgs?.configuration?.ui?.flythrough,
)

export const ensureFlythroughSettings = () => {
    const ui = globalThis.lgs?.settings?.ui
    if (!ui) {
        return defaultFlythroughSettings()
    }

    ui.flythrough = normalizeFlythroughSettings(ui.flythrough)
    return ui.flythrough
}
