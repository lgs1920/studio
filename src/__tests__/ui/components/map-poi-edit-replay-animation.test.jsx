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
 * Last modified: 2026-11-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'
import {proxyMap} from 'valtio/utils'
import {normalizePOIDisplaySettings} from '@Core/POIDisplaySettings'
import {poiPresentationClipboardStore, copyPOIPresentation} from '@Components/MainUI/MapPOI/poiPresentationClipboard'

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
    WaColorPicker: ({id, label, value, className, onClickCapture, onChange, disabled}) => (
        <input
            id={id}
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
    WaTooltip: ({children, for: targetId}) => <span data-tooltip-for={targetId}>{children}</span>,
}))

import {MapPOIEditContent} from '@Components/MainUI/MapPOI/MapPOIEditContent'

describe('MapPOIEditContent settings', () => {
    let poi
    let poiList
    let updatePOI

    beforeEach(() => {
        poiPresentationClipboardStore.entry = null
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
        poiPresentationClipboardStore.entry = null
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

    it('shows Text, Border, and Background swatches with matching tooltips and the legacy text color preserved', () => {
        const {container} = render(<MapPOIEditContent poi="poi-1"/>)

        const swatches = [...container.querySelector('.map-poi-edit-swatches').querySelectorAll('input[aria-label]')]
        expect(swatches.map(swatch => swatch.getAttribute('aria-label'))).toEqual(['Text', 'Border', 'Background'])
        expect(swatches.map(swatch => swatch.value)).toEqual(['#112233', '#112233', '#445566'])
        expect(swatches.every(swatch => swatch.classList.contains('wa-visually-hidden-label'))).toBe(true)
        expect(container.querySelector('[data-tooltip-for="map-poi-text-poi-1"]').textContent).toBe('Text')
        expect(container.querySelector('[data-tooltip-for="map-poi-border-poi-1"]').textContent).toBe('Border')
        expect(container.querySelector('[data-tooltip-for="map-poi-bg-poi-1"]').textContent).toBe('Background')
        expect(screen.getByRole('button', {name: 'Link Text and Border colors'}).getAttribute('aria-pressed'))
            .toBe('false')
    })

    it('shows the linked state from the POI record and persists unlinking', async () => {
        poi.textBorderColorsLinked = true
        render(<MapPOIEditContent poi="poi-1"/>)

        const unlinkButton = screen.getByRole('button', {name: 'Unlink Text and Border colors'})
        expect(unlinkButton.getAttribute('aria-pressed')).toBe('true')

        fireEvent.click(unlinkButton)

        await waitFor(() => expect(updatePOI).toHaveBeenCalledWith('poi-1', {
            textBorderColorsLinked: false,
        }, {markAsEdited: true}))
        expect(poi.textBorderColorsLinked).toBe(false)
    })

    it('copies every Content and Decoration setting, shows hidden targets, and keeps paste available until replaced', async () => {
        poi.borderColor = '#778899'
        poi.textBorderColorsLinked = true
        poi.display = {
            category: true,
            titleCategoryIcon: false,
            titleAltitude: true,
            location: true,
            altitude: true,
            coordinates: true,
            dateTime: true,
            maxWidth: 320,
            fontFamily: 'System',
            fontSize: 22,
            widgetRotation: -25,
            bold: true,
            italic: true,
            stickAngle: '45',
            stickPosition: 'right',
            stickHorizontalPosition: 80,
            stickLength: 77,
            style: 'rounded',
            borderWidth: 4,
            borderRadius: 'large',
            schemaVersion: 5,
        }
        const expectedDisplay = normalizePOIDisplaySettings(poi.display)
        render(<MapPOIEditContent poi="poi-1"/>)

        const copyButton = screen.getByRole('button', {name: 'Copy POI style'})
        const pasteButton = screen.getByRole('button', {name: 'Paste POI style'})
        expect(copyButton.disabled).toBe(false)
        expect(pasteButton.disabled).toBe(true)
        await act(async () => {
            fireEvent.click(copyButton)
            await Promise.resolve()
        })

        expect(poiPresentationClipboardStore.entry.updates).toEqual({
            color: '#112233',
            bgColor: '#445566',
            borderColor: '#778899',
            textBorderColorsLinked: true,
            background: true,
            display: expectedDisplay,
        })
        expect(Object.keys(poiPresentationClipboardStore.entry.updates).sort()).toEqual([
            'background', 'bgColor', 'borderColor', 'color', 'display', 'textBorderColorsLinked',
        ])
        await waitFor(() => expect(pasteButton.disabled).toBe(false))

        act(() => {
            poi.color = '#000000'
            poi.bgColor = '#ffffff'
            poi.borderColor = '#000000'
            poi.display = {}
            poi.visible = false
        })

        await act(async () => {
            fireEvent.click(pasteButton)
            await Promise.resolve()
        })

        expect(updatePOI).toHaveBeenLastCalledWith('poi-1', {
            ...poiPresentationClipboardStore.entry.updates,
            visible: true,
        }, {markAsEdited: true})
        expect(poi.visible).toBe(true)
        expect(poi.color).toBe('#112233')
        expect(poi.bgColor).toBe('#445566')
        expect(poi.borderColor).toBe('#778899')
        expect(poi.display).toEqual(expectedDisplay)
        expect(pasteButton.disabled).toBe(false)

        act(() => {
            poi.color = '#abcdef'
        })
        await act(async () => {
            fireEvent.click(pasteButton)
            await Promise.resolve()
        })
        expect(poi.color).toBe('#112233')
        expect(poiPresentationClipboardStore.entry.sourcePoiId).toBe('poi-1')

        const replacementPOI = proxy({id: 'poi-2', color: '#aabbcc', display: {style: 'label'}})
        poiList.set(replacementPOI.id, replacementPOI)
        act(() => expect(copyPOIPresentation(poiList.get('poi-2'))).toBe(true))
        expect(poiPresentationClipboardStore.entry.sourcePoiId).toBe('poi-2')
        expect(poiPresentationClipboardStore.entry.updates.color).toBe('#aabbcc')
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

    it('keeps Border at its initial Text color when Background changes normally', async () => {
        render(<MapPOIEditContent poi="poi-1"/>)
        const colourPicker = screen.getByLabelText('Background')

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

    it('applies Shift captured on the Background picker open to both frame colors after Shift is released', async () => {
        render(<MapPOIEditContent poi="poi-1"/>)
        const picker = screen.getByLabelText('Background')

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

    it('reverses only Background and Border', async () => {
        poi.borderColor = '#778899'
        render(<MapPOIEditContent poi="poi-1"/>)

        fireEvent.click(screen.getByRole('button', {name: 'Reverse color'}))

        await waitFor(() => expect(updatePOI).toHaveBeenCalledWith('poi-1', {
            bgColor: '#778899',
            borderColor: '#445566',
        }, {markAsEdited: true}))
        expect(poi.color).toBe('#112233')
    })

    it('sets Text to Border when linking the swatches and keeps them linked during edits', async () => {
        poi.borderColor = '#778899'
        render(<MapPOIEditContent poi="poi-1"/>)

        fireEvent.click(screen.getByRole('button', {name: 'Link Text and Border colors'}))

        await waitFor(() => {
            expect(updatePOI).toHaveBeenCalledWith('poi-1', {
                color:                  '#778899',
                borderColor:            '#778899',
                textBorderColorsLinked: true,
            }, {markAsEdited: true})
            expect(poi.color).toBe('#778899')
            expect(poi.textBorderColorsLinked).toBe(true)
            expect(screen.getByRole('button', {name: 'Unlink Text and Border colors'}).getAttribute('aria-pressed'))
                .toBe('true')
        })

        updatePOI.mockClear()
        const borderPicker = screen.getByLabelText('Border')
        fireEvent.click(borderPicker)
        fireEvent.change(borderPicker, {target: {value: '#aabbcc'}})

        await waitFor(() => expect(updatePOI).toHaveBeenCalledWith('poi-1', {
            color: '#aabbcc',
            borderColor: '#aabbcc',
        }, {markAsEdited: true}))
    })

    it('reverses Background with linked Text and Border while preserving their link', async () => {
        poi.borderColor = '#778899'
        poi.bgColor = '#aabbcc'
        render(<MapPOIEditContent poi="poi-1"/>)

        fireEvent.click(screen.getByRole('button', {name: 'Link Text and Border colors'}))
        await waitFor(() => {
            expect(poi.color).toBe('#778899')
            expect(poi.textBorderColorsLinked).toBe(true)
        })
        updatePOI.mockClear()

        fireEvent.click(screen.getByRole('button', {name: 'Reverse color'}))

        await waitFor(() => expect(updatePOI).toHaveBeenCalledWith('poi-1', {
            bgColor: '#778899',
            borderColor: '#aabbcc',
            color: '#aabbcc',
        }, {markAsEdited: true}))
        expect(poi.color).toBe(poi.borderColor)
    })
})
