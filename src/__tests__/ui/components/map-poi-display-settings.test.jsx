/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: map-poi-display-settings.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-24
 * Last modified: 2026-10-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@awesome.me/webawesome/dist/react', () => ({
    WaDivider: () => <hr/>,
    WaSlider:  ({label, value, min, max, step, onChange}) => (
        <input
            type="range"
            aria-label={label}
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={event => onChange({target: {value: event.currentTarget.value}})}
        />
    ),
    WaSwitch:  ({checked, children, onChange}) => (
        <label>
            <input
                type="checkbox"
                aria-label={children}
                checked={checked}
                onChange={() => onChange({target: {checked: !checked}})}
            />
            {children}
        </label>
    ),
}))

import { MapPOIDisplaySettings } from '@Components/MainUI/MapPOI/MapPOIDisplaySettings'

afterEach(cleanup)

describe('MapPOIDisplaySettings', () => {
    it('shows the specified defaults for a POI without saved display choices', () => {
        render(<MapPOIDisplaySettings poi="poi-1" onDisplayChange={vi.fn()}/>)

        expect(screen.getByRole('heading', {name: 'Display'})).toBeTruthy()
        expect(screen.getByRole('checkbox', {name: 'Category'}).checked).toBe(true)
        expect(screen.getByRole('checkbox', {name: 'Category icon in title'}).checked).toBe(false)
        expect(screen.getByRole('checkbox', {name: 'Location'}).checked).toBe(false)
        expect(screen.getByRole('checkbox', {name: 'Altitude'}).checked).toBe(false)
        expect(screen.getByRole('checkbox', {name: 'Coordinates'}).checked).toBe(false)
        expect(screen.getByRole('checkbox', {name: 'Date-Time'}).checked).toBe(false)
        expect(screen.getByRole('slider', {name: 'Maximum width'}).value).toBe('200')
    })

    it('notifies the editor when the category icon choice changes', () => {
        const onDisplayChange = vi.fn()

        render(<MapPOIDisplaySettings poi="poi-1" onDisplayChange={onDisplayChange}/>)
        fireEvent.click(screen.getByRole('checkbox', {name: 'Category icon in title'}))

        expect(onDisplayChange).toHaveBeenCalledOnce()
        expect(onDisplayChange.mock.calls[0][0]).toBe('titleCategoryIcon')
        expect(onDisplayChange.mock.calls[0][1].target.checked).toBe(true)
    })

    it('notifies the editor when the expanded width changes', () => {
        const onDisplayChange = vi.fn()

        render(<MapPOIDisplaySettings poi="poi-1" onDisplayChange={onDisplayChange}/>)
        fireEvent.change(screen.getByRole('slider', {name: 'Maximum width'}), {target: {value: '340'}})

        expect(onDisplayChange).toHaveBeenCalledOnce()
        expect(onDisplayChange.mock.calls[0][0]).toBe('maxWidth')
        expect(onDisplayChange.mock.calls[0][1].target.value).toBe('340')
    })
})
