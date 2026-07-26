/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: widget-content-realign.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-19
 * Last modified: 2026-06-19
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

const mocks = vi.hoisted(() => ({
    measureContent: vi.fn(() => ({
        width:  140,
        height: 90,
    })),
    updateRect: vi.fn(),
    saveWidgetPosition: vi.fn(),
}))

vi.mock('@Core/ui/text-metrics/TextWidgetManager', () => ({
    TextWidgetManager: {
        instance: {
            measureContent: mocks.measureContent,
        },
    },
}))

import { realignWidgetAroundContent } from '@Components/MainUI/widgets/editor/elements/widgetContentRealign'

describe('realignWidgetAroundContent', () => {
    let target

    beforeEach(() => {
        target = {
            style: {
                left:   '10px',
                top:    '20px',
                width:  '100px',
                height: '50px',
            },
        }

        globalThis.lgs = {
            settings: {
                widgets: {
                    'text-widget': {
                        configuration: proxy({
                            default: proxy({
                                text: {
                                    content: 'Default',
                                },
                            }),
                            user: null,
                            elements: {
                                'text-widget#1': proxy({
                                    size:       20,
                                    lineHeight: 1.5,
                                    fontFamily: 'System',
                                    padding:    {
                                        top:    10,
                                        right:  12,
                                        bottom: 14,
                                        left:   16,
                                        scaled: false,
                                    },
                                    border:     {
                                        show:      true,
                                        thickness: 4,
                                        scaled:    false,
                                    },
                                    text: {
                                        content: 'Hello',
                                    },
                                }),
                            },
                        }),
                    },
                },
            },
        }

        globalThis.__ = {
            ui: {
                widgetManager: {
                    getMoveable: vi.fn(() => ({
                        current: {
                            target,
                            updateRect: mocks.updateRect,
                        },
                    })),
                    getWidgetConfig: vi.fn(() => ({
                        dimensions: {
                            width:  100,
                            height: 50,
                        },
                        position: {
                            left: 10,
                            top:  20,
                        },
                        scale: {
                            x: 0.5,
                            y: 0.5,
                        },
                        persist:      false,
                        runtimeReady: false,
                    })),
                    saveWidgetPosition: mocks.saveWidgetPosition,
                },
            },
        }

        mocks.measureContent.mockClear()
        mocks.updateRect.mockClear()
        mocks.saveWidgetPosition.mockClear()
    })

    afterEach(() => {
        globalThis.lgs = undefined
        globalThis.__ = undefined
    })

    it('uses text metrics instead of DOM size to realign the widget', () => {
        realignWidgetAroundContent('text-widget#1')

        expect(mocks.measureContent).toHaveBeenCalledWith(
            expect.objectContaining({
                text: expect.objectContaining({
                    content: 'Hello',
                }),
                padding: expect.objectContaining({
                    scaled: false,
                }),
                border: expect.objectContaining({
                    scaled: false,
                }),
            }),
            expect.any(String),
            expect.objectContaining({
                correction: 2,
                buffer:     0,
            }),
        )
        expect(target.style.width).toBe('140px')
        expect(target.style.height).toBe('90px')
        expect(target.style.left).toBe('-10px')
        expect(target.style.top).toBe('0px')
        expect(mocks.updateRect).toHaveBeenCalled()
        expect(mocks.saveWidgetPosition).not.toHaveBeenCalled()
    })

    it('falls back to DOM measurements for non-text widgets', () => {
        const statsTarget = {
            style: {
                left:   '40px',
                top:    '50px',
                width:  '180px',
                height: '60px',
            },
            getBoundingClientRect: vi.fn(() => ({
                width:  180,
                height: 60,
            })),
        }

        globalThis.__.ui.widgetManager.getMoveable.mockReturnValueOnce({
            current: {
                target: statsTarget,
                updateRect: mocks.updateRect,
            },
        })
        globalThis.__.ui.widgetManager.getWidgetConfig.mockReturnValueOnce({
            dimensions: {
                width:  180,
                height: 60,
            },
            position: {
                left: 40,
                top:  50,
            },
            scale: {
                x: 1,
                y: 1,
            },
            persist:      false,
            runtimeReady: false,
        })
        globalThis.lgs.settings.widgets['text-widget'].configuration = null
        mocks.measureContent.mockClear()

        realignWidgetAroundContent('dynamic-stats-widget#1')

        expect(mocks.measureContent).not.toHaveBeenCalled()
        expect(statsTarget.style.left).toBe('40px')
        expect(statsTarget.style.top).toBe('50px')
        expect(statsTarget.style.width).toBe('180px')
        expect(statsTarget.style.height).toBe('60px')
        expect(mocks.updateRect).toHaveBeenCalled()
    })
})
