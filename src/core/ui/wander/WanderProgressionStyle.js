/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WanderProgressionStyle.js
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

export const WANDER_PROGRESSION_FILL_MIN_WIDTH = 1
export const WANDER_PROGRESSION_FILL_MAX_WIDTH = 10
export const WANDER_PROGRESSION_BORDER_MIN_WIDTH = 0
export const WANDER_PROGRESSION_BORDER_MAX_WIDTH = 4
export const WANDER_LABEL = 'Wander'
export const DEFAULT_WANDER_SCOPE = 'visible-tracks'
export const DEFAULT_WANDER_DURATION = 60

export const DEFAULT_WANDER_PROGRESSION = {
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

export const defaultWanderProgressionStyle = () => ({
    fill:   {...DEFAULT_WANDER_PROGRESSION.fill},
    border: {...DEFAULT_WANDER_PROGRESSION.border},
})

export const defaultWanderSettings = () => ({
    duration:    DEFAULT_WANDER_DURATION,
    direction:   1,
    loop:        false,
    scope:       DEFAULT_WANDER_SCOPE,
    progression: defaultWanderProgressionStyle(),
})

const finiteNumber = value => {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

export const clampWanderNumber = (value, fallback, min, max) => {
    const number = finiteNumber(value) ?? fallback
    return Math.min(max, Math.max(min, number))
}

export const normalizeWanderProgressionStyle = (progression = {}) => {
    const fill = progression?.fill ?? {}
    const border = progression?.border ?? {}

    return {
        fill:   {
            color:   fill.color ?? DEFAULT_WANDER_PROGRESSION.fill.color,
            opacity: clampWanderNumber(fill.opacity, DEFAULT_WANDER_PROGRESSION.fill.opacity, 0, 1),
            width:   clampWanderNumber(
                fill.width,
                DEFAULT_WANDER_PROGRESSION.fill.width,
                WANDER_PROGRESSION_FILL_MIN_WIDTH,
                WANDER_PROGRESSION_FILL_MAX_WIDTH,
            ),
        },
        border: {
            color:   border.color ?? DEFAULT_WANDER_PROGRESSION.border.color,
            opacity: clampWanderNumber(border.opacity, DEFAULT_WANDER_PROGRESSION.border.opacity, 0, 1),
            width:   clampWanderNumber(
                border.width,
                DEFAULT_WANDER_PROGRESSION.border.width,
                WANDER_PROGRESSION_BORDER_MIN_WIDTH,
                WANDER_PROGRESSION_BORDER_MAX_WIDTH,
            ),
        },
    }
}

export const normalizeWanderSettings = (settings = {}) => {
    const duration = finiteNumber(settings?.duration) ?? DEFAULT_WANDER_DURATION
    const direction = Number(settings?.direction) < 0 ? -1 : 1

    return {
        duration:    Math.max(1, duration),
        direction,
        loop:        settings?.loop === true,
        scope:       settings?.scope ?? DEFAULT_WANDER_SCOPE,
        progression: normalizeWanderProgressionStyle(settings?.progression),
    }
}

export const getWanderSettings = () => normalizeWanderSettings(
    globalThis.lgs?.settings?.ui?.wander
    ?? globalThis.lgs?.configuration?.ui?.wander,
)

export const ensureWanderSettings = () => {
    const ui = globalThis.lgs?.settings?.ui
    if (!ui) {
        return defaultWanderSettings()
    }

    ui.wander = normalizeWanderSettings(ui.wander)
    return ui.wander
}
