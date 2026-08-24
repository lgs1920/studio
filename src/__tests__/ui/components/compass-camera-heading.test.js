import {describe, expect, it} from 'vitest'
import {resolveCompassCameraHeading} from '@Components/MainUI/compass/CompassCameraHeading'

describe('compass camera heading', () => {
    it('uses the HQ render contract before the interactive camera fallback', () => {
        expect(resolveCompassCameraHeading({
            hqFrame: {
                renderContract: {
                    cameraPose: {heading: 1.25},
                },
            },
            fallbackHeading: 2.5,
        })).toBe(1.25)
    })

    it('falls back to the interactive camera outside HQ publication', () => {
        expect(resolveCompassCameraHeading({fallbackHeading: 2.5})).toBe(2.5)
    })
})
