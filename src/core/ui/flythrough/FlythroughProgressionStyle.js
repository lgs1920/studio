/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FlythroughProgressionStyle.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-31
 * Last modified: 2026-05-31
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    defaultFlythroughClips,
    normalizeFlythroughClips,
} from './FlythroughClips'

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
export const DEFAULT_FLYTHROUGH_POI_DISTANCE = 10000
export const FLYTHROUGH_TRACE_MODE_PROGRESSIVE = 'progressive'
export const FLYTHROUGH_TRACE_MODE_FULL = 'full'
export const FLYTHROUGH_MARKER_MODE_TRACE = 'trace'
export const FLYTHROUGH_MARKER_MODE_NAVIGATION = 'navigation'
export const FLYTHROUGH_MARKER_MODE_HYSTERESIS = 'hysteresis'
export const FLYTHROUGH_CAMERA_ALTITUDE_CONSTANT = 'constant'
export const FLYTHROUGH_CAMERA_ALTITUDE_GROUND_OFFSET = 'ground-offset'
export const FLYTHROUGH_CAMERA_POSITION_BEHIND = 'behind'
export const FLYTHROUGH_CAMERA_POSITION_AHEAD = 'ahead'
export const FLYTHROUGH_CAMERA_POSITION_SYSTEM = 'system'
export const FLYTHROUGH_CAMERA_PRESET_CUSTOM = 'custom'
export const FLYTHROUGH_CAMERA_PRESET_DEFAULT = 'default'
export const FLYTHROUGH_CAMERA_PRESET_ULTRA_SMOOTH = 'ultra-smooth'
export const FLYTHROUGH_HYSTERESIS_MARGIN_RATIO_MIN = 0.05
export const FLYTHROUGH_HYSTERESIS_MARGIN_RATIO_MAX = 0.45
export const FLYTHROUGH_HYSTERESIS_EASING_MIN = 0.02
export const FLYTHROUGH_HYSTERESIS_EASING_MAX = 0.5
export const FLYTHROUGH_HYSTERESIS_STOP_THRESHOLD_MIN = 0.000001
export const FLYTHROUGH_HYSTERESIS_STOP_THRESHOLD_MAX = 0.001
export const FLYTHROUGH_HYSTERESIS_LOOKAHEAD_PROGRESS = 0.025

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
        useDefinedTrackStyle: true,
        color:                '#6f7d8c',
        opacity:              0.45,
    },
}

export const DEFAULT_FLYTHROUGH_MARKER = {
    mode: FLYTHROUGH_MARKER_MODE_TRACE,
    position: null,
}

export const DEFAULT_FLYTHROUGH_CAMERA = {
    positionMode:  FLYTHROUGH_CAMERA_POSITION_SYSTEM,
    altitudeMode:  FLYTHROUGH_CAMERA_ALTITUDE_CONSTANT,
    // Single persisted altitude value.
    // In fixed mode it is an absolute altitude; in ground-offset mode it is the offset above terrain.
    altitude:      1200,
    pitch:         -65,
    heading:       0,
    hysteresis:    {
        marginRatio: 0.12,
        zone:        {
            top:    0,
            left:   0,
            width:  1,
            height: 1,
        },
        easing:        0.18,
        stopThreshold: 0.00001,
    },
}

