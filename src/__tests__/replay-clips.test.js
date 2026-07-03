import { describe, expect, it } from 'vitest'
import {
    canAddJourneyReplayClip,
    replayClipInstanceCount,
    normalizeJourneyReplayClips,
} from '@Core/ui/replay/JourneyReplayClips'

describe('JourneyReplayClips maxInstances counting', () => {
    it('counts maxInstances per slot list, not across start and stop together', () => {
        const clips = normalizeJourneyReplayClips({
            catalog: {
                orbit: {
                    id:           'orbit',
                    label:        'Orbit',
                    slots:        ['start', 'stop'],
                    maxInstances: 1,
                },
            },
            start: [
                {
                    clipId: 'orbit',
                    slot:     'start',
                },
            ],
            stop: [],
        })

        expect(replayClipInstanceCount(clips, 'orbit', 'start')).toBe(1)
        expect(replayClipInstanceCount(clips, 'orbit', 'stop')).toBe(0)
        expect(canAddJourneyReplayClip(clips, clips.catalog.orbit, 'start')).toBe(false)
        expect(canAddJourneyReplayClip(clips, clips.catalog.orbit, 'stop')).toBe(true)
    })
})
