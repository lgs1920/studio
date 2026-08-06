/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: separator-element.test.jsx
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

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaColorPicker: ({onInput}) => <input aria-label="Separator color" onInput={onInput}/>,
    WaSlider: ({label, onInput, defaultValue}) => (
        <input aria-label={label} defaultValue={defaultValue} onInput={onInput}/>
    ),
    WaSwitch: ({children, onInput, checked}) => (
        <button type="button" aria-pressed={checked ? 'true' : 'false'} onClick={() => onInput({target: {checked: !checked}})}>
            {children}
        </button>
    ),
}))

import { SeparatorElement } from '@Components/MainUI/widgets/editor/elements/SeparatorElement'

describe('SeparatorElement', () => {
    beforeEach(() => {
        globalThis.lgs = {}
        globalThis.__ = {}
    })

    afterEach(() => {
        cleanup()
        globalThis.lgs = undefined
        globalThis.__ = undefined
    })

    it('keeps separator controls on separate lines and updates the right fields', () => {
        const element = proxy({
            separator: {
                show:    true,
                opacity: 0.5,
                padding: 4,
            },
        })
        const updateValue = vi.fn((path, value) => {
            const [section, key] = path.split('.')
            element[section] ??= {}
            element[section][key] = value
        })

        render(<SeparatorElement element={element} swatches="" getColor={() => '#ffffff'} updateValue={updateValue}/>)

        fireEvent.input(screen.getByLabelText('Opacity'), {target: {value: '0.8'}})
        fireEvent.input(screen.getByLabelText('Padding'), {target: {value: '7'}})

        expect(updateValue).toHaveBeenCalledWith('separator.opacity', 0.8)
        expect(updateValue).toHaveBeenCalledWith('separator.padding', 7)
    })
})
