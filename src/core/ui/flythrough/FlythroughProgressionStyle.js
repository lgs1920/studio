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
export const FLYTHROUGH_PROFILE_MARKER_FILL_MIN_SIZE = 2
export const FLYTHROUGH_PROFILE_MARKER_FILL_MAX_SIZE = 32
export const FLYTHROUGH_PROFILE_MARKER_BORDER_MIN_WIDTH = 0
export const FLYTHROUGH_PROFILE_MARKER_BORDER_MAX_WIDTH = 12
export const FLYTHROUGH_LABEL = 'Flythrough'
export const DEFAULT_FLYTHROUGH_SCOPE = 'all-tracks'
export const DEFAULT_FLYTHROUGH_DURATION = 60
export const FLYTHROUGH_TRACE_MODE_PROGRESSIVE = 'progressive'
export const FLYTHROUGH_TRACE_MODE_FULL = 'full'
export const FLYTHROUGH_MARKER_MODE_TRACE = 'trace'
export const FLYTHROUGH_MARKER_MODE_NAVIGATION = 'navigation'
export const FLYTHROUGH_MARKER_MODE_HYSTERESIS = 'hysteresis'
export const FLYTHROUGH_CAMERA_ALTITUDE_CONSTANT = 'constant'
export const FLYTHROUGH_CAMERA_ALTITUDE_GROUND_OFFSET = 'ground-offset'

export const DEFAULT_FLYTHROUGH_PROGRESSION = {
    fill:   {
        color:   '#ff6a00',
        opacity: 1,
        width:   2,
        profileMarker: 8,
    },
    border: {
        color:   '#ffffff',
        opacity: 1,
        width:   0.75,
        profileMarker: 2,
    },
}

export const DEFAULT_FLYTHROUGH_PROFILE_INFO = {
    color:         '#ffffff',
    useTrackStyle: false,
}

export const DEFAULT_FLYTHROUGH_TRACE = {
    mode:      FLYTHROUGH_TRACE_MODE_PROGRESSIVE,
    remaining: {
        color:   '#6f7d8c',
        opacity: 0.45,
    },
}

export const DEFAULT_FLYTHROUGH_MARKER = {
    mode: FLYTHROUGH_MARKER_MODE_TRACE,
}

export const DEFAULT_FLYTHROUGH_CAMERA = {
    keepNorth:     true,
    altitudeMode:  FLYTHROUGH_CAMERA_ALTITUDE_CONSTANT,
    altitude:      1200,
    groundOffset:  800,
    pitch:         -65,
    hysteresis:    {
        marginRatio:   0.2,
        easing:        0.14,
        stopThreshold: 0.00001,
    },
}

export const defaultFlythroughProgressionStyle = () => ({
    fill:   {...DEFAULT_FLYTHROUGH_PROGRESSION.fill},
    border: {...DEFAULT_FLYTHROUGH_PROGRESSION.border},
})

export const defaultFlythroughProfileInfoStyle = () => ({...DEFAULT_FLYTHROUGH_PROFILE_INFO})
export const defaultFlythroughTraceStyle = () => ({
    mode:      DEFAULT_FLYTHROUGH_TRACE.mode,
    remaining: {...DEFAULT_FLYTHROUGH_TRACE.remaining},
})
export const defaultFlythroughMarkerStyle = () => ({...DEFAULT_FLYTHROUGH_MARKER})
export const defaultFlythroughCameraStyle = () => ({...DEFAULT_FLYTHROUGH_CAMERA})

export const defaultFlythroughSettings = () => ({
    duration:    DEFAULT_FLYTHROUGH_DURATION,
    direction:   1,
    loop:        false,
    scope:       DEFAULT_FLYTHROUGH_SCOPE,
    progression: defaultFlythroughProgressionStyle(),
    profileInfo: defaultFlythroughProfileInfoStyle(),
    trace:       defaultFlythroughTraceStyle(),
    marker:      defaultFlythroughMarkerStyle(),
    camera:      defaultFlythroughCameraStyle(),
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
            profileMarker: clampFlythroughNumber(
                fill.profileMarker,
                DEFAULT_FLYTHROUGH_PROGRESSION.fill.profileMarker,
                FLYTHROUGH_PROFILE_MARKER_FILL_MIN_SIZE,
                FLYTHROUGH_PROFILE_MARKER_FILL_MAX_SIZE,
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
            profileMarker: clampFlythroughNumber(
                border.profileMarker,
                DEFAULT_FLYTHROUGH_PROGRESSION.border.profileMarker,
                FLYTHROUGH_PROFILE_MARKER_BORDER_MIN_WIDTH,
                FLYTHROUGH_PROFILE_MARKER_BORDER_MAX_WIDTH,
            ),
        },
    }
}

