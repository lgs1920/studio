/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: map-poi-edit-replay-animation.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-26
 * Last modified: 2026-11-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'
import {proxyMap} from 'valtio/utils'

vi.mock('@Components/DateTimeDisplay', () => ({DateTimeDisplay: () => null}))
vi.mock('@Components/MainUI/LGSScrollbars', () => ({
    LGSScrollbars: ({children}) => <div data-testid="lgs-scrollbar">{children}</div>,
}))
vi.mock('@Components/MainUI/MapPOI/MapPOICategorySelector', () => ({MapPOICategorySelector: () => null}))
vi.mock('@Components/MainUI/MapPOI/MapPOIDisplaySettings', () => ({MapPOIDisplaySettings: () => null}))
vi.mock('@Components/MainUI/MapPOI/MapPOIEditMenu', () => ({MapPOIEditMenu: () => null}))
vi.mock('@Components/MainUI/MapPOI/MapPOIEditPreview', () => ({
    MapPOIEditPreview: () => <div className="map-poi-edit-preview"/>,
}))
vi.mock('@Components/MainUI/MapPOI/usePOIJourneyAssociation', () => ({
    NO_ASSOCIATED_JOURNEY_LABEL: 'No associated journey',
    usePOIJourneyAssociation: () => ({canAssociate: false}),
}))
vi.mock('@Editor/journey/JourneySelector', () => ({JourneySelector: () => null}))
vi.mock('@awesome.me/webawesome/dist/react', () => ({
    WaButton: ({children, ...props}) => <button {...props}>{children}</button>,
    WaColorPicker: ({label, value, className, onClickCapture, onChange, disabled}) => (
        <input
            type="text"
            aria-label={label}
            value={value ?? ''}
            className={className}
            onClickCapture={onClickCapture}
            onChange={onChange}
            disabled={disabled}
        />
    ),
    WaCopyButton: () => null,
    WaDivider: () => null,
    WaIcon: () => null,
    WaInput: () => null,
    WaSwitch: ({checked, children, className, disabled, onInput}) => (
        <label className={className}>
            <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={event => onInput?.({target: event.target})}
            />
            {children}
        </label>
    ),
    WaTab: ({children}) => <div>{children}</div>,
    WaTabGroup: ({children, className}) => <div className={className}>{children}</div>,
    WaTabPanel: ({children}) => <div>{children}</div>,
    WaTextarea: () => null,
    WaTooltip: () => null,
}))

import {MapPOIEditContent} from '@Components/MainUI/MapPOI/MapPOIEditContent'

