/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayBasicFocus.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-10
 * Last modified: 2026-10-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {normalizeJourneyReplayClips, REPLAY_CLIP_SLOT_POST_REPLAY} from './JourneyReplayClips'
import {
    DEFAULT_BASIC_REPLAY_END_FOCUS,
    normalizeBasicReplayEndFocus,
} from './ReplayModeSettings'

export const BASIC_REPLAY_TRACE_FOCUS_DURATION_SECONDS = DEFAULT_BASIC_REPLAY_END_FOCUS.duration
export const BASIC_REPLAY_TRACE_FOCUS_HEIGHT_DELTA_METERS = 2000
export const BASIC_REPLAY_TRACE_FOCUS_RPM = 3
export const BASIC_REPLAY_TRACE_FOCUS_INSTANCE_ID = 'simple-trace-focus'

/**
 * Build the optional Basic Replay end focus as a normal post-Replay camera clip.
 *
 * @param {Object} cameraSettings - Prepared Replay camera settings.
 * @param {Object} endFocus - Basic Replay end-focus settings.
 * @returns {Object} Normalized clip configuration with the trace focus when enabled.
 */
export const createBasicReplayTraceFocusClips = (cameraSettings, endFocus = DEFAULT_BASIC_REPLAY_END_FOCUS) => {
    const focusSettings = normalizeBasicReplayEndFocus(endFocus)
    const definition = {
        id: 'focus',
        label: 'Trace focus',
        icon: 'rotate',
        slots: [REPLAY_CLIP_SLOT_POST_REPLAY],
        maxInstances: 1,
        resizable: false,
        defaults: {
            duration: focusSettings.duration,
            focusTarget: 'trace-centroid',
            heightDelta: BASIC_REPLAY_TRACE_FOCUS_HEIGHT_DELTA_METERS,
            rpm: BASIC_REPLAY_TRACE_FOCUS_RPM,
            pitch: cameraSettings?.pitch,
        },
        fields: [],
    }

    return normalizeJourneyReplayClips({
        catalog: {focus: definition},
        start: [],
        stop: focusSettings.enabled ? [{
            id: BASIC_REPLAY_TRACE_FOCUS_INSTANCE_ID,
            clipId: 'focus',
            slot: REPLAY_CLIP_SLOT_POST_REPLAY,
            enabled: true,
            resizable: false,
            params: definition.defaults,
        }] : [],
    })
}
