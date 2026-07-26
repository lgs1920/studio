/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: text-color-element-swatches.test.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-24
 * Last modified on: 2026-07-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaColorPicker: ({swatches}) => <div data-testid="color-picker" data-swatches={swatches}/>,
    WaSlider: ({label}) => <div data-testid={`slider-${label}`}/>,
}))

import { TextColorElement } from '@Components/MainUI/widgets/editor/elements/TextColorElement'

describe('TextColorElement swatches', () => {
    beforeEach(() => {
        globalThis.lgs = {
            settings: {
                swatches: proxy({list: ['#111111', '#222222']}),
                widgets: {
                    'text-widget': {
                        configuration: proxy({
                            default: {
                                text: {
                                    color:   '#111111',
                                    opacity: 1,
                                },
                            },
                            user:     null,
                            elements: {},
                        }),
                    },
                },
            },
        }

        globalThis.__ = {
            ui: {
                css: {
                    setCSSVariable: vi.fn(),
                },
                widgetManager: {
                    getElementById: vi.fn(() => null),
                    getMoveable:    vi.fn(() => null),
                },
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.lgs = undefined
        globalThis.__ = undefined
    })

    it('rebuilds the swatches string when the swatches store changes', async () => {
        render(<TextColorElement id="default" title="Text color"/>)

        expect(screen.getByTestId('color-picker').getAttribute('data-swatches')).toBe('#111111;#222222')

        globalThis.lgs.settings.swatches.list[1] = '#333333'

        await waitFor(() => {
            expect(screen.getByTestId('color-picker').getAttribute('data-swatches')).toBe('#111111;#333333')
        })
    })
})
