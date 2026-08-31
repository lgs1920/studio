/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: camera-adjustment-widget-position.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-28
 * Last modified: 2026-08-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { scheduleCameraAdjustmentWidgetCenter } from '@Components/MainUI/cameraAdjustmentWidgetPosition'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('camera adjustment widget default position', () => {
    afterEach(() => {
        vi.restoreAllMocks()
        globalThis.__ = undefined
    })

    it('positions the widget at ten percent of the active container height', () => {
        const widgetId = 'camera-adjustment-widget'
        const element = document.createElement('div')
        const config = {container: document.createElement('div'), runtimeReady: true}
        const manager = {
            getElementById:     vi.fn(() => element),
            retrieveElementId:  vi.fn(() => widgetId),
            getWidgetConfig:    vi.fn(() => config),
            setConfig:          vi.fn(),
            toTopPercentage:    vi.fn(),
        }
        globalThis.__ = {ui: {widgetManager: manager}}
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
            callback()
            return 1
        })

        const cancel = scheduleCameraAdjustmentWidgetCenter(widgetId)

        expect(manager.toTopPercentage).toHaveBeenCalledWith(element, 10, 0)
        expect(config.attachTo).toBe('top')

        cancel()
    })
})