export const normalizeFlythroughProfileInfo = (profileInfo = {}) => ({
    color:         profileInfo?.color ?? DEFAULT_FLYTHROUGH_PROFILE_INFO.color,
    useTrackStyle: profileInfo?.useTrackStyle === true,
})

export const normalizeFlythroughTrace = (trace = {}) => {
    const remaining = trace?.remaining ?? {}
    return {
        mode:      trace?.mode === FLYTHROUGH_TRACE_MODE_FULL
                   ? FLYTHROUGH_TRACE_MODE_FULL
                   : FLYTHROUGH_TRACE_MODE_PROGRESSIVE,
        remaining: {
            color:   remaining.color ?? DEFAULT_FLYTHROUGH_TRACE.remaining.color,
            opacity: clampFlythroughNumber(
                remaining.opacity,
                DEFAULT_FLYTHROUGH_TRACE.remaining.opacity,
                0,
                1,
            ),
        },
    }
}

export const normalizeFlythroughMarker = (marker = {}) => ({
    mode: marker?.mode === FLYTHROUGH_MARKER_MODE_NAVIGATION
          ? FLYTHROUGH_MARKER_MODE_NAVIGATION
          : marker?.mode === FLYTHROUGH_MARKER_MODE_HYSTERESIS || marker?.mode === 'centered'
            ? FLYTHROUGH_MARKER_MODE_HYSTERESIS
            : FLYTHROUGH_MARKER_MODE_TRACE,
})

export const normalizeFlythroughCamera = (camera = {}) => ({
    keepNorth:    camera?.keepNorth !== false,
    altitudeMode: camera?.altitudeMode === FLYTHROUGH_CAMERA_ALTITUDE_GROUND_OFFSET
                  ? FLYTHROUGH_CAMERA_ALTITUDE_GROUND_OFFSET
                  : FLYTHROUGH_CAMERA_ALTITUDE_CONSTANT,
    altitude:     clampFlythroughNumber(camera?.altitude, DEFAULT_FLYTHROUGH_CAMERA.altitude, 50, 100000),
    groundOffset: clampFlythroughNumber(camera?.groundOffset, DEFAULT_FLYTHROUGH_CAMERA.groundOffset, 10, 100000),
    pitch:        clampFlythroughNumber(camera?.pitch, DEFAULT_FLYTHROUGH_CAMERA.pitch, -89, -5),
    hysteresis:   {
        marginRatio: clampFlythroughNumber(
            camera?.hysteresis?.marginRatio,
            DEFAULT_FLYTHROUGH_CAMERA.hysteresis.marginRatio,
            0.05,
            0.45,
        ),
        easing: clampFlythroughNumber(
            camera?.hysteresis?.easing,
            DEFAULT_FLYTHROUGH_CAMERA.hysteresis.easing,
            0.02,
            0.5,
        ),
        stopThreshold: clampFlythroughNumber(
            camera?.hysteresis?.stopThreshold,
            DEFAULT_FLYTHROUGH_CAMERA.hysteresis.stopThreshold,
            0.000001,
            0.001,
        ),
    },
})

export const normalizeFlythroughSettings = (settings = {}) => {
    const duration = finiteNumber(settings?.duration) ?? DEFAULT_FLYTHROUGH_DURATION

    return {
        duration:    Math.max(1, duration),
        direction:   1,
        loop:        settings?.loop === true,
        scope:       DEFAULT_FLYTHROUGH_SCOPE,
        progression: normalizeFlythroughProgressionStyle(settings?.progression),
        profileInfo: normalizeFlythroughProfileInfo(settings?.profileInfo),
        trace:       normalizeFlythroughTrace(settings?.trace),
        marker:      normalizeFlythroughMarker(settings?.marker),
        camera:      normalizeFlythroughCamera(settings?.camera),
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
