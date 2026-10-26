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
 * Last modified: 2026-10-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@awesome.me/webawesome/dist/react', () => ({
    WaDivider:  () => <hr/>,
    WaSlider:  ({label, value, min, max, step, onInput}) => (
        <input
            type="range"
            aria-label={label}
            value={value}
            min={min}
            max={max}
            step={step}
            onInput={event => onInput({target: {value: event.currentTarget.value}})}
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

beforeEach(() => {
    const poiDefaults = {
        category:          true,
        titleCategoryIcon: false,
        titleAltitude:     false,
        location:          false,
        altitude:          false,
        coordinates:       false,
        dateTime:          false,
    }
    vi.stubGlobal('lgs', {
        savedConfiguration: {poi: {displayDefaults: poiDefaults}},
        configuration: {poi: {displayDefaults: poiDefaults}},
        settings: {poi: {displayDefaults: poiDefaults}},
    })
})

afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
})

describe('MapPOIDisplaySettings', () => {
    it('shows the specified defaults for a POI without saved display choices', () => {
        render(<MapPOIDisplaySettings poi="poi-1" hasDateTime onDisplayChange={vi.fn()}/>)

        expect(screen.getByRole('checkbox', {name: 'Category'}).checked).toBe(true)
        expect(screen.getByRole('checkbox', {name: 'Add Category'}).checked).toBe(false)
        expect(screen.getByRole('checkbox', {name: 'Add Altitude'}).checked).toBe(false)
        expect(screen.getByRole('checkbox', {name: 'Location'}).checked).toBe(false)
        expect(screen.getByRole('checkbox', {name: 'Altitude'}).checked).toBe(false)
        expect(screen.getByRole('checkbox', {name: 'Coordinates'}).checked).toBe(false)
        expect(screen.getByRole('checkbox', {name: 'Date-Time'}).checked).toBe(false)
        expect(screen.getByRole('slider', {name: 'Width'}).value).toBe('200')
    })

    it('shows YAML defaults for a POI saved with the previous code defaults', () => {
        render(<MapPOIDisplaySettings
            poi="legacy-poi"
            display={{
                category:          false,
                titleCategoryIcon: true,
                titleAltitude:     false,
                location:          false,
                altitude:          false,
                coordinates:       false,
                dateTime:          false,
                maxWidth:          200,
            }}
            onDisplayChange={vi.fn()}
        />)

        expect(screen.getByRole('checkbox', {name: 'Category'}).checked).toBe(true)
        expect(screen.getByRole('checkbox', {name: 'Add Category'}).checked).toBe(false)
    })

    it('groups title, content, and appearance settings with separators', () => {
        render(<MapPOIDisplaySettings poi="poi-1" hasDateTime onDisplayChange={vi.fn()} onStyleChange={vi.fn()}/>)

        const titleGroup = screen.getByRole('region', {name: 'Title'})
        const contentGroup = screen.getByRole('region', {name: 'Content'})
        const appearanceGroup = screen.getByRole('region', {name: 'Appearance'})

        expect(within(titleGroup).getByRole('checkbox', {name: 'Add Category'})).toBeTruthy()
        expect(within(titleGroup).getByRole('checkbox', {name: 'Add Altitude'})).toBeTruthy()
        expect(within(contentGroup).getByRole('checkbox', {name: 'Category'})).toBeTruthy()
        expect(within(contentGroup).getByRole('checkbox', {name: 'Date-Time'})).toBeTruthy()
        expect(within(appearanceGroup).getByRole('checkbox', {name: 'Pill'})).toBeTruthy()
        expect(within(appearanceGroup).getByRole('checkbox', {name: 'No background'})).toBeTruthy()
        expect(within(appearanceGroup).getByRole('slider', {name: 'Width'})).toBeTruthy()
        expect(screen.getAllByRole('separator')).toHaveLength(2)
    })

    it('notifies the editor when the category icon choice changes', () => {
        const onDisplayChange = vi.fn()

        render(<MapPOIDisplaySettings poi="poi-1" onDisplayChange={onDisplayChange}/>)
        fireEvent.click(screen.getByRole('checkbox', {name: 'Add Category'}))

        expect(onDisplayChange).toHaveBeenCalledOnce()
        expect(onDisplayChange.mock.calls[0][0]).toBe('titleCategoryIcon')
        expect(onDisplayChange.mock.calls[0][1].target.checked).toBe(true)
    })

    it('notifies the editor when altitude is added to the title', () => {
        const onDisplayChange = vi.fn()

        render(<MapPOIDisplaySettings poi="poi-1" onDisplayChange={onDisplayChange}/>)
        fireEvent.click(screen.getByRole('checkbox', {name: 'Add Altitude'}))

        expect(onDisplayChange).toHaveBeenCalledOnce()
        expect(onDisplayChange.mock.calls[0][0]).toBe('titleAltitude')
        expect(onDisplayChange.mock.calls[0][1].target.checked).toBe(true)
    })

    it('notifies the editor when the expanded width changes', () => {
        const onDisplayChange = vi.fn()

        render(<MapPOIDisplaySettings poi="poi-1" onDisplayChange={onDisplayChange}/>)
        fireEvent.input(screen.getByRole('slider', {name: 'Width'}), {target: {value: '340'}})

        expect(onDisplayChange).toHaveBeenCalledOnce()
        expect(onDisplayChange.mock.calls[0][0]).toBe('maxWidth')
        expect(onDisplayChange.mock.calls[0][1].target.value).toBe('340')
    })
})
