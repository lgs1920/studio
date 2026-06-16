/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: editable-text.test.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-16
 * Last modified on: 2026-06-16
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, render, waitFor } from '@testing-library/react'
import { EditableText } from '@Components/Text/EditableText'
import { AlignElement } from '@Components/MainUI/widgets/editor/elements/AlignElement'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
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

vi.mock('@Core/events/shortcutBlockers', () => ({
    hasActiveAppShortcutBlocker: () => false,
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, disabled, ...props}) => <button type="button" disabled={disabled} {...props}>{children}</button>,
    WaButtonGroup: ({children, ...props}) => <div {...props}>{children}</div>,
    WaIcon: () => <span aria-hidden="true"/>,
}))

describe('EditableText', () => {
    let originalRequestAnimationFrame
    let originalCancelAnimationFrame
    let updateRect

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
                                padding: {
                                    top:    10,
                                    right:  10,
                                    bottom: 10,
                                    left:   10,
                                    scaled: false,
                                },
                            }),
                            user: null,
                            elements: {
                                'text-widget#1': proxy({
                                    text: {
                                        content: 'Hello',
                                    },
                                    padding: {
                                        top:    10,
                                        right:  10,
                                        bottom: 10,
                                        left:   10,
                                        scaled: false,
                                    },
                                }),
                            },
                        }),
                    },
                },
            }),
            stores: {
                ui: proxy({
                    drawers: proxy({
                        entity: null,
                        open:   null,
                    }),
                }),
            },
        }

        globalThis.__ = {
            ui: {
                widgetManager: {
                    getMoveable: vi.fn(() => ({
                        current: {
                            updateRect,
                        },
                    })),
                    getElementById: vi.fn(() => ({
                        style: {},
                    })),
                    getWidgetConfig: vi.fn(() => ({
                        dimensions: {width: 120, height: 60},
                        position:   {left: 0, top: 0},
                        persist:    false,
                        runtimeReady: false,
                    })),
                },
            },
        }

        updateRect = vi.fn()
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

    it('uses the widget scale correction when measuring live text padding', async () => {
        render(<EditableText id="text-widget#1"/>)

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
            undefined,
            expect.objectContaining({correction: 2}),
        )
        expect(mocks.measureContent).toHaveBeenLastCalledWith(
            expect.objectContaining({
                text: expect.objectContaining({
                    content: 'Hello',
                }),
            }),
            undefined,
            expect.objectContaining({correction: 2}),
        )
    })

    it('updates alignment controls and the moveable rect while editing multiline text', async () => {
        render(
            <>
                <EditableText id="text-widget#1"/>
                <AlignElement id="text-widget#1"/>
            </>,
        )

        const editable = screen.getByText('Hello')
        fireEvent.click(editable)
        updateRect.mockClear()

        fireEvent.input(editable, {
            target: {
                innerText: 'Hello\nWorld',
                textContent: 'Hello\nWorld',
            },
        })

        await waitFor(() => {
            expect(globalThis.lgs.settings.widgets['text-widget'].configuration.elements['text-widget#1'].text.content).toBe('Hello\nWorld')
            expect(screen.getAllByRole('button').every(button => button.disabled === false)).toBe(true)
            expect(updateRect).toHaveBeenCalled()
        })

        updateRect.mockClear()
        fireEvent.input(editable, {
            target: {
                innerText: 'Hello',
                textContent: 'Hello',
            },
        })

        await waitFor(() => {
            expect(globalThis.lgs.settings.widgets['text-widget'].configuration.elements['text-widget#1'].text.content).toBe('Hello')
            expect(screen.getAllByRole('button').every(button => button.disabled === true)).toBe(true)
            expect(updateRect).toHaveBeenCalled()
        })
    })
})
