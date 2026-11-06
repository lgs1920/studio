/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: device-manager-dpr.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-06
 * Last modified: 2026-11-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, describe, expect, it, vi} from 'vitest'
import {DeviceManager} from '@Core/ui/DeviceManager'
import {buildReplayVideoRenderSpec} from '@Core/ui/replay/ReplayVideoRenderSpec'

describe('DeviceManager display DPR', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('reads browser DPR changes made after Studio startup', () => {
        const browserWindow = {devicePixelRatio: 1}
        vi.stubGlobal('window', browserWindow)
        vi.stubGlobal('navigator', {userAgent: 'Mozilla/5.0 Firefox/157.0'})
        const device = new DeviceManager()
        const recordingDevice = {
            /** Resolve the current DPR as the recording spec is built. */
            get dpr() { return device.dpr },
            browser: 'Firefox,brands',
            mobile: false,
        }
        const getRenderSpec = () => buildReplayVideoRenderSpec({
            cropRect: {left: 0, top: 0, width: 320, height: 180},
            device: recordingDevice,
            settings: {fps: 0, quality: 0},
        })

        expect(device.dpr).toBe(1)
        expect(getRenderSpec().outputDpr).toBe(1)

        browserWindow.devicePixelRatio = 3

        expect(device.dpr).toBe(3)
        const updatedRenderSpec = getRenderSpec()
        expect(updatedRenderSpec.outputDpr).toBeCloseTo(2.74375)
        expect(updatedRenderSpec.dimensions).toEqual({width: 878, height: 494})
    })
})
