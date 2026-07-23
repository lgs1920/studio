/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: widget-resizable-crop.test.js
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WidgetResizable } from '@Core/ui/widget-manager/WidgetResizable'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('WidgetResizable crop lifecycle', () => {
    afterEach(() => {
        globalThis.__ = undefined
    })

    it('keeps the live crop config and dispatches only the final resize update', async () => {
        const originalRequestAnimationFrame = globalThis.requestAnimationFrame
        let pendingFrame = null
        globalThis.requestAnimationFrame = vi.fn(callback => {
            pendingFrame = callback
            return 1
        })

        const target = document.createElement('div')
        Object.assign(target.style, {
            left:   '10px',
            top:    '20px',
            width:  '200px',
            height: '112px',
        })
        const config = {
            id:               'video-crop-zone',
            isCropper:        true,
            persist:          true,
            resizeFromCenter: true,
            cropDimensions:   {left: 10, top: 20, width: 200, height: 112},
            position:         {left: 10, top: 20},
            bounds:           {left: 0, top: 0, right: 800, bottom: 450},
            container: {
                getBoundingClientRect: () => ({
                    left: 0,
                    top:  0,
                    width: 800,
                    height: 450,
                }),
            },
        }
        const widgetManager = {
            isResizing:        false,
            retrieveElementId: vi.fn(() => config.id),
            getWidgetConfig:   vi.fn(() => config),
            retrieveConfig:    vi.fn(async () => ({
                ...config,
                cropDimensions: {left: 10, top: 20, width: 100, height: 56},
            })),
            saveWidgetPosition: vi.fn(async () => undefined),
        }
        const widgetCropper = {
            applyCropToOverlay: vi.fn(),
            dispatchCropUpdate: vi.fn(),
        }
        globalThis.__ = {
            app: {
                parsePx: value => Number.parseFloat(value) || 0,
            },
            ui: {
                widgetCache: {
                    getAll: vi.fn(() => new Map()),
                },
                widgetManager: {
                    setConfig: vi.fn(),
                },
            },
        }

        try {
            const resizable = new WidgetResizable(widgetManager, widgetCropper)
            resizable.onResizeStart({
                target,
                direction: [1, 1],
                setFixedDirection: vi.fn(),
            })
            resizable.onResize({
                width:     240,
                height:    135,
                direction: [1, 1],
                drag:      {beforeDist: [0, 0]},
            }, {
                widget: {current: target},
                child:  {current: null},
            }, vi.fn())

            expect(pendingFrame).toEqual(expect.any(Function))
            pendingFrame()
            expect(widgetCropper.applyCropToOverlay).toHaveBeenCalledWith(config)
            expect(widgetCropper.dispatchCropUpdate).not.toHaveBeenCalled()

            await resizable.onResizeEnd({target})

            expect(widgetManager.retrieveConfig).not.toHaveBeenCalled()
            expect(config.cropDimensions).toEqual({
                left:   10,
                top:    20,
                width:  240,
                height: 135,
            })
            expect(widgetCropper.dispatchCropUpdate).toHaveBeenCalledWith(config, 'end')
            expect(widgetManager.saveWidgetPosition).toHaveBeenCalledWith(config.id, config)
            expect(__.ui.widgetManager.setConfig).toHaveBeenCalledWith(config.id, config)
        }
        finally {
            globalThis.requestAnimationFrame = originalRequestAnimationFrame
        }
    })
})
