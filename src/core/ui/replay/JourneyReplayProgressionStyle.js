/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayProgressionStyle.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-03
 * Last modified: 2026-07-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { defaultJourneyReplayClips, normalizeJourneyReplayClips } from './JourneyReplayClips'
import {
    TRACK_RENDER_SMOOTHING_MAX_STEP, TRACK_RENDER_SMOOTHING_MIN_STEP, normalizeTrackRenderSmoothing,
} from '@Utils/cesium/trackRenderSmoothing'

export const REPLAY_PROGRESSION_FILL_MIN_WIDTH = 1
export const REPLAY_PROGRESSION_FILL_MAX_WIDTH = 10
export const REPLAY_PROGRESSION_BORDER_MIN_WIDTH = 0
export const REPLAY_PROGRESSION_BORDER_MAX_WIDTH = 4
export const REPLAY_PROFILE_MARKER_FILL_MIN_SIZE = 2
export const REPLAY_PROFILE_MARKER_FILL_MAX_SIZE = 32
export const REPLAY_PROFILE_MARKER_BORDER_MIN_WIDTH = 0
export const REPLAY_PROFILE_MARKER_BORDER_MAX_WIDTH = 12
export const REPLAY_LABEL = 'Journey Replay'
export const DEFAULT_REPLAY_SCOPE = 'all-tracks'
export const DEFAULT_REPLAY_DURATION = 60
export const DEFAULT_REPLAY_POI_DISTANCE = 10000
export const REPLAY_TRACE_MODE_PROGRESSIVE = 'progressive'
export const REPLAY_TRACE_MODE_FULL = 'full'
export const REPLAY_MARKER_MODE_TRACE = 'trace'
export const REPLAY_MARKER_MODE_NAVIGATION = 'navigation'
export const REPLAY_MARKER_MODE_HYSTERESIS = 'hysteresis'
export const REPLAY_CAMERA_ALTITUDE_CONSTANT = 'constant'
export const REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET = 'ground-offset'
export const REPLAY_CAMERA_POSITION_BEHIND = 'behind'
export const REPLAY_CAMERA_POSITION_AHEAD = 'ahead'
export const REPLAY_CAMERA_POSITION_SYSTEM = 'system'
export const REPLAY_CAMERA_PREVIEW_MODE_TERRAIN = 'terrain'
export const REPLAY_CAMERA_HEADING_OFFSET_MIN = -90
export const REPLAY_CAMERA_HEADING_OFFSET_MAX = 90
export const REPLAY_CAMERA_PRESET_CUSTOM = 'custom'
export const REPLAY_CAMERA_PRESET_DEFAULT = 'default'
export const REPLAY_CAMERA_PRESET_ULTRA_SMOOTH = 'ultra-smooth'
export const REPLAY_HYSTERESIS_MARGIN_RATIO_MIN = 0.05
export const REPLAY_HYSTERESIS_MARGIN_RATIO_MAX = 0.45
export const REPLAY_HYSTERESIS_EASING_MIN = 0.02
export const REPLAY_HYSTERESIS_EASING_MAX = 0.5
export const REPLAY_HYSTERESIS_LOOKAHEAD_PROGRESS = 0.025
export const REPLAY_SMOOTHING_MIN_STEP = TRACK_RENDER_SMOOTHING_MIN_STEP
export const REPLAY_SMOOTHING_MAX_STEP = TRACK_RENDER_SMOOTHING_MAX_STEP
export const REPLAY_CAMERA_SENSITIVITY_MIN = 0
export const REPLAY_CAMERA_SENSITIVITY_MAX = 1

