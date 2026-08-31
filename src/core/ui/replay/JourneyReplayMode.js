/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayMode.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-04
 * Last modified: 2026-07-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Public compatibility facade for journey replay.
 */

import {
    JourneyReplaySessionController, REPLAY_EVENT_STOP_CLIPS_COMPLETE, REPLAY_JOURNEY_TOOLBAR_VISIBILITY_EVENT,
} from './JourneyReplaySessionController'

export {
    REPLAY_EVENT_STOP_CLIPS_COMPLETE, REPLAY_JOURNEY_TOOLBAR_VISIBILITY_EVENT,
} from './JourneyReplaySessionController'
export * from './JourneyReplayCameraMath'

export class JourneyReplayMode extends JourneyReplaySessionController {}
