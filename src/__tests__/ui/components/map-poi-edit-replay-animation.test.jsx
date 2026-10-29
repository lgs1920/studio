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
 * Last modified: 2026-10-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'
import {proxyMap} from 'valtio/utils'

vi.mock('@Components/DateTimeDisplay', () => ({DateTimeDisplay: () => null}))
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
    WaColorPicker: () => null,
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

describe('MapPOIEditContent Replay animation setting', () => {
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
            replay: {
                visible: true,
                animated: false,
                hiddenFields: {category: true},
            },
            display: {},
        })
        poiList = proxyMap([[poi.id, poi]])
        updatePOI = vi.fn(async () => poi)

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
})
