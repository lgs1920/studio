import { describe, expect, it } from 'vitest'
import {
    canAddFlythroughEffect,
    flythroughEffectInstanceCount,
    normalizeFlythroughEffects,
} from '@Core/ui/flythrough/FlythroughEffects'

describe('FlythroughEffects maxInstances counting', () => {
    it('counts maxInstances per slot list, not across start and stop together', () => {
        const effects = normalizeFlythroughEffects({
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
                    effectId: 'orbit',
                    slot:     'start',
                },
            ],
            stop: [],
        })

        expect(flythroughEffectInstanceCount(effects, 'orbit', 'start')).toBe(1)
        expect(flythroughEffectInstanceCount(effects, 'orbit', 'stop')).toBe(0)
        expect(canAddFlythroughEffect(effects, effects.catalog.orbit, 'start')).toBe(false)
        expect(canAddFlythroughEffect(effects, effects.catalog.orbit, 'stop')).toBe(true)
    })
})
