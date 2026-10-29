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
 * Last modified: 2026-10-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@awesome.me/webawesome/dist/react', () => ({
    WaButton: ({children}) => <button>{children}</button>,
    WaButtonGroup: ({children}) => <div>{children}</div>,
    WaDivider:  () => <hr/>,
    WaIcon: () => <span/>,
    WaNumberInput: ({label, value}) => <input aria-label={label} value={value} readOnly/>,
    WaOption: ({children, value}) => <option value={value}>{children}</option>,
    WaSelect: ({label, value, children, onChange}) => (
        <label>{label}<select aria-label={label} value={value} onChange={event => onChange({target: {value: event.currentTarget.value}})}>{children}</select></label>
    ),
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
        expect(screen.queryByRole('slider', {name: 'Width'})).toBeNull()
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

    it('groups title and content settings in the content panel', () => {
        render(<MapPOIDisplaySettings poi="poi-1" hasDateTime onDisplayChange={vi.fn()} onStyleChange={vi.fn()}/>)

        const titleGroup = screen.getByRole('region', {name: 'Title'})
        const contentGroup = screen.getByRole('region', {name: 'Content'})

        expect(within(titleGroup).getByRole('checkbox', {name: 'Add Category'})).toBeTruthy()
        expect(within(titleGroup).getByRole('checkbox', {name: 'Add Altitude'})).toBeTruthy()
        expect(within(contentGroup).getByRole('checkbox', {name: 'Category'})).toBeTruthy()
        expect(within(contentGroup).getByRole('checkbox', {name: 'Date-Time'})).toBeTruthy()
        expect(screen.queryByRole('region', {name: 'Appearance'})).toBeNull()
        expect(screen.queryByRole('region', {name: 'Stick'})).toBeNull()
        expect(screen.getAllByRole('separator')).toHaveLength(1)
    })

    it('groups typography, appearance, and stick settings in the decoration panel', () => {
        render(<MapPOIDisplaySettings panel="decoration" poi="poi-1" onDisplayChange={vi.fn()} onStyleChange={vi.fn()}/>)

        const typographyGroup = screen.getByRole('region', {name: 'Typography'})
        const appearanceGroup = screen.getByRole('region', {name: 'Appearance'})
        const stickGroup = screen.getByRole('region', {name: 'Stick'})

        expect(within(typographyGroup).getByRole('combobox', {name: 'Typeface'})).toBeTruthy()
        expect(within(appearanceGroup).getByRole('combobox', {name: 'Style'}).value).toBe('pill')
        expect(within(appearanceGroup).getByRole('combobox', {name: 'Style'}).textContent).not.toMatch(/\b(?:01|02|05|08|16|19|24|34)\b/)
        expect(within(appearanceGroup).getByRole('checkbox', {name: 'Background'}).checked).toBe(true)
        expect(within(stickGroup).getByRole('combobox', {name: 'Horizontal anchor'}).value).toBe('50')
        expect(within(appearanceGroup).getByRole('slider', {name: 'Width'}).value).toBe('200')
        expect(screen.getAllByRole('separator')).toHaveLength(2)
    })

    it('persists selected POI styles and horizontal stick anchors', () => {
        const onDisplayValueChange = vi.fn()
        render(<MapPOIDisplaySettings panel="decoration" poi="poi-1" onDisplayValueChange={onDisplayValueChange}/>)

        fireEvent.change(screen.getByRole('combobox', {name: 'Style'}), {target: {value: 'slanted-banner'}})
        fireEvent.change(screen.getByRole('combobox', {name: 'Horizontal anchor'}), {target: {value: '80'}})

        expect(onDisplayValueChange).toHaveBeenNthCalledWith(1, 'style', 'slanted-banner')
        expect(onDisplayValueChange).toHaveBeenNthCalledWith(2, 'stickHorizontalPosition', '80')
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

        render(<MapPOIDisplaySettings panel="decoration" poi="poi-1" onDisplayChange={onDisplayChange}/>)
        fireEvent.input(screen.getByRole('slider', {name: 'Width'}), {target: {value: '340'}})

        expect(onDisplayChange).toHaveBeenCalledOnce()
        expect(onDisplayChange.mock.calls[0][0]).toBe('maxWidth')
        expect(onDisplayChange.mock.calls[0][1].target.value).toBe('340')
    })
})
