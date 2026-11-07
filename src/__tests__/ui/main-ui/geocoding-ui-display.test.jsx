/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: geocoding-ui-display.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-07
 * Last modified: 2026-11-07
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { GeocodingUI } from '@Components/MainUI/geocoding/GeocodingUI'
import { LocationDisplayedToastContent } from '@Components/MainUI/geocoding/LocationDisplayedToastContent'
import { UI_ACTIONS } from '@Core/ui/metadata/uiActionCatalog'
import {
    $geocodingPOIAddOverlay, hideGeocodingPOIAddOverlay,
} from '@Core/stores/geocodingPOIAddOverlay'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'
import { proxyMap } from 'valtio/utils'

const { addPOIToLibrary, focusPOIInOpenList, notify, showPOICreationDuplicateToast, toastError, managedStylesheet } = vi.hoisted(() => ({
    addPOIToLibrary: vi.fn(),
    focusPOIInOpenList: vi.fn(),
    notify: vi.fn(),
    showPOICreationDuplicateToast: vi.fn(),
    toastError: vi.fn(),
    managedStylesheet: vi.fn(),
}))

vi.mock('@Components/WaDialogNonModal', () => ({
    default: ({children, open}) => <div data-testid="geocoding-dialog" data-open={String(open)}>{children}</div>,
}))
vi.mock('@Components/MainUI/MapPOI/focusPOIInOpenList', () => ({focusPOIInOpenList}))
vi.mock('@Components/MainUI/MapPOI/addPOIToLibrary', () => ({addPOIToLibrary}))
vi.mock('@Components/MainUI/MapPOI/showPOICreationDuplicateToast', () => ({showPOICreationDuplicateToast}))
vi.mock('@Utils/UIToast', () => ({UIToast: {notify, error: toastError}}))
vi.mock('@Utils/useManagedStylesheet', () => ({useManagedStylesheet: managedStylesheet}))
vi.mock('@Components/MainUI/geocoding/style.css?url', () => ({default: 'geocoding.css'}))
vi.mock('@Components/MainUI/LGSScrollbars', () => ({
    LGSScrollbars: ({children, ...props}) => <div {...props}>{children}</div>,
}))
vi.mock('@awesome.me/webawesome/dist/react', async () => {
    const React = await import('react')
    return {
        WaButton: ({children, ...props}) => <button {...props}>{children}</button>,
        WaCard: ({children, ...props}) => <div {...props}>{children}</div>,
        WaDivider: () => <hr/>,
        WaIcon: ({name}) => <span data-icon={name}/>,
        WaInput: React.forwardRef(({appearance: _appearance, withClear: _withClear, ...props}, ref) => <input ref={ref} {...props}/>),
        WaSwitch: ({children, checked, onChange}) => (
            <label>
                <input type="checkbox" checked={checked} onChange={onChange}/>
                {children}
            </label>
        ),
        WaTooltip: () => null,
        WaCallout: ({children}) => <div>{children}</div>,
    }
})

