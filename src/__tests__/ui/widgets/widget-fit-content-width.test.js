// @vitest-environment jsdom
/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: widget-fit-content-width.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-30
 * Last modified: 2026-09-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WidgetCoreControls } from '@Core/ui/widget-manager/WidgetCoreControls'
import { WidgetCoreRegistry } from '@Core/ui/widget-manager/WidgetCoreRegistry'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('content-sized widget width persistence', () => {
    let controls
    let registry
    let manager
    let element
    let resizeObserverCallback
    let performanceNow

    beforeEach(() => {
        registry = new WidgetCoreRegistry()
        manager = {saveWidgetPosition: vi.fn()}
        vi.stubGlobal('__', {ui: {widgetManager: manager}})
        element = document.createElement('div')
        element.style.width = 'max-content'
        element.style.height = '48px'
        document.body.appendChild(element)

        vi.stubGlobal('ResizeObserver', class {
            constructor(callback) {
                resizeObserverCallback = callback
            }

            observe = vi.fn()
            disconnect = vi.fn()
        })
        vi.spyOn(window, 'getComputedStyle').mockReturnValue({width: 'max-content', height: '48px'})
        performanceNow = vi.spyOn(performance, 'now').mockReturnValue(1000)
        vi.stubGlobal('requestAnimationFrame', callback => {
            callback()
            return 1
        })
        controls = new WidgetCoreControls(registry)
    })

    afterEach(() => {
        element.remove()
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    it('replaces the saved width with the current content width and preserves height', () => {
        let renderedWidth = 160
        element.getBoundingClientRect = vi.fn(() => ({
            left: 20,
            top: 30,
            width: renderedWidth,
            height: 38.4,
        }))
        const config = {
            id: 'credits-widget#video',
            dimensions: {width: 420, height: 48},
            scale: {x: 0.8, y: 0.8},
            fitContentWidth: true,
            skipInitialElementResizeSync: true,
            persist: true,
            runtimeReady: true,
        }

        controls.monitorElementResize(config, element)

        expect(config.dimensions).toEqual({width: 200, height: 48})
        expect(config.skipInitialElementResizeSync).toBe(false)
        expect(manager.saveWidgetPosition).toHaveBeenCalledWith(config.id, config)

        renderedWidth = 120
        performanceNow.mockReturnValue(1200)
        resizeObserverCallback()

        expect(config.dimensions).toEqual({width: 150, height: 48})
        expect(manager.saveWidgetPosition).toHaveBeenCalledTimes(2)
    })
})