describe('MapPOIEditContent settings', () => {
    let poi
    let poiList
    let updatePOI

    beforeEach(() => {
        poi = proxy({
            id: 'poi-1',
            type: 'poi',
            title: 'River stop',
            description: '',
            latitude: 48.2,
            longitude: 2.3,
            height: 125,
            simulatedHeight: 0,
            visible: true,
            background: true,
            color: '#112233',
            bgColor: '#445566',
            replay: {
                visible: true,
                animated: false,
                hiddenFields: {category: true},
            },
            display: {},
        })
        poiList = proxyMap([[poi.id, poi]])
        updatePOI = vi.fn(async (_poiId, updates) => {
            Object.assign(poi, updates)
            return poi
        })

        globalThis.lgs = {
            colors: {poiDefault: '#000000', poiDefaultBackground: '#ffffff'},
            settings: proxy({
                unitSystem: {current: 0},
                coordinateSystem: {current: 'decimal'},
                getSwatches: {list: []},
                ui: {poi: {focusOnEdit: false}},
            }),
            stores: proxy({main: {components: {pois: {list: poiList}}}}),
        }
        globalThis.__ = {
            convert: value => ({to: () => String(value)}),
            ui: {
                cameraManager: {isRotating: vi.fn(() => false)},
                drawerManager: {consumeSuppressFocusOnOpen: vi.fn(() => true)},
                poiManager: {
                    ensurePOILocation: vi.fn(),
                    updatePOI,
                },
            },
        }
        window.isOK = true
    })

    afterEach(() => {
        cleanup()
        vi.restoreAllMocks()
        globalThis.lgs = undefined
        globalThis.__ = undefined
    })

    it('places the per-POI Replay switch below the preview and outside the tabs', async () => {
        const {container} = render(<MapPOIEditContent poi="poi-1"/>)
        const preview = container.querySelector('.map-poi-edit-preview')
        const tabGroup = container.querySelector('.map-poi-edit-tabs')
        const animationSwitch = screen.getByLabelText('Animate during Replay')
        const replayControls = preview.nextElementSibling

        expect(replayControls.classList.contains('map-poi-display-controls')).toBe(true)
        expect(replayControls.querySelector('.map-poi-style-switch')).toBe(animationSwitch.closest('.map-poi-style-switch'))
        expect(replayControls.nextElementSibling).toBe(tabGroup)
        expect(tabGroup.contains(replayControls)).toBe(false)
        expect(animationSwitch.checked).toBe(false)
        expect(tabGroup.querySelectorAll('.map-poi-edit-tab-scroll-area')).toHaveLength(3)
        expect(tabGroup.querySelectorAll('[data-testid="lgs-scrollbar"]')).toHaveLength(3)
    })

    it('immediately persists the updated Replay animation setting', async () => {
        render(<MapPOIEditContent poi="poi-1"/>)
        const animationSwitch = screen.getByLabelText('Animate during Replay')

        fireEvent.click(animationSwitch)

        await waitFor(() => {
            expect(updatePOI).toHaveBeenCalledWith('poi-1', {
                replay: {
                    visible: true,
                    animated: true,
                    hiddenFields: {category: true},
                },
            }, {immediate: true, markAsEdited: true})
        })
    })

    it('shows Text, Colour, and Border swatches in that order with the legacy text color preserved', () => {
        render(<MapPOIEditContent poi="poi-1"/>)

        const swatches = [...document.querySelector('.map-poi-edit-swatches').querySelectorAll('input[aria-label]')]
        expect(swatches.map(swatch => swatch.getAttribute('aria-label'))).toEqual(['Text', 'Colour', 'Border'])
        expect(swatches.map(swatch => swatch.value)).toEqual(['#112233', '#445566', '#112233'])
        expect(swatches.every(swatch => swatch.classList.contains('wa-visually-hidden-label'))).toBe(true)
    })

    it('changes Text independently and preserves the legacy Border color', async () => {
        render(<MapPOIEditContent poi="poi-1"/>)
        const textPicker = screen.getByLabelText('Text')

        fireEvent.click(textPicker)
        fireEvent.change(textPicker, {target: {value: '#abcdef'}})

        await waitFor(() => expect(updatePOI).toHaveBeenCalledWith('poi-1', {
            color: '#abcdef',
            borderColor: '#112233',
        }, {markAsEdited: true}))
        expect(poi.bgColor).toBe('#445566')
        expect(poi.borderColor).toBe('#112233')
    })

    it('keeps Border at its initial Text color when Colour changes normally', async () => {
        render(<MapPOIEditContent poi="poi-1"/>)
        const colourPicker = screen.getByLabelText('Colour')

        fireEvent.click(colourPicker)
        fireEvent.change(colourPicker, {target: {value: '#aabbcc'}})

        await waitFor(() => expect(updatePOI).toHaveBeenCalledWith('poi-1', {
            bgColor: '#aabbcc',
            borderColor: '#112233',
        }, {markAsEdited: true}))
        expect(poi.color).toBe('#112233')
        expect(poi.borderColor).toBe('#112233')
    })

    it('changes only Border when its picker changes normally', async () => {
        render(<MapPOIEditContent poi="poi-1"/>)
        const borderPicker = screen.getByLabelText('Border')

        fireEvent.click(borderPicker)
        fireEvent.change(borderPicker, {target: {value: '#123456'}})

        await waitFor(() => expect(updatePOI).toHaveBeenCalledWith('poi-1', {
            borderColor: '#123456',
        }, {markAsEdited: true}))
        expect(poi.bgColor).toBe('#445566')
        expect(poi.color).toBe('#112233')
    })

    it('applies Shift captured on the Colour picker open to both frame colors after Shift is released', async () => {
        render(<MapPOIEditContent poi="poi-1"/>)
        const picker = screen.getByLabelText('Colour')

        fireEvent.click(picker, {shiftKey: true})
        fireEvent.change(picker, {target: {value: '#123456'}})

        await waitFor(() => expect(updatePOI).toHaveBeenCalledWith('poi-1', {
            bgColor: '#123456',
            borderColor: '#123456',
        }, {markAsEdited: true}))
        expect(poi.color).toBe('#112233')
    })

    it.each(['Text', 'Border'])('applies Shift captured on the %s picker open to Text and Border after Shift is released', async label => {
        render(<MapPOIEditContent poi="poi-1"/>)
        const picker = screen.getByLabelText(label)

        fireEvent.click(picker, {shiftKey: true})
        fireEvent.change(picker, {target: {value: '#123456'}})

        await waitFor(() => expect(updatePOI).toHaveBeenCalledWith('poi-1', {
            color: '#123456',
            borderColor: '#123456',
        }, {markAsEdited: true}))
        expect(poi.bgColor).toBe('#445566')
    })

    it('reverses only Colour and Border', async () => {
        poi.borderColor = '#778899'
        render(<MapPOIEditContent poi="poi-1"/>)

        fireEvent.click(screen.getByRole('button', {name: 'Reverse color'}))

        await waitFor(() => expect(updatePOI).toHaveBeenCalledWith('poi-1', {
            bgColor: '#778899',
            borderColor: '#445566',
        }, {markAsEdited: true}))
        expect(poi.color).toBe('#112233')
    })
})