export const DEFAULT_REPLAY_PROGRESSION = {
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

export const DEFAULT_REPLAY_PROFILE_INFO = {
    color:         '#ffffff',
    useTrackStyle: false,
}

export const DEFAULT_REPLAY_TRACE = {
    mode:      REPLAY_TRACE_MODE_PROGRESSIVE,
    remaining: {
        useDefinedTrackStyle: true,
        color:                '#6f7d8c',
        opacity:              0.45,
    },
}

export const DEFAULT_REPLAY_SMOOTHING = {
    enabled: true,
    step:    2,
}

export const DEFAULT_REPLAY_MARKER = {
    mode: REPLAY_MARKER_MODE_TRACE,
    position: null,
}

export const DEFAULT_REPLAY_CAMERA = {
    positionMode:  REPLAY_CAMERA_POSITION_SYSTEM,
    altitudeMode:  REPLAY_CAMERA_ALTITUDE_CONSTANT,
    // Single persisted altitude value.
    // In fixed mode it is an absolute altitude; in ground-offset mode it is
    // the offset above the rendered replay marker.
    altitude:      1200,
    headingOffset: 0,
    debug:         false,
    canDrift:      true,
    canFixHiddenMarker: true,
    canRoll:       true,
    driftSensitivity:           1,
    rollSensitivity:            1,
    pitchCorrectionSensitivity: 1,
    previewMode:    REPLAY_CAMERA_PREVIEW_MODE_TERRAIN,
    pitch:         -65,
    heading:       0,
    hysteresis:    {
        // Keep the beta.2 tolerance envelope: a wide inner zone prevents
        // small route changes from starting a new camera correction.
        marginRatio:   0.12,
        zone:        {
            top:    0,
            left:   0,
            width:  1,
            height: 1,
        },
        easing:        0.18,
    },
}

const REPLAY_CAMERA_PRESET_HYSTERESIS = {
    [REPLAY_CAMERA_PRESET_DEFAULT]: {
        marginRatio:   DEFAULT_REPLAY_CAMERA.hysteresis.marginRatio,
        easing:        DEFAULT_REPLAY_CAMERA.hysteresis.easing,
    },
    [REPLAY_CAMERA_PRESET_ULTRA_SMOOTH]: {
        marginRatio:   0.2,
        easing:        0.3,
    },
}

export const defaultJourneyReplayProgressionStyle = () => ({
    fill:   {...DEFAULT_REPLAY_PROGRESSION.fill},
    border: {...DEFAULT_REPLAY_PROGRESSION.border},
})

export const defaultJourneyReplayProfileInfoStyle = () => ({...DEFAULT_REPLAY_PROFILE_INFO})
export const defaultJourneyReplayTraceStyle = () => ({
    mode:      DEFAULT_REPLAY_TRACE.mode,
    remaining: {...DEFAULT_REPLAY_TRACE.remaining},
})
export const defaultJourneyReplaySmoothing = () => ({...DEFAULT_REPLAY_SMOOTHING})
export const defaultJourneyReplayMarkerStyle = () => ({...DEFAULT_REPLAY_MARKER})
export const defaultJourneyReplayCameraStyle = () => ({...DEFAULT_REPLAY_CAMERA})

export const REPLAY_CAMERA_PRESETS = Object.freeze([
    {
        key:    REPLAY_CAMERA_PRESET_DEFAULT,
        label:  'Default',
        camera: {
            hysteresis: {...REPLAY_CAMERA_PRESET_HYSTERESIS[REPLAY_CAMERA_PRESET_DEFAULT]},
        },
    },
    {
        key:    REPLAY_CAMERA_PRESET_ULTRA_SMOOTH,
        label:  'Ultra smooth',
        camera: {
            hysteresis: {...REPLAY_CAMERA_PRESET_HYSTERESIS[REPLAY_CAMERA_PRESET_ULTRA_SMOOTH]},
        },
    },
])

export const defaultJourneyReplaySettings = () => ({
    duration:    DEFAULT_REPLAY_DURATION,
    poiDistance: DEFAULT_REPLAY_POI_DISTANCE,
    hideAllPoisDuringJourneyReplay: false,
    animateAllPoisDuringJourneyReplay: false,
    recordingSync: false,
    direction:   1,
    loop:        false,
    scope:       DEFAULT_REPLAY_SCOPE,
    hideOtherJourneys: false,
    inheritHideOtherJourneys: true,
    progression: defaultJourneyReplayProgressionStyle(),
    profileInfo: defaultJourneyReplayProfileInfoStyle(),
    trace:       defaultJourneyReplayTraceStyle(),
    smoothing:   defaultJourneyReplaySmoothing(),
    marker:      defaultJourneyReplayMarkerStyle(),
    camera:      defaultJourneyReplayCameraStyle(),
    clips:       (() => {
        const clips = defaultJourneyReplayClips()
        return {
            ...clips,
        }
    })(),
})

const finiteNumber = value => {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

export const clampJourneyReplayNumber = (value, fallback, min, max, rounded = false) => {
    const number = Math.min(max, Math.max(min, finiteNumber(value) ?? fallback))
    return rounded ? Math.ceil(number) : number
}

const normalizeJourneyReplayToleranceZone = (zone = {}, fallback = DEFAULT_REPLAY_CAMERA.hysteresis.zone) => {
    const top = clampJourneyReplayNumber(zone?.top, fallback.top, 0, 1)
    const left = clampJourneyReplayNumber(zone?.left, fallback.left, 0, 1)
    const width = clampJourneyReplayNumber(zone?.width, fallback.width, REPLAY_HYSTERESIS_MARGIN_RATIO_MIN, 1)
    const height = clampJourneyReplayNumber(zone?.height, fallback.height, REPLAY_HYSTERESIS_MARGIN_RATIO_MIN, 1)
    return {
        top,
        left,
        width:  Math.min(width, 1 - left),
        height: Math.min(height, 1 - top),
    }
}

const normalizeJourneyReplayHysteresisMarginRatio = (zone, value, fallback = DEFAULT_REPLAY_CAMERA.hysteresis.marginRatio) => {
    const explicit = finiteNumber(value)
    if (explicit !== null) {
        return clampJourneyReplayNumber(explicit, fallback, REPLAY_HYSTERESIS_MARGIN_RATIO_MIN, REPLAY_HYSTERESIS_MARGIN_RATIO_MAX)
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

    return clampJourneyReplayNumber(edgeMargin, fallback, REPLAY_HYSTERESIS_MARGIN_RATIO_MIN, REPLAY_HYSTERESIS_MARGIN_RATIO_MAX)
}

export const normalizeJourneyReplayProgressionStyle = (progression = {}) => {
    const fill = progression?.fill ?? {}
    const border = progression?.border ?? {}

    return {
        fill:   {
            color:   fill.color ?? DEFAULT_REPLAY_PROGRESSION.fill.color,
            opacity: clampJourneyReplayNumber(fill.opacity, DEFAULT_REPLAY_PROGRESSION.fill.opacity, 0, 1),
            width:   clampJourneyReplayNumber(
                fill.width,
                DEFAULT_REPLAY_PROGRESSION.fill.width,
                REPLAY_PROGRESSION_FILL_MIN_WIDTH,
                REPLAY_PROGRESSION_FILL_MAX_WIDTH,
            ),
            profileMarker: clampJourneyReplayNumber(
                fill.profileMarker,
                DEFAULT_REPLAY_PROGRESSION.fill.profileMarker,
                REPLAY_PROFILE_MARKER_FILL_MIN_SIZE,
                REPLAY_PROFILE_MARKER_FILL_MAX_SIZE,
            ),
        },
        border: {
            color:   border.color ?? DEFAULT_REPLAY_PROGRESSION.border.color,
            opacity: clampJourneyReplayNumber(border.opacity, DEFAULT_REPLAY_PROGRESSION.border.opacity, 0, 1),
            width:   clampJourneyReplayNumber(
                border.width,
                DEFAULT_REPLAY_PROGRESSION.border.width,
                REPLAY_PROGRESSION_BORDER_MIN_WIDTH,
                REPLAY_PROGRESSION_BORDER_MAX_WIDTH,
            ),
            profileMarker: clampJourneyReplayNumber(
                border.profileMarker,
                DEFAULT_REPLAY_PROGRESSION.border.profileMarker,
                REPLAY_PROFILE_MARKER_BORDER_MIN_WIDTH,
                REPLAY_PROFILE_MARKER_BORDER_MAX_WIDTH,
            ),
        },
    }
}

export const normalizeJourneyReplayProfileInfo = (profileInfo = {}) => ({
    color:         profileInfo?.color ?? DEFAULT_REPLAY_PROFILE_INFO.color,
    useTrackStyle: profileInfo?.useTrackStyle === true,
})

export const normalizeJourneyReplayTrace = (trace = {}) => {
    const remaining = trace?.remaining ?? {}
    return {
        mode:      trace?.mode === REPLAY_TRACE_MODE_FULL
                   ? REPLAY_TRACE_MODE_FULL
                   : REPLAY_TRACE_MODE_PROGRESSIVE,
        remaining: {
            useDefinedTrackStyle: remaining.useDefinedTrackStyle !== false,
            color:                remaining.color ?? DEFAULT_REPLAY_TRACE.remaining.color,
            opacity:              clampJourneyReplayNumber(
                remaining.opacity,
                DEFAULT_REPLAY_TRACE.remaining.opacity,
                0,
                1,
            ),
        },
    }
}

export const normalizeJourneyReplaySmoothing = (smoothing = {}) => normalizeTrackRenderSmoothing(
    smoothing,
    DEFAULT_REPLAY_SMOOTHING,
)

/**
 * Normalizes the FT marker mode and optional override position.
 * The runtime uses this shape directly to keep the drawer, store, and Cesium in sync.
 */
export const normalizeJourneyReplayMarker = (marker = {}) => ({
    mode: marker?.mode === REPLAY_MARKER_MODE_NAVIGATION
          ? REPLAY_MARKER_MODE_NAVIGATION
          : marker?.mode === REPLAY_MARKER_MODE_HYSTERESIS || marker?.mode === 'centered'
            ? REPLAY_MARKER_MODE_HYSTERESIS
            : REPLAY_MARKER_MODE_TRACE,
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
 * - `ground-offset`: altitude above the rendered replay marker/terrain at the
 *   marker position, never above the terrain below the displaced camera.
 *
 * `hysteresis` drives the Dynamic mode:
 * - `marginRatio`: inner safe zone width/height margin on each side.
 * - `zone`: outer viewport crop rectangle, expressed as normalized top/left/width/height.
 * - `easing`: smoothness of the recenter flight.
 *
 * `headingOffset` is used by the Behind/Ahead camera modes to bias the nominal trace-facing heading.
 * `canDrift`, `canFixHiddenMarker`, and `canRoll` gate the corresponding
 * replay camera behaviours while keeping them enabled by default. Sensitivity
 * values scale the corresponding motion without changing the default output.
 *
 */
export const normalizeJourneyReplayCamera = (camera = {}) => ({
    positionMode: camera?.positionMode === REPLAY_CAMERA_POSITION_AHEAD
                  ? REPLAY_CAMERA_POSITION_AHEAD
                  : camera?.positionMode === REPLAY_CAMERA_POSITION_BEHIND
                    ? REPLAY_CAMERA_POSITION_BEHIND
                    : REPLAY_CAMERA_POSITION_SYSTEM,
    altitudeMode: camera?.altitudeMode === REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET
                  ? REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET
                  : REPLAY_CAMERA_ALTITUDE_CONSTANT,
    altitude:     clampJourneyReplayNumber(
        camera?.altitude ?? camera?.groundOffset,
        DEFAULT_REPLAY_CAMERA.altitude,
        10,
        100000,
        true,
    ),
    pitch:        clampJourneyReplayNumber(camera?.pitch, DEFAULT_REPLAY_CAMERA.pitch, -89, -5, true),
    heading:      clampJourneyReplayNumber(camera?.heading, DEFAULT_REPLAY_CAMERA.heading, -180, 180),
    headingOffset: clampJourneyReplayNumber(
        camera?.headingOffset,
        DEFAULT_REPLAY_CAMERA.headingOffset,
        REPLAY_CAMERA_HEADING_OFFSET_MIN,
        REPLAY_CAMERA_HEADING_OFFSET_MAX,
    ),
    debug:         camera?.debug === true,
    canDrift:      camera?.canDrift !== false,
    canFixHiddenMarker: camera?.canFixHiddenMarker !== false,
    canRoll:       camera?.canRoll !== false,
    driftSensitivity: clampJourneyReplayNumber(
        camera?.driftSensitivity,
        DEFAULT_REPLAY_CAMERA.driftSensitivity,
        REPLAY_CAMERA_SENSITIVITY_MIN,
        REPLAY_CAMERA_SENSITIVITY_MAX,
    ),
    rollSensitivity: clampJourneyReplayNumber(
        camera?.rollSensitivity,
        DEFAULT_REPLAY_CAMERA.rollSensitivity,
        REPLAY_CAMERA_SENSITIVITY_MIN,
        REPLAY_CAMERA_SENSITIVITY_MAX,
    ),
    pitchCorrectionSensitivity: clampJourneyReplayNumber(
        camera?.pitchCorrectionSensitivity,
        DEFAULT_REPLAY_CAMERA.pitchCorrectionSensitivity,
        REPLAY_CAMERA_SENSITIVITY_MIN,
        REPLAY_CAMERA_SENSITIVITY_MAX,
    ),
    previewMode:   REPLAY_CAMERA_PREVIEW_MODE_TERRAIN,
    hysteresis:   (() => {
        const zone = normalizeJourneyReplayToleranceZone(camera?.hysteresis?.zone, DEFAULT_REPLAY_CAMERA.hysteresis.zone)
        return {
            zone,
            marginRatio:   normalizeJourneyReplayHysteresisMarginRatio(
                zone,
                camera?.hysteresis?.marginRatio,
                clampJourneyReplayNumber(
                    camera?.hysteresis?.marginRatio,
                    DEFAULT_REPLAY_CAMERA.hysteresis.marginRatio,
                    REPLAY_HYSTERESIS_MARGIN_RATIO_MIN,
                    REPLAY_HYSTERESIS_MARGIN_RATIO_MAX,
                ),
            ),
            easing:        clampJourneyReplayNumber(
                camera?.hysteresis?.easing,
                DEFAULT_REPLAY_CAMERA.hysteresis.easing,
                REPLAY_HYSTERESIS_EASING_MIN,
                REPLAY_HYSTERESIS_EASING_MAX,
            ),
        }
    })(),
})

export const normalizeJourneyReplaySettings = (settings = {}) => {
    const duration = finiteNumber(settings?.duration) ?? DEFAULT_REPLAY_DURATION
    const clips = normalizeJourneyReplayClips(settings?.clips)

    return {
        duration:    Math.max(1, duration),
        poiDistance: clampJourneyReplayNumber(
            settings?.poiDistance,
            DEFAULT_REPLAY_POI_DISTANCE,
            1,
            100000,
            true,
        ),
        direction:   Number(settings?.direction) < 0 ? -1 : 1,
        loop:        settings?.loop === true,
        scope:       typeof settings?.scope === 'string' && settings.scope.trim() !== ''
                     ? settings.scope
                     : DEFAULT_REPLAY_SCOPE,
        hideOtherJourneys: settings?.hideOtherJourneys === true,
        inheritHideOtherJourneys: settings?.inheritHideOtherJourneys !== false,
        hideAllPoisDuringJourneyReplay: settings?.hideAllPoisDuringJourneyReplay === true,
        animateAllPoisDuringJourneyReplay: settings?.animateAllPoisDuringJourneyReplay === true,
        recordingSync: settings?.recordingSync === true,
        progression: normalizeJourneyReplayProgressionStyle(settings?.progression),
        profileInfo: normalizeJourneyReplayProfileInfo(settings?.profileInfo),
        trace:       normalizeJourneyReplayTrace(settings?.trace),
        smoothing:   normalizeJourneyReplaySmoothing(settings?.smoothing),
        marker:      normalizeJourneyReplayMarker(settings?.marker),
        camera:      normalizeJourneyReplayCamera(settings?.camera),
        clips:       clips,
    }
}

const cameraPresetKeyFromHysteresis = hysteresis => REPLAY_CAMERA_PRESETS.find(preset => {
    const presetHysteresis = preset.camera?.hysteresis ?? {}
    return presetHysteresis.marginRatio === hysteresis?.marginRatio
        && presetHysteresis.easing === hysteresis?.easing
})?.key ?? REPLAY_CAMERA_PRESET_CUSTOM

export const getJourneyReplayCameraPresetKey = (camera = {}) => {
    const normalized = normalizeJourneyReplayCamera(camera)
    return cameraPresetKeyFromHysteresis(normalized.hysteresis)
}

export const getJourneyReplayCameraPresetUpdates = presetKey => {
    const preset = REPLAY_CAMERA_PRESETS.find(item => item.key === presetKey)
    return preset ? {
        hysteresis: {
            ...preset.camera.hysteresis,
        },
    } : null
}

export const getJourneyReplaySettings = () => normalizeJourneyReplaySettings(
    globalThis.lgs?.settings?.ui?.replay
    ?? globalThis.lgs?.configuration?.ui?.replay,
)

export const ensureJourneyReplaySettings = () => {
    const ui = globalThis.lgs?.settings?.ui
    if (!ui) {
        return defaultJourneyReplaySettings()
    }

    ui.replay = normalizeJourneyReplaySettings(ui.replay)
    return ui.replay
}
