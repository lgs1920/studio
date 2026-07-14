/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: widget-cropper-sync.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-15
 * Last modified: 2026-07-15
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
})
