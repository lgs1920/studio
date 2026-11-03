/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: compass-camera-heading.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-24
 * Last modified: 2026-11-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, it} from 'vitest'
import {resolveCompassCameraHeading} from '@Components/MainUI/compass/CompassCameraHeading'

describe('compass camera heading', () => {
    it('uses the published Replay camera pose before the live camera fallback', () => {
        expect(resolveCompassCameraHeading({
            replayFrame: {
                renderContract: {
                    cameraPose: {heading: 1.25},
                },
            },
            fallbackHeading: 2.5,
        })).toBe(1.25)
    })

    it('falls back to the interactive camera outside export publication', () => {
        expect(resolveCompassCameraHeading({fallbackHeading: 2.5})).toBe(2.5)
    })
})
