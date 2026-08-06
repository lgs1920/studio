/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: padding-element-realignment.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-03
 * Last modified on: 2026-07-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

const mocks = vi.hoisted(() => ({
    realignWidgetAroundContent: vi.fn(),
    updateRect:                vi.fn(),
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaSlider: ({label, onInput, defaultValue}) => (
        <input
            aria-label={label}
            defaultValue={defaultValue}
            onInput={onInput}
        />
    ),
}))

vi.mock('@Components/MainUI/widgets/editor/elements/ScaleSwitchElement', () => ({
    ScaleSwitchElement: () => null,
}))

vi.mock('@Components/MainUI/widgets/editor/elements/widgetContentRealign', () => ({
    realignWidgetAroundContent: mocks.realignWidgetAroundContent,
}))

import { PaddingElement } from '@Components/MainUI/widgets/editor/elements/PaddingElement'

describe('PaddingElement', () => {
    beforeEach(() => {
        globalThis.lgs = {
            settings: {},
        }

        globalThis.__ = {
            ui: {
                widgetManager: {
                    getMoveable: vi.fn(() => ({
                        current: {
                            updateRect: mocks.updateRect,
                        },
                    })),
                },
            },
        }

        mocks.realignWidgetAroundContent.mockClear()
        mocks.updateRect.mockClear()
    })

    afterEach(() => {
        cleanup()
        globalThis.lgs = undefined
        globalThis.__ = undefined
    })

    it('only refreshes the moveable rect when auto realign is disabled', async () => {
        const element = proxy({
            padding: {
                top:    8,
                right:  8,
                bottom: 8,
                left:   8,
                scaled: false,
            },
        })
        const updateValue = vi.fn((path, value) => {
            const [section, key] = path.split('.')
            element[section] ??= {}
            element[section][key] = value
        })

        render(<PaddingElement element={element} updateValue={updateValue} moveableId="widget#1" fallback={8}/>)

        fireEvent.input(screen.getByLabelText('Padding'), {target: {value: '12'}})

        await waitFor(() => expect(mocks.updateRect).toHaveBeenCalled())
        expect(mocks.realignWidgetAroundContent).not.toHaveBeenCalled()
    })

    it('keeps the realignment path when auto realign is enabled', async () => {
        const element = proxy({
            padding: {
                top:    8,
                right:  8,
                bottom: 8,
                left:   8,
                scaled: false,
            },
        })
        const updateValue = vi.fn((path, value) => {
            const [section, key] = path.split('.')
            element[section] ??= {}
            element[section][key] = value
        })

        render(<PaddingElement element={element} updateValue={updateValue} moveableId="widget#1" fallback={8} autoRealign/>)

        fireEvent.input(screen.getByLabelText('Padding'), {target: {value: '12'}})

        await waitFor(() => expect(mocks.realignWidgetAroundContent).toHaveBeenCalledWith('widget#1'))
    })
})
