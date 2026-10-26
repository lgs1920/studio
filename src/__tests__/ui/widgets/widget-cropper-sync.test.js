/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: widget-cropper-sync.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-16
 * Last modified: 2026-10-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('WidgetCropper syncCropDimensionsFromElement', () => {
    let WidgetCropper
    let config
    let widgetManager

    beforeEach(async () => {
        vi.resetModules()
        const module = await import('@Core/ui/widget-manager/WidgetCropper')
        WidgetCropper = module.WidgetCropper

        globalThis.__ = {
            app: {
                parsePx: value => {
                    const parsed = parseFloat(value)
                    return Number.isFinite(parsed) ? parsed : 0
                },
            },
        }

        globalThis.lgs = {
            canvas: {
                getBoundingClientRect: () => ({
                    left:   100,
                    top:    50,
                    width:  800,
                    height: 450,
                }),
            },
        }

        const element = {
            isConnected:           true,
            style:                 {},
            getBoundingClientRect: () => ({
                left:   125,
                top:    80,
                width:  640,
                height: 360,
            }),
        }
        const outsideOverlay = {
            style:                 {},
            getBoundingClientRect: () => ({
                left:   100,
                top:    50,
                width:  800,
                height: 450,
            }),
        }

        config = {
            id:             'video-crop-zone',
            isCropper:      true,
            element,
            outsideOverlay,
            container:      globalThis.lgs.canvas,
            cropDimensions: {left: 0, top: 0, width: 1, height: 1},
            position:       {left: 0, top: 0},
            resizeFromCenter: true,
            ratio:          {value: '16x9', aspectRatio: 16 / 9, locked: true},
        }

        widgetManager = {
            getWidgetConfig:    vi.fn(() => config),
            getElementById:     vi.fn(() => element),
            setConfig:          vi.fn(),
            saveWidgetPosition: vi.fn(async () => undefined),
        }
    })

    afterEach(() => {
        globalThis.__ = undefined
        globalThis.lgs = undefined
        vi.resetModules()
    })

    it('stores crop coordinates relative to the crop container', async () => {
        const cropper = new WidgetCropper(widgetManager)

        const crop = await cropper.syncCropDimensionsFromElement('video-crop-zone', false, 'before-record')

        expect(crop).toEqual({
            left:   25,
            top:    30,
            width:  640,
            height: 360,
        })
        expect(config.position).toEqual({left: 25, top: 30})
        expect(config.centerRatio).toEqual({
            x: (25 + 640 / 2) / 800,
            y: (30 + 360 / 2) / 450,
        })
        expect(widgetManager.setConfig).toHaveBeenCalledWith('video-crop-zone', config)
    })

    it('restores Journey geometry after reading a shared widget position and persists resize completion', async () => {
        const {WidgetCoreRegistry} = await import('@Core/ui/widget-manager/WidgetCoreRegistry')
        const journey = {slug: 'journey-a', replay: {cropZone: {
            width: 400, height: 225, ratio: {value: '16x9', aspectRatio: 16 / 9, locked: true},
        }}, persistToDatabase: vi.fn(async () => undefined)}
        lgs.theJourney = journey
        lgs.configuration = {widgetRatio: '1x1', videoFormats: [{value: '1x1', aspectRatio: 1, locked: true}]}
        widgetManager.getWidgetPosition = vi.fn(async () => ({leftRatio: 50, topRatio: 50, width: 300, height: 300}))
        __.ui = {widgetManager}
        const registry = new WidgetCoreRegistry()
        const restored = await registry.retrieveConfig(config.element, {...config, persist: true})

        expect(widgetManager.getWidgetPosition).toHaveBeenCalledWith('video-crop-zone')
        expect(restored.cropDimensions).toMatchObject({width: 400, height: 225})
        expect(restored.ratio.value).toBe('16x9')
        restored.cropDimensions = {left: 80, top: 45, width: 640, height: 360}
        const written = new Promise(resolve => journey.persistToDatabase.mockImplementationOnce(async () => resolve()))
        new WidgetCropper(widgetManager).dispatchCropUpdate(restored, 'end')
        await written
        expect(journey.replay.cropZone).toMatchObject({width: 640, height: 360})
    })

    it('persists the logical inline size when the rendered rect is transformed', async () => {
        const cropper = new WidgetCropper(widgetManager)
        config.persist = true
        config.element.style.width = '720px'
        config.element.style.height = '405px'

        const crop = await cropper.syncCropDimensionsFromElement('video-crop-zone', true, 'editing-exit')

        expect(crop.width).toBe(720)
        expect(crop.height).toBe(405)
        expect(widgetManager.saveWidgetPosition).toHaveBeenCalledWith('video-crop-zone', config)
    })

    it('does not apply the previous crop twice during deferred layout', () => {
        const cropper = new WidgetCropper(widgetManager)
        widgetManager.repositionWidgetsForBoard = vi.fn()
        const previousCrop = {left: 0, top: 0, width: 800, height: 450}
        config.cropDimensions = {left: 100, top: 50, width: 600, height: 338}
        const originalRequestAnimationFrame = globalThis.requestAnimationFrame
        globalThis.requestAnimationFrame = callback => {
            callback()
            return 1
        }

        try {
            cropper.dispatchCropUpdate(config, 'resize', previousCrop)
        }
        finally {
            globalThis.requestAnimationFrame = originalRequestAnimationFrame
        }

        expect(widgetManager.repositionWidgetsForBoard).toHaveBeenNthCalledWith(
            1,
            'video-crop-zone',
            config.cropDimensions,
            previousCrop,
        )
        expect(widgetManager.repositionWidgetsForBoard).toHaveBeenNthCalledWith(
            2,
            'video-crop-zone',
            config.cropDimensions,
        )
    })
})
