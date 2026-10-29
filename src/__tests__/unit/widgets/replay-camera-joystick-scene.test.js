/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-camera-joystick-scene.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-29
 * Last modified: 2026-10-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, it} from 'vitest'
import {
    createJoystickCavityGeometry, createJoystickCrownGeometry,
} from '@Components/JourneyReplay/ReplayCameraJoystickScene'

describe('Replay camera joystick surface', () => {
    it('models a recessed dish and a raised, grooved crown', () => {
        const cavity = createJoystickCavityGeometry()
        const crown = createJoystickCrownGeometry()

        try {
            cavity.computeBoundingBox()
            crown.computeBoundingBox()
            expect(cavity.boundingBox.min.z).toBeLessThan(-0.08)
            expect(cavity.boundingBox.max.z).toBeCloseTo(0, 5)
            expect(crown.boundingBox.max.x).toBeGreaterThan(0.58)
            expect(crown.boundingBox.min.x).toBeLessThan(-0.58)
        }
        finally {
            cavity.dispose()
            crown.dispose()
        }
    })
})
