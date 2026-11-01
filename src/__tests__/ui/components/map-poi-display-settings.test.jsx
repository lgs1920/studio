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
 * Last modified: 2026-11-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@awesome.me/webawesome/dist/react', () => ({
    WaButton: ({children, ...props}) => <button {...props}>{children}</button>,
    WaButtonGroup: ({children}) => <div>{children}</div>,
    WaDivider:  () => <hr/>,
    WaIcon: ({name, ...props}) => <span data-icon={name} {...props}/>,
    WaNumberInput: ({label, value}) => <input aria-label={label} value={value} readOnly/>,
    WaOption: ({children, value}) => <option value={value}>{children}</option>,
    WaSelect: ({label, value, children, onChange}) => (
        <label>{label}<select aria-label={label} value={value} onChange={event => onChange({target: {value: event.currentTarget.value}})}>{children}</select></label>
    ),
    WaSlider:  ({label, value, min, max, step, size, withMarkers, onInput, children}) => (
        <div>
            <input
                type="range"
                aria-label={label}
                data-with-markers={withMarkers}
                value={value}
                min={min}
                max={max}
                step={step}
                data-size={size}
                onInput={event => onInput({target: {value: event.currentTarget.value}})}
            />
            {children}
        </div>
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
    WaTooltip: () => null,
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
        expect(within(typographyGroup).getByText('Text style')).toBeTruthy()
        expect(within(appearanceGroup).getByRole('combobox', {name: 'Style'}).value).toBe('pill')
        expect(within(appearanceGroup).getByRole('combobox', {name: 'Style'}).textContent).not.toMatch(/\b(?:01|02|05|08|16|19|24|34)\b/)
        expect([...within(appearanceGroup).getByRole('combobox', {name: 'Style'}).querySelectorAll('option')]
            .map(option => option.textContent)).toEqual([
            'Icon frame', 'Label', 'Open frame', 'Pill', 'Round badge', 'Rounded', 'Side accent', 'Slanted banner', 'Underline',
        ])
        expect(within(appearanceGroup).getByRole('checkbox', {name: 'Background'}).checked).toBe(true)
        expect(within(stickGroup).getByRole('group', {name: 'Anchor'})).toBeTruthy()
        expect(within(stickGroup).getByRole('button', {name: 'Bottom 50%'}).getAttribute('aria-pressed')).toBe('true')
        expect(within(appearanceGroup).getByRole('slider', {name: 'Width'}).value).toBe('200')
        expect(screen.getAllByRole('slider').every(slider => slider.dataset.size === 's')).toBe(true)
        expect(within(appearanceGroup).getByRole('slider', {name: 'Border'})).toBeTruthy()
        expect(screen.getAllByRole('separator')).toHaveLength(3)
    })

    it('persists selected POI styles and horizontal stick anchors', () => {
        const onDisplayValueChange = vi.fn()
        render(<MapPOIDisplaySettings
            panel="decoration"
            poi="poi-1"
            display={{stickPosition: 'below', stickAngle: 'straight'}}
            onDisplayValueChange={onDisplayValueChange}
        />)

        fireEvent.change(screen.getByRole('combobox', {name: 'Style'}), {target: {value: 'slanted-banner'}})
        fireEvent.click(screen.getByRole('button', {name: 'Right 80%'}))

        expect(onDisplayValueChange).toHaveBeenNthCalledWith(1, 'style', 'slanted-banner')
        expect(onDisplayValueChange).toHaveBeenNthCalledWith(2, {
            stickPosition: 'right',
            stickHorizontalPosition: 80,
        })
    })

    it('stores the side chosen in the anchor picker without reversing it', () => {
        const onDisplayValueChange = vi.fn()
        render(<MapPOIDisplaySettings
            panel="decoration"
            poi="poi-1"
            display={{stickPosition: 'left', stickAngle: 'straight', stickHorizontalPosition: 50}}
            onDisplayValueChange={onDisplayValueChange}
        />)

        const anchorPicker = screen.getByRole('group', {name: 'Anchor'})
        fireEvent.click(within(anchorPicker).getByRole('button', {name: 'Right 50%'}))
        fireEvent.click(within(anchorPicker).getByRole('button', {name: 'Left 20%'}))

        expect(onDisplayValueChange).toHaveBeenNthCalledWith(1, {
            stickPosition: 'right',
            stickHorizontalPosition: 50,
        })
        expect(onDisplayValueChange).toHaveBeenNthCalledWith(2, {
            stickPosition: 'left',
            stickHorizontalPosition: 20,
        })
    })

    it('uses the standard Brand appearance for the selected anchor and centers anchors on the card edges', () => {
        render(<MapPOIDisplaySettings
            panel="decoration"
            poi="poi-1"
            display={{stickPosition: 'right', stickAngle: 'straight', stickHorizontalPosition: 50}}
            onDisplayValueChange={vi.fn()}
        />)

        const anchorPicker = screen.getByRole('group', {name: 'Anchor'})
        const selected = within(anchorPicker).getByRole('button', {name: 'Right 50%'})
        const topAnchor = within(anchorPicker).getByRole('button', {name: 'Top 20%'})
        const bottomAnchor = within(anchorPicker).getByRole('button', {name: 'Bottom 80%'})

        expect(selected.getAttribute('aria-pressed')).toBe('true')
        expect(selected.getAttribute('variant')).toBe('brand')
        expect(selected.getAttribute('appearance')).toBe('accent')
        expect(selected.style.getPropertyValue('--wa-color-fill-normal')).toBe('')
        expect(selected.style.left).toBe('97%')
        expect(selected.style.top).toBe('50%')
        expect(topAnchor.style.left).toBe('47.4%')
        expect(topAnchor.style.top).toBe('12%')
        expect(bottomAnchor.style.left).toBe('84.6%')
        expect(bottomAnchor.style.top).toBe('88%')
    })

    it('remounts the angle selector when the selected anchor changes its orientation', () => {
        const props = {
            panel: 'decoration',
            poi: 'poi-1',
            onDisplayValueChange: vi.fn(),
        }
        const {rerender} = render(<MapPOIDisplaySettings
            {...props}
            display={{stickPosition: 'right', stickAngle: 'straight'}}
        />)
        const horizontalSelector = screen.getByRole('combobox', {name: 'Angle'})

        expect(horizontalSelector.selectedOptions[0].textContent).toBe('Horizontal')

        rerender(<MapPOIDisplaySettings
            {...props}
            display={{stickPosition: 'above', stickAngle: 'straight'}}
        />)

        const verticalSelector = screen.getByRole('combobox', {name: 'Angle'})
        expect(verticalSelector).not.toBe(horizontalSelector)
        expect(verticalSelector.selectedOptions[0].textContent).toBe('Vertical')
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

    it('offers border widths and non-pill radii for rounded POIs', () => {
        const onDisplayValueChange = vi.fn()
        render(<MapPOIDisplaySettings
            panel="decoration"
            poi="poi-1"
            display={{style: 'rounded'}}
            onDisplayValueChange={onDisplayValueChange}
        />)

        const appearance = screen.getByRole('region', {name: 'Appearance'})
        const width = within(appearance).getByRole('slider', {name: 'Border'})
        const radius = within(appearance).getByRole('slider', {name: 'Radius'})
        expect([width.min, width.max, width.step]).toEqual(['2', '6', '1'])
        expect([radius.min, radius.max, radius.step]).toEqual(['0', '3', '1'])
        expect(width.dataset.withMarkers).toBe('true')
        expect(radius.dataset.withMarkers).toBe('true')
        expect(within(appearance).getByText('S')).toBeTruthy()
        expect(within(appearance).getByText('M')).toBeTruthy()
        expect(within(appearance).getByText('L')).toBeTruthy()
        expect(within(appearance).queryByText('None')).toBeNull()
        expect(appearance.querySelector('[data-icon="eye-slash"]')).toBeTruthy()

        fireEvent.input(width, {target: {value: '5'}})
        fireEvent.input(radius, {target: {value: '2'}})
        expect(onDisplayValueChange).toHaveBeenNthCalledWith(1, 'borderWidth', 5)
        expect(onDisplayValueChange).toHaveBeenNthCalledWith(2, 'borderRadius', 'medium')
    })

    it.each(['pill', 'underline'])('hides radius choices for the %s style', style => {
        render(<MapPOIDisplaySettings
            panel="decoration"
            poi="poi-1"
            display={{style}}
            onDisplayValueChange={vi.fn()}
        />)

        const appearance = screen.getByRole('region', {name: 'Appearance'})
        expect(within(appearance).getByRole('slider', {name: 'Border'})).toBeTruthy()
        expect(within(appearance).queryByRole('slider', {name: 'Radius'})).toBeNull()
    })

    it('hides border controls for the borderless label style', () => {
        render(<MapPOIDisplaySettings
            panel="decoration"
            poi="poi-1"
            display={{style: 'label'}}
            onDisplayValueChange={vi.fn()}
        />)

        expect(screen.queryByRole('slider', {name: 'Border'})).toBeNull()
        expect(screen.queryByRole('slider', {name: 'Radius'})).toBeNull()
    })
})