describe('GeocodingUI location display', () => {
    let geocoderStore
    let poiList
    let poiManager
    let geocoder
    let focus
    let cameraManager
    let terrainResolved
    let nextPOIId

    beforeEach(() => {
        vi.clearAllMocks()
        nextPOIId = 0
        terrainResolved = false
        poiList = proxyMap()
        geocoderStore = proxy({
            list: proxyMap(),
            dialog: {
                visible: true,
                mounted: true,
                loading: false,
                submitDisabled: false,
                noResults: false,
                moreResults: false,
                error: false,
            },
        })
        geocoder = {
            init: vi.fn(() => geocoderStore.list.clear()),
            limit: 10,
            search: vi.fn(async () => new Map()),
            getCoordinateLocationDetails: vi.fn(async () => ({location: null})),
        }
        cameraManager = {stopRotate: vi.fn(async () => {})}
        focus = vi.fn((poi, options) => {
            if (!terrainResolved || !Number.isFinite(poi.height)) {
                return Promise.resolve(false)
            }

            options.callback({camera: {heading: 0.25, pitch: -0.5, roll: 0, range: 2000}})
            return Promise.resolve(true)
        })
        poiManager = {
            add: vi.fn(async (poi) => {
                poiList.set(poi.id, poi)
                return poi
            }),
            get: poiId => poiList.get(poiId),
            getPointFromGeoJson: vi.fn(async geoPoint => ({
                id: `temporary-${++nextPOIId}`,
                longitude: geoPoint.geometry.coordinates[0],
                latitude: geoPoint.geometry.coordinates[1],
                title: geoPoint.properties?.name ?? '',
                description: geoPoint.properties?.display_name ?? '',
                type: undefined,
            })),
            getHeightFromTerrain: vi.fn(async () => {
                terrainResolved = true
                return 125
            }),
            updatePOI: vi.fn(async (poiId, updates) => {
                const poi = poiList.get(poiId)
                Object.assign(poi, updates)
                poiList.set(poiId, poi)
                return poi
            }),
            findNearestPOIWithinDistance: vi.fn(() => null),
        }

        globalThis.lgs = {
            settings: {
                ui: {
                    geocoder: {minQuery: 3},
                    poi: {rotate: true, rpm: 4},
                },
            },
            stores: {
                main: {components: {geocoder: geocoderStore, pois: {list: poiList}}},
                ui: {drawers: {open: null}},
            },
        }
        globalThis.__ = {
            ui: {
                geocoder,
                poiManager,
                cameraManager,
                sceneManager: {focus},
            },
        }
    })

    afterEach(() => {
        cleanup()
        hideGeocodingPOIAddOverlay()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    /** Assert the notification contains the Add action for the specific displayed POI. */
    const expectLocationDisplayedToast = poiId => expect(notify).toHaveBeenCalledWith({
        caption: 'Location displayed',
        text: expect.objectContaining({
            type: LocationDisplayedToastContent,
            props: {poiId},
        }),
    })

    it('displays a selected geographic result as a temporary marker without persistence', async () => {
        geocoder.search.mockResolvedValue(new Map([['paris', {
            geometry: {coordinates: [2.3522, 48.8566]},
            properties: {name: 'Paris', display_name: 'Paris, France'},
        }]]))
        render(<GeocodingUI/>)

        const searchInput = screen.getByPlaceholderText('Address or coordinates (lat,lon)')
        expect(searchInput.getAttribute('autocomplete')).toBe('off')
        fireEvent.input(searchInput, {
            target: {value: 'Paris'},
        })
        fireEvent.submit(searchInput.closest('form'))
        fireEvent.click(await screen.findByText('Paris, France'))

        await waitFor(() => expect(focus).toHaveBeenCalledOnce())
        expect(focus).toHaveBeenCalledWith(expect.objectContaining({height: 125}), expect.any(Object))
        expect(cameraManager.stopRotate).toHaveBeenCalledOnce()
        expect(focus.mock.calls[0][1]).toMatchObject({rotate: false, infinite: false})
        const marker = Array.from(poiList.values())[0]
        expect(poiManager.add).toHaveBeenCalledWith(marker, true, false)
        expect(marker).toMatchObject({
            id: 'temporary-1',
            longitude: 2.3522,
            latitude: 48.8566,
            type: undefined,
        })
        expect(poiManager.updatePOI).toHaveBeenCalledWith(marker.id, {
            camera: {heading: 0.25, pitch: -0.5, roll: 0, range: 2000},
        }, {skipPersist: true, skipLocationUpdate: true})
        expectLocationDisplayedToast(marker.id)
        expect(toastError).not.toHaveBeenCalled()
        expect(poiList.has(marker.id)).toBe(true)
        await waitFor(() => expect(poiManager.updatePOI).toHaveBeenCalledWith(marker.id, {simulatedHeight: 125}, {
            immediate: true,
            skipLocationUpdate: true,
        }))
    })

    it('uses the same temporary display flow for exact decimal coordinates', async () => {
        render(<GeocodingUI/>)
        const input = screen.getByPlaceholderText('Address or coordinates (lat,lon)')
        fireEvent.input(input, {target: {value: '48.8566, 2.3522'}})
        fireEvent.submit(input.closest('form'))

        await waitFor(() => expect(focus).toHaveBeenCalledOnce())
        const marker = Array.from(poiList.values())[0]
        expect(marker).toMatchObject({longitude: 2.3522, latitude: 48.8566, type: undefined})
        expect(poiManager.add).toHaveBeenCalledWith(marker, true, false)
        expect(geocoder.search).not.toHaveBeenCalled()
        expectLocationDisplayedToast(marker.id)
        expect(poiList.has(marker.id)).toBe(true)
        await waitFor(() => expect(poiManager.updatePOI).toHaveBeenCalledWith(marker.id, {simulatedHeight: 125}, {
            immediate: true,
            skipLocationUpdate: true,
        }))
    })

    it('reports a rejected camera focus instead of leaving the location without feedback', async () => {
        focus.mockImplementationOnce(() => Promise.resolve(false))
        geocoder.search.mockResolvedValue(new Map([['paris', {
            geometry: {coordinates: [2.3522, 48.8566]},
            properties: {name: 'Paris', display_name: 'Paris, France'},
        }]]))
        render(<GeocodingUI/>)

        const input = screen.getByPlaceholderText('Address or coordinates (lat,lon)')
        fireEvent.input(input, {target: {value: 'Paris'}})
        fireEvent.submit(input.closest('form'))
        fireEvent.click(await screen.findByText('Paris, France'))

        await waitFor(() => expect(toastError).toHaveBeenCalledWith({
            caption: 'Location display failed.',
            text: 'The selected location could not be focused on the map.',
        }))
        expect(notify).not.toHaveBeenCalled()
        expect($geocodingPOIAddOverlay.poiId).toBeNull()
    })

    it('does not focus or show Add when terrain altitude cannot be sampled', async () => {
        poiManager.getHeightFromTerrain.mockRejectedValueOnce(new Error('terrain unavailable'))
        geocoder.search.mockResolvedValue(new Map([['paris', {
            geometry: {coordinates: [2.3522, 48.8566]},
            properties: {name: 'Paris', display_name: 'Paris, France'},
        }]]))
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
        render(<GeocodingUI/>)

        const input = screen.getByPlaceholderText('Address or coordinates (lat,lon)')
        fireEvent.input(input, {target: {value: 'Paris'}})
        fireEvent.submit(input.closest('form'))
        fireEvent.click(await screen.findByText('Paris, France'))

        await waitFor(() => expect(toastError).toHaveBeenCalledWith({
            caption: 'Location display failed.',
            text: 'Terrain altitude could not be retrieved for this location.',
        }))
        expect(focus).not.toHaveBeenCalled()
        expect(notify).not.toHaveBeenCalled()
        expect($geocodingPOIAddOverlay.poiId).toBeNull()
        expect(poiList.size).toBe(1)
        consoleError.mockRestore()
    })

    it('parses exact DMS coordinates through the same temporary display flow', async () => {
        render(<GeocodingUI/>)
        const input = screen.getByPlaceholderText('Address or coordinates (lat,lon)')
        fireEvent.input(input, {target: {value: `48° 51' 24.0", 2° 21' 7.9"`}})
        fireEvent.submit(input.closest('form'))

        await waitFor(() => expect(focus).toHaveBeenCalledOnce())
        const marker = Array.from(poiList.values())[0]
        expect(marker.latitude).toBeCloseTo(48.8566667, 5)
        expect(marker.longitude).toBeCloseTo(2.3521944, 5)
        expect(poiManager.add).toHaveBeenCalledWith(marker, true, false)
        expect(geocoder.search).not.toHaveBeenCalled()
        expectLocationDisplayedToast(marker.id)
        await waitFor(() => expect(poiManager.updatePOI).toHaveBeenCalledWith(marker.id, {simulatedHeight: 125}, {
            immediate: true,
            skipLocationUpdate: true,
        }))
    })

    it('retains earlier temporary markers when a later search result is selected', async () => {
        geocoder.search
            .mockResolvedValueOnce(new Map([['paris', {
                geometry: {coordinates: [2.3522, 48.8566]},
                properties: {name: 'Paris', display_name: 'Paris, France'},
            }]]))
            .mockResolvedValueOnce(new Map([['lyon', {
                geometry: {coordinates: [4.8357, 45.764]},
                properties: {name: 'Lyon', display_name: 'Lyon, France'},
            }]]))
        render(<GeocodingUI/>)
        const input = screen.getByPlaceholderText('Address or coordinates (lat,lon)')

        fireEvent.input(input, {target: {value: 'Paris'}})
        fireEvent.submit(input.closest('form'))
        fireEvent.click(await screen.findByText('Paris, France'))
        await waitFor(() => expect(focus).toHaveBeenCalledTimes(1))
        const firstMarker = Array.from(poiList.values())[0]

        geocoderStore.dialog.visible = true
        fireEvent.input(input, {target: {value: 'Lyon'}})
        fireEvent.submit(input.closest('form'))
        fireEvent.click(await screen.findByText('Lyon, France'))
        await waitFor(() => expect(focus).toHaveBeenCalledTimes(2))

        const markers = Array.from(poiList.values())
        expect(markers).toHaveLength(2)
        expect(markers).toContain(firstMarker)
        expect(markers.map(marker => marker.title)).toEqual(['Paris', 'Lyon'])
        expect($geocodingPOIAddOverlay.poiId).toBe(markers[1].id)
        await waitFor(() => expect(poiManager.updatePOI).toHaveBeenCalledTimes(4))
    })

    it('shows an Add action in the location toast and routes it through the shared save operation', () => {
        render(<LocationDisplayedToastContent poiId="temporary-toast-poi"/>)

        expect(screen.getByText('This location is not saved as a POI. Select Add to save it in your POI library.')).toBeTruthy()
        const addButton = screen.getByRole('button', {name: UI_ACTIONS.addPOIToLibrary.label})
        expect(addButton.querySelector('[data-icon="circle-plus"]')).toBeTruthy()
        expect(addButton.parentElement.classList.contains('location-displayed-toast-content')).toBe(true)

        fireEvent.click(addButton)

        expect(addPOIToLibrary).toHaveBeenCalledWith('temporary-toast-poi')
    })

    it('rejects a searched location that is too close to an existing POI', async () => {
        const nearbyPOI = {
            id: 'existing-nearby-poi',
            latitude: 48.8566,
            longitude: 2.3522,
            title: 'Nearby POI',
        }
        poiList.set(nearbyPOI.id, nearbyPOI)
        poiManager.add.mockResolvedValueOnce(false)
        poiManager.findNearestPOIWithinDistance.mockReturnValueOnce(nearbyPOI)
        geocoder.search.mockResolvedValue(new Map([['paris', {
            geometry: {coordinates: [2.3522, 48.8566]},
            properties: {name: 'Paris', display_name: 'Paris, France'},
        }]]))
        render(<GeocodingUI/>)

        const searchInput = screen.getByPlaceholderText('Address or coordinates (lat,lon)')
        fireEvent.input(searchInput, {target: {value: 'Paris'}})
        fireEvent.submit(searchInput.closest('form'))
        fireEvent.click(await screen.findByText('Paris, France'))

        await waitFor(() => expect(showPOICreationDuplicateToast).toHaveBeenCalledWith(nearbyPOI))
        expect(poiManager.add).toHaveBeenCalledWith(expect.objectContaining({
            latitude: 48.8566,
            longitude: 2.3522,
        }), true, false)
        expect(focus).not.toHaveBeenCalled()
        expect(notify).not.toHaveBeenCalled()
        expect(geocoderStore.dialog.visible).toBe(false)
        expect($geocodingPOIAddOverlay.poiId).toBeNull()
        expect(poiList.size).toBe(1)
    })
})
