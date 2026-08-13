/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: text-widget-preview.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-18
 * Last modified: 2026-06-18
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { TextWidgetPreview } from '@Components/Text/TextWidgetPreview'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

const mocks = vi.hoisted(() => ({
    generateCSSVariables: vi.fn(() => ({
        '--lgs-tx-color': '#fff',
    })),
    measureContent: vi.fn(() => ({
        width:  120,
        height: 60,
    })),
}))

vi.mock('@Core/ui/text-metrics/TextWidgetManager', () => ({
    TextWidgetManager: {
        instance: {
            generateCSSVariables: mocks.generateCSSVariables,
            measureContent: mocks.measureContent,
        },
    },
}))

vi.mock('@Components/MainUI/widgets/useWidgetScaleCorrection', () => ({
    useWidgetScaleCorrection: () => 2,
}))

describe('TextWidgetPreview', () => {
    let originalRequestAnimationFrame
    let originalCancelAnimationFrame

    beforeEach(() => {
        originalRequestAnimationFrame = globalThis.requestAnimationFrame
        originalCancelAnimationFrame = globalThis.cancelAnimationFrame
        globalThis.requestAnimationFrame = cb => {
            cb?.(0)
            return 1
        }
        globalThis.cancelAnimationFrame = () => {}

        globalThis.lgs = {
            settings: proxy({
                widgets: {
                    'text-widget': {
                        configuration: proxy({
                            default: proxy({
                                text: {
                                    content: 'Hello',
                                },
                            }),
                            user: null,
                            elements: {
                                'text-widget#1': proxy({
                                    rotate: 45,
                                    text: {
                                        content: 'Hello',
                                    },
                                }),
                            },
                        }),
                    },
                },
            }),
            stores: {
                ui: proxy({
                    widget: proxy({
                        current: null,
                        currentSnapshot: null,
                    }),
                }),
            },
        }

        globalThis.__ = {
            ui: {
                widgetManager: {
                    getMoveable: vi.fn(() => ({
                        current: {
                            updateRect: vi.fn(),
                        },
                    })),
                    getWidgetPosition: vi.fn(async () => ({rotate: 0})),
                    getWidgetConfig: vi.fn(() => ({
                        dimensions: {
                            width:  120,
                            height: 60,
                        },
                    })),
                },
            },
        }

        mocks.generateCSSVariables.mockClear()
        mocks.measureContent.mockClear()
    })

    afterEach(() => {
        cleanup()
        globalThis.lgs = undefined
        globalThis.__ = undefined
        globalThis.requestAnimationFrame = originalRequestAnimationFrame
        globalThis.cancelAnimationFrame = originalCancelAnimationFrame
    })

    it('passes the widget scale correction to the text measurements', async () => {
        render(<TextWidgetPreview entity="text-widget#1"/>)

        await waitFor(() => {
            expect(mocks.generateCSSVariables).toHaveBeenCalled()
            expect(mocks.measureContent).toHaveBeenCalled()
        })

        expect(mocks.generateCSSVariables).toHaveBeenLastCalledWith(
            expect.objectContaining({
                text: expect.objectContaining({
                    content: 'Hello',
                }),
            }),
            null,
            expect.any(String),
            expect.objectContaining({correction: 2}),
        )
        expect(mocks.measureContent).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                text: expect.objectContaining({
                    content: 'Hello',
                }),
            }),
            expect.any(String),
            expect.objectContaining({buffer: 4, correction: 2}),
        )
        expect(mocks.measureContent).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                                        text: expect.objectContaining({
                                                                          content: 'Hello',
                                                                      }),
                                    }),
            expect.any(String),
            expect.objectContaining({buffer: 4, correction: 2}),
        )
    })

    it('keeps rotation applied while the preview editor is focused', async () => {
        const {container, getByRole} = render(<TextWidgetPreview entity="text-widget#1"/>)
        const editor = getByRole('textbox')
        const wrapper = container.querySelector('.lgs-editable-text-wrapper')

        expect(wrapper.style.transform).toContain('rotate(45deg)')

        fireEvent.focus(editor)

        await waitFor(() => {
            expect(wrapper.style.transform).toContain('rotate(45deg)')
        })
    })
})
