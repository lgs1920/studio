/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: background-element.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-16
 * Last modified on: 2026-07-16
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaColorPicker: ({onInput}) => <input aria-label="Background color" onInput={onInput}/>,
    WaSlider: ({label, onInput, defaultValue}) => (
        <input aria-label={label} defaultValue={defaultValue} onInput={onInput}/>
    ),
    WaSwitch: ({children, onInput, checked}) => (
        <button
            type="button"
            aria-pressed={checked ? 'true' : 'false'}
            onClick={() => onInput({target: {checked: !checked}})}
        >
            {children}
        </button>
    ),
}))

import { BackgroundElement } from '@Components/MainUI/widgets/editor/elements/BackgroundElement'

describe('BackgroundElement', () => {
    beforeEach(() => {
        globalThis.lgs = {}
        globalThis.__ = {}
    })

    afterEach(() => {
        cleanup()
        globalThis.lgs = undefined
        globalThis.__ = undefined
    })

    it('keeps the previous opacity when the background is disabled', () => {
        const element = proxy({
            background: {
                show:    true,
                blur:    true,
                opacity: 0.7,
            },
        })
        const updateValue = vi.fn((path, value) => {
            const [section, key] = path.split('.')
            element[section] ??= {}
            element[section][key] = value
        })

        render(<BackgroundElement element={element} swatches="" getColor={() => '#ffffff'} updateValue={updateValue}/>)

        fireEvent.click(screen.getByRole('button', {name: 'Background'}))

        expect(updateValue).toHaveBeenCalledWith('background.show', false)
        expect(updateValue).toHaveBeenCalledWith('background.blur', false)
        expect(updateValue).not.toHaveBeenCalledWith('background.opacity', 0)
        expect(element.background.opacity).toBe(0.7)
    })
})
