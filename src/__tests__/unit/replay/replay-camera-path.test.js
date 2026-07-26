/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-camera-path.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-26
 * Last modified: 2026-07-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Cartesian3 } from 'cesium'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildCameraTransferPath } from '@Core/ui/replay/JourneyReplayCameraPath'

describe('Journey replay camera paths', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('applies a fixed orientation when the transfer ends at the panorama pivot', async () => {
        vi.useFakeTimers()
        vi.stubGlobal('requestAnimationFrame', callback => globalThis.setTimeout(callback, 16))
        vi.stubGlobal('cancelAnimationFrame', handle => globalThis.clearTimeout(handle))

        try {
            const destination = Cartesian3.fromDegrees(1, 2, 1300)
            const orientation = {
                heading: 0.5,
                pitch:   -0.25,
                roll:    0,
            }
            const camera = {
                setView: vi.fn(),
            }
            const complete = vi.fn()
            const path = buildCameraTransferPath({
                start: new Cartesian3(destination.x + 100, destination.y, destination.z),
                end:   destination,
                mode:  'direct',
            })

            path.flyTo({
                camera,
                orientation,
                duration: 0.016,
                complete,
            })
            await vi.advanceTimersByTimeAsync(16)

            expect(complete).toHaveBeenCalledTimes(1)
            expect(camera.setView).toHaveBeenLastCalledWith({
                destination,
                orientation,
            })
        }
        finally {
            vi.useRealTimers()
        }
    })
})
