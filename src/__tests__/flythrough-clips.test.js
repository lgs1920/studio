import { describe, expect, it } from 'vitest'
import {
    canAddFlythroughClip,
    flythroughClipInstanceCount,
    normalizeFlythroughClips,
} from '@Core/ui/flythrough/FlythroughClips'

describe('FlythroughClips maxInstances counting', () => {
    it('counts maxInstances per slot list, not across start and stop together', () => {
        const clips = normalizeFlythroughClips({
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

        expect(flythroughClipInstanceCount(clips, 'orbit', 'start')).toBe(1)
        expect(flythroughClipInstanceCount(clips, 'orbit', 'stop')).toBe(0)
        expect(canAddFlythroughClip(clips, clips.catalog.orbit, 'start')).toBe(false)
        expect(canAddFlythroughClip(clips, clips.catalog.orbit, 'stop')).toBe(true)
    })
})
