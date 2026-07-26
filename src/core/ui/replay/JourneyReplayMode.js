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
