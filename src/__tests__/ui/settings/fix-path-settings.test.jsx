/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: fix-path-settings.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-19
 * Last modified: 2026-10-19
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {FixPathSettings} from '@Components/Settings/application/general/FixPathSettings'
import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'

vi.mock('@awesome.me/webawesome/dist/react', () => ({
    WaDivider: () => null,
    WaIcon: ({name}) => <span>{name}</span>,
    WaInput: ({label, min, max, step, type, value, onInput, onBlur}) => (
        <label>
            {label}
            <input aria-label={label} min={min} max={max} step={step} type={type} value={value} onInput={onInput} onBlur={onBlur}/>
        </label>
    ),
}))

describe('Fix Path application setting', () => {
    const previousLgs = globalThis.lgs

    afterEach(() => {
        cleanup()
        globalThis.lgs = previousLgs
    })

    it('shows the persisted 500 m default and accepts a new limit', () => {
        globalThis.lgs = {settings: {journey: proxy({fixPathMaxSegmentMeters: 500})}}
        render(<FixPathSettings/>)

        const input = screen.getByRole('spinbutton', {name: 'Maximum correction section length'})
        expect(input.value).toBe('500')
        expect(input.min).toBe('50')
        expect(input.max).toBe('5000')

        fireEvent.input(input, {target: {value: '1250'}})
        expect(globalThis.lgs.settings.journey.fixPathMaxSegmentMeters).toBe(500)
        fireEvent.blur(input)
        expect(globalThis.lgs.settings.journey.fixPathMaxSegmentMeters).toBe(1250)
    })

    it('restores an invalid value without changing the saved preference', () => {
        globalThis.lgs = {settings: {journey: proxy({fixPathMaxSegmentMeters: 800})}}
        render(<FixPathSettings/>)

        const input = screen.getByRole('spinbutton', {name: 'Maximum correction section length'})
        fireEvent.input(input, {target: {value: '20'}})
        expect(globalThis.lgs.settings.journey.fixPathMaxSegmentMeters).toBe(800)
        fireEvent.blur(input)
        expect(input.value).toBe('800')
    })
})