const FLYTHROUGH_CAMERA_PRESET_HYSTERESIS = {
    [FLYTHROUGH_CAMERA_PRESET_DEFAULT]: {
        marginRatio:   DEFAULT_FLYTHROUGH_CAMERA.hysteresis.marginRatio,
        easing:        DEFAULT_FLYTHROUGH_CAMERA.hysteresis.easing,
        stopThreshold: DEFAULT_FLYTHROUGH_CAMERA.hysteresis.stopThreshold,
    },
    [FLYTHROUGH_CAMERA_PRESET_ULTRA_SMOOTH]: {
        marginRatio:   0.2,
        easing:        0.3,
        stopThreshold: 0.000005,
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

export const FLYTHROUGH_CAMERA_PRESETS = Object.freeze([
    {
        key:    FLYTHROUGH_CAMERA_PRESET_DEFAULT,
        label:  'Default',
        camera: {
            hysteresis: {...FLYTHROUGH_CAMERA_PRESET_HYSTERESIS[FLYTHROUGH_CAMERA_PRESET_DEFAULT]},
        },
    },
    {
        key:    FLYTHROUGH_CAMERA_PRESET_ULTRA_SMOOTH,
        label:  'Ultra smooth',
        camera: {
            hysteresis: {...FLYTHROUGH_CAMERA_PRESET_HYSTERESIS[FLYTHROUGH_CAMERA_PRESET_ULTRA_SMOOTH]},
        },
    },
])

export const defaultFlythroughSettings = () => ({
    duration:    DEFAULT_FLYTHROUGH_DURATION,
    poiDistance: DEFAULT_FLYTHROUGH_POI_DISTANCE,
    direction:   1,
    loop:        false,
    scope:       DEFAULT_FLYTHROUGH_SCOPE,
    hideOtherJourneys: false,
    progression: defaultFlythroughProgressionStyle(),
    profileInfo: defaultFlythroughProfileInfoStyle(),
    trace:       defaultFlythroughTraceStyle(),
    marker:      defaultFlythroughMarkerStyle(),
    camera:      defaultFlythroughCameraStyle(),
    clips:       (() => {
        const clips = defaultFlythroughClips()
        return {
            ...clips,
        }
    })(),
})

const finiteNumber = value => {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

export const clampFlythroughNumber = (value, fallback, min, max, rounded = false) => {
    const number = Math.min(max, Math.max(min, finiteNumber(value) ?? fallback))
    return rounded ? Math.ceil(number) : number
}

const normalizeFlythroughToleranceZone = (zone = {}, fallback = DEFAULT_FLYTHROUGH_CAMERA.hysteresis.zone) => {
    const top = clampFlythroughNumber(zone?.top, fallback.top, 0, 1)
    const left = clampFlythroughNumber(zone?.left, fallback.left, 0, 1)
    const width = clampFlythroughNumber(zone?.width, fallback.width, FLYTHROUGH_HYSTERESIS_MARGIN_RATIO_MIN, 1)
    const height = clampFlythroughNumber(zone?.height, fallback.height, FLYTHROUGH_HYSTERESIS_MARGIN_RATIO_MIN, 1)
    return {
        top,
        left,
        width:  Math.min(width, 1 - left),
        height: Math.min(height, 1 - top),
    }
}

const normalizeFlythroughHysteresisMarginRatio = (zone, value, fallback = DEFAULT_FLYTHROUGH_CAMERA.hysteresis.marginRatio) => {
    const explicit = finiteNumber(value)
    if (explicit !== null) {
        return clampFlythroughNumber(explicit, fallback, FLYTHROUGH_HYSTERESIS_MARGIN_RATIO_MIN, FLYTHROUGH_HYSTERESIS_MARGIN_RATIO_MAX)
    }

    const margins = [
        zone.left,
        zone.top,
        1 - (zone.left + zone.width),
        1 - (zone.top + zone.height),
    ]
    const edgeMargin = margins.reduce((minimum, value) => Math.min(minimum, value), 1)
    if (edgeMargin <= 0) {
        return fallback
    }

    return clampFlythroughNumber(edgeMargin, fallback, FLYTHROUGH_HYSTERESIS_MARGIN_RATIO_MIN, FLYTHROUGH_HYSTERESIS_MARGIN_RATIO_MAX)
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
            useDefinedTrackStyle: remaining.useDefinedTrackStyle !== false,
            color:                remaining.color ?? DEFAULT_FLYTHROUGH_TRACE.remaining.color,
            opacity:              clampFlythroughNumber(
                remaining.opacity,
                DEFAULT_FLYTHROUGH_TRACE.remaining.opacity,
                0,
                1,
            ),
        },
    }
}

/**
 * Normalizes the FT marker mode and optional override position.
 * The runtime uses this shape directly to keep the drawer, store, and Cesium in sync.
 */
export const normalizeFlythroughMarker = (marker = {}) => ({
    mode: marker?.mode === FLYTHROUGH_MARKER_MODE_NAVIGATION
          ? FLYTHROUGH_MARKER_MODE_NAVIGATION
          : marker?.mode === FLYTHROUGH_MARKER_MODE_HYSTERESIS || marker?.mode === 'centered'
            ? FLYTHROUGH_MARKER_MODE_HYSTERESIS
            : FLYTHROUGH_MARKER_MODE_TRACE,
    position: marker?.position && Number.isFinite(Number(marker.position.longitude)) && Number.isFinite(Number(marker.position.latitude))
              ? {
                  longitude: Number(marker.position.longitude),
                  latitude:  Number(marker.position.latitude),
                  altitude:  Number.isFinite(Number(marker.position.altitude ?? marker.position.height))
                             ? Number(marker.position.altitude ?? marker.position.height)
                             : null,
              }
              : null,
})

/**
 * Normalizes the FT camera payload used by the drawer and the Cesium runtime.
 *
 * `altitudeMode` switches how the single persisted altitude is interpreted:
 * - `constant`: absolute camera altitude.
 * - `ground-offset`: altitude above local terrain.
 *
 * `hysteresis` drives the Dynamic mode:
 * - `marginRatio`: inner safe zone width/height margin on each side.
 * - `zone`: outer viewport crop rectangle, expressed as normalized top/left/width/height.
 * - `easing`: smoothness of the recenter flight.
 * - `stopThreshold`: screen-space convergence threshold that prevents tiny oscillations.
 */
export const normalizeFlythroughCamera = (camera = {}) => ({
    positionMode: camera?.positionMode === FLYTHROUGH_CAMERA_POSITION_AHEAD
                  ? FLYTHROUGH_CAMERA_POSITION_AHEAD
                  : camera?.positionMode === FLYTHROUGH_CAMERA_POSITION_BEHIND
                    ? FLYTHROUGH_CAMERA_POSITION_BEHIND
                    : FLYTHROUGH_CAMERA_POSITION_SYSTEM,
    altitudeMode: camera?.altitudeMode === FLYTHROUGH_CAMERA_ALTITUDE_GROUND_OFFSET
                  ? FLYTHROUGH_CAMERA_ALTITUDE_GROUND_OFFSET
                  : FLYTHROUGH_CAMERA_ALTITUDE_CONSTANT,
    altitude:     clampFlythroughNumber(
        camera?.altitude ?? camera?.groundOffset,
        DEFAULT_FLYTHROUGH_CAMERA.altitude,
        10,
        100000,
        true,
    ),
    pitch:        clampFlythroughNumber(camera?.pitch, DEFAULT_FLYTHROUGH_CAMERA.pitch, -89, -5, true),
    heading:      clampFlythroughNumber(camera?.heading, DEFAULT_FLYTHROUGH_CAMERA.heading, -180, 180),
    hysteresis:   (() => {
        const zone = normalizeFlythroughToleranceZone(camera?.hysteresis?.zone, DEFAULT_FLYTHROUGH_CAMERA.hysteresis.zone)
        return {
            zone,
            marginRatio:   normalizeFlythroughHysteresisMarginRatio(
                zone,
                camera?.hysteresis?.marginRatio,
                clampFlythroughNumber(
                    camera?.hysteresis?.marginRatio,
                    DEFAULT_FLYTHROUGH_CAMERA.hysteresis.marginRatio,
                    FLYTHROUGH_HYSTERESIS_MARGIN_RATIO_MIN,
                    FLYTHROUGH_HYSTERESIS_MARGIN_RATIO_MAX,
                ),
            ),
            easing:        clampFlythroughNumber(
                camera?.hysteresis?.easing,
                DEFAULT_FLYTHROUGH_CAMERA.hysteresis.easing,
                FLYTHROUGH_HYSTERESIS_EASING_MIN,
                FLYTHROUGH_HYSTERESIS_EASING_MAX,
            ),
            stopThreshold: clampFlythroughNumber(
                camera?.hysteresis?.stopThreshold,
                DEFAULT_FLYTHROUGH_CAMERA.hysteresis.stopThreshold,
                FLYTHROUGH_HYSTERESIS_STOP_THRESHOLD_MIN,
                FLYTHROUGH_HYSTERESIS_STOP_THRESHOLD_MAX,
            ),
        }
    })(),
})

export const normalizeFlythroughSettings = (settings = {}) => {
    const duration = finiteNumber(settings?.duration) ?? DEFAULT_FLYTHROUGH_DURATION
    const clips = normalizeFlythroughClips(settings?.clips)

    return {
        duration:    Math.max(1, duration),
        poiDistance: clampFlythroughNumber(
            settings?.poiDistance,
            DEFAULT_FLYTHROUGH_POI_DISTANCE,
            1,
            100000,
            true,
        ),
        direction:   Number(settings?.direction) < 0 ? -1 : 1,
        loop:        settings?.loop === true,
        scope:       typeof settings?.scope === 'string' && settings.scope.trim() !== ''
                     ? settings.scope
                     : DEFAULT_FLYTHROUGH_SCOPE,
        hideOtherJourneys: settings?.hideOtherJourneys === true,
        progression: normalizeFlythroughProgressionStyle(settings?.progression),
        profileInfo: normalizeFlythroughProfileInfo(settings?.profileInfo),
        trace:       normalizeFlythroughTrace(settings?.trace),
        marker:      normalizeFlythroughMarker(settings?.marker),
        camera:      normalizeFlythroughCamera(settings?.camera),
        clips:       clips,
    }
}

const cameraPresetKeyFromHysteresis = hysteresis => FLYTHROUGH_CAMERA_PRESETS.find(preset => {
    const presetHysteresis = preset.camera?.hysteresis ?? {}
    return presetHysteresis.marginRatio === hysteresis?.marginRatio
        && presetHysteresis.easing === hysteresis?.easing
        && presetHysteresis.stopThreshold === hysteresis?.stopThreshold
})?.key ?? FLYTHROUGH_CAMERA_PRESET_CUSTOM

export const getFlythroughCameraPresetKey = (camera = {}) => {
    const normalized = normalizeFlythroughCamera(camera)
    return cameraPresetKeyFromHysteresis(normalized.hysteresis)
}

export const getFlythroughCameraPresetUpdates = presetKey => {
    const preset = FLYTHROUGH_CAMERA_PRESETS.find(item => item.key === presetKey)
    return preset ? {
        hysteresis: {
            ...preset.camera.hysteresis,
        },
    } : null
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
