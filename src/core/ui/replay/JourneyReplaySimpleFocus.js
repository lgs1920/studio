/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplaySimpleFocus.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-10
 * Last modified: 2026-10-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {normalizeJourneyReplayClips, REPLAY_CLIP_SLOT_POST_REPLAY} from './JourneyReplayClips'

export const SIMPLE_REPLAY_TRACE_FOCUS_DURATION_SECONDS = 4
export const SIMPLE_REPLAY_TRACE_FOCUS_HEIGHT_DELTA_METERS = 2000
export const SIMPLE_REPLAY_TRACE_FOCUS_RPM = 15
export const SIMPLE_REPLAY_TRACE_FOCUS_INSTANCE_ID = 'simple-trace-focus'

/**
 * Build the fixed Simple Replay outro as a normal post-Replay camera clip.
 *
 * @param {Object} cameraSettings - Prepared Replay camera settings.
 * @returns {Object} Normalized clip configuration containing the trace focus.
 */
export const createSimpleReplayTraceFocusClips = cameraSettings => {
    const definition = {
        id: 'focus',
        label: 'Trace focus',
        icon: 'rotate',
        slots: [REPLAY_CLIP_SLOT_POST_REPLAY],
        maxInstances: 1,
        resizable: false,
        defaults: {
            duration: SIMPLE_REPLAY_TRACE_FOCUS_DURATION_SECONDS,
            focusTarget: 'trace-centroid',
            heightDelta: SIMPLE_REPLAY_TRACE_FOCUS_HEIGHT_DELTA_METERS,
            rpm: SIMPLE_REPLAY_TRACE_FOCUS_RPM,
            pitch: cameraSettings?.pitch,
        },
        fields: [],
    }

    return normalizeJourneyReplayClips({
        catalog: {focus: definition},
        start: [],
        stop: [{
            id: SIMPLE_REPLAY_TRACE_FOCUS_INSTANCE_ID,
            clipId: 'focus',
            slot: REPLAY_CLIP_SLOT_POST_REPLAY,
            enabled: true,
            resizable: false,
            params: definition.defaults,
        }],
    })
}
