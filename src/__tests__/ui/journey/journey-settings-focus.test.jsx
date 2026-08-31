/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: journey-settings-focus.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-19
 * Last modified: 2026-08-19
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { JourneySettings } from '@Editor/journey/JourneySettings'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

vi.mock('@Components/MainUI/LGSScrollbars', () => ({LGSScrollbars: ({children}) => <div>{children}</div>}))
vi.mock('@Components/MainUI/MapPOI/MapPOIEditListActions', () => ({MapPOIEditListActions: () => null}))
vi.mock('@Components/MainUI/MapPOI/MapPOIList', () => ({MapPOIList: () => null}))
vi.mock('@Components/Modals/ConfirmUI', () => ({useConfirm: () => [() => null, vi.fn(async () => false)]}))
vi.mock('@Components/LGSPopup', () => ({LGSPopup: () => null}))
vi.mock('@Components/ToggleStateIcon', () => ({ToggleStateIcon: ({id}) => <button type="button" id={id}/> }))
vi.mock('@Core/Elevation/ElevationServer', () => {
    class ElevationServer {}

    ElevationServer.CLEAR = 'clear'
    ElevationServer.FILE_CONTENT = 'file-content'
    ElevationServer.NONE = 'none'
    ElevationServer.FAKE_SERVERS = new Map([
        [ElevationServer.CLEAR, {label: 'Clear'}],
        [ElevationServer.FILE_CONTENT, {label: 'File'}],
        [ElevationServer.NONE, {label: 'None'}],
    ])
    ElevationServer.SERVERS = new Map()
    ElevationServer.getServer = () => ({label: 'Server'})

    return {ElevationServer}
})
vi.mock('@Core/Journey', () => ({
    Journey: {
        activityProfiles: () => [],
        defaultActivity: () => 'hiking',
    },
}))
vi.mock('@Core/ui/Export', () => ({Export: {toFile: vi.fn()}}))
vi.mock('@Editor/journey/RemoveJourney', () => ({RemoveJourney: () => null}))
vi.mock('@Editor/groups/JourneyGroupsInfo', () => ({JourneyGroupsInfo: () => null}))
vi.mock('@Editor/track/TrackData', () => ({TrackData: () => null}))
vi.mock('@Editor/track/TrackPoints', () => ({TrackPoints: () => null}))
vi.mock('@Editor/track/TrackSettings', () => ({TrackSettings: () => null}))
vi.mock('@Editor/track/TrackStyleSettings', () => ({TrackStyleSettings: () => null}))
vi.mock('@Editor/Utils', () => ({
    Utils: {
        renderJourneySettings: vi.fn(),
        updateJourney: vi.fn(async () => undefined),
    },
}))
vi.mock('@Utils/cesium/TrackUtils', () => ({TrackUtils: {updatePOIsVisibility: vi.fn()}}))
vi.mock('@Utils/cesium/elevationCoordinateUtils', () => ({
    applyElevationCoordinatesToFeature: vi.fn(),
    flattenFeatureGeometryCoordinates: vi.fn(() => []),
    prepareJourneyElevationCoordinates: vi.fn(),
}))
vi.mock('@Utils/JourneyGpxUtils', () => ({
    exportJourneyToGeoJSON: vi.fn(),
    exportJourneyToGPX: vi.fn(),
    getExportableJourneyPOIs: vi.fn(() => []),
    getJourneyExportBaseName: vi.fn(() => 'journey'),
    JOURNEY_EXPORT_FORMAT_LABELS: {gpx: 'gpx', geojson: 'geojson', pdf: 'pdf', html: 'html'},
    JOURNEY_EXPORT_FORMATS: {GPX: 'gpx', GEOJSON: 'geojson', PDF: 'pdf', HTML: 'html'},
    JOURNEY_EXPORT_MIME_TYPES: {gpx: 'application/gpx+xml', geojson: 'application/json', pdf: 'application/pdf', html: 'text/html'},
    normalizeJourneyExportBaseName: vi.fn(value => value),
    normalizeJourneyExportFileName: vi.fn(() => 'journey.gpx'),
}))
vi.mock('@Utils/ExportAsReport', () => ({
    exportJourneyToHTMLZip: vi.fn(),
    exportJourneyToPDF: vi.fn(),
}))
vi.mock('@Utils/UIToast', () => ({UIToast: {error: vi.fn(), notify: vi.fn(), success: vi.fn()}}))
vi.mock('@Utils/TextUtils', () => ({decodeHTMLEntities: value => value}))
vi.mock('@Components/MainUI/ElevationProfile', () => ({ElevationProfile: () => null}))
vi.mock('@Editor/journey/JourneyData', () => ({JourneyData: () => null}))
vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => {
    const Container = ({children, ...props}) => <div {...props}>{children}</div>
    const Button = ({children, ...props}) => <button type="button" {...props}>{children}</button>
    const Icon = ({name, animation, ...props}) => <span data-animation={animation} data-icon={name} {...props}/>

    return {
        WaButton: Button,
        WaCard: Container,
        WaDetails: Container,
        WaIcon: Icon,
        WaInput: Container,
        WaOption: Container,
        WaSelect: Container,
        WaTab: Container,
        WaTabGroup: Container,
        WaTabPanel: Container,
        WaTextarea: Container,
        WaTooltip: () => null,
    }
})

describe('JourneySettings focus control', () => {
    beforeEach(() => {
        const journey = {
            activity:       'hiking',
            description:    '',
            elevationServer: 'none',
            hasElevation:   false,
            POIsVisible:    true,
            pois:           new Map(),
            slug:           'journey-1',
            title:          'Journey 1',
            tracks:         new Map([['track-1', {}]]),
            visible:        true,
        }
        const journeyEditor = proxy({
            activeTab: null,
            isProcessing: false,
            journey,
            showPOIsFilter: false,
        })

        globalThis.__ = {
            tools: {
                debounce: callback => callback,
            },
            ui: {
                cameraManager: {
                    stopRotate: vi.fn(async () => {
                        globalThis.lgs.stores.ui.mainUI.rotate.running = false
                    }),
                },
                drawerManager: {
                    tabActive: () => true,
                },
                geocoder: null,
                profiler: {
                    draw: vi.fn(),
                    updateTitle: vi.fn(),
                },
            },
        }
        globalThis.lgs = {
            getJourneyBySlug: vi.fn(() => globalThis.lgs.theJourney),
            settings: {
                journey: {
                    hideOtherJourneys: false,
                },
                ui: {
                    camera: proxy({
                        start: proxy({
                            rotate: proxy({journey: true}),
                        }),
                    }),
                },
            },
            stores: {
                journeyEditor,
                ui: proxy({
                    drawers: {
                        open: 'journey-editor-drawer',
                    },
                    mainUI: {
                        removeJourneyDialog: {
                            active: {
                                set: vi.fn(),
                            },
                        },
                        rotate: {
                            running: true,
                            target: {
                                instanceOf: () => true,
                            },
                        },
                    },
                }),
            },
            theJourney: {
                element: 'journey',
                focus: vi.fn(async () => undefined),
                slug: 'journey-1',
                updateVisibility: vi.fn(),
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('stops the running orbit and focuses the journey without relaunching rotation', async () => {
        render(<JourneySettings/>)

        expect(document.querySelector('#rotation-in-settings')).toBeTruthy()
        expect(document.querySelector('#rotation-in-settings [data-icon="arrows-rotate"][data-animation="spin"]')).toBeTruthy()
        expect(document.querySelector('#auto-rotate-in-settings')).toBeTruthy()
        fireEvent.click(document.querySelector('#auto-rotate-in-settings'))

        await waitFor(() => expect(globalThis.__.ui.cameraManager.stopRotate).toHaveBeenCalled())
        await waitFor(() => expect(globalThis.lgs.theJourney.focus).toHaveBeenCalledWith({
            resetCamera: true,
            rotate:      false,
        }))
    })

    it('stops the running orbit from the rotation control without relaunching it', async () => {
        render(<JourneySettings/>)

        fireEvent.click(document.querySelector('#rotation-in-settings'))

        await waitFor(() => expect(globalThis.__.ui.cameraManager.stopRotate).toHaveBeenCalled())
        expect(globalThis.lgs.theJourney.focus).not.toHaveBeenCalled()
        expect(globalThis.lgs.stores.ui.mainUI.rotate.running).toBe(false)
    })

    it('focuses without starting an orbit when the focus control is clicked while idle', async () => {
        globalThis.lgs.stores.ui.mainUI.rotate.running = false
        render(<JourneySettings/>)

        fireEvent.click(document.querySelector('#auto-rotate-in-settings'))

        await waitFor(() => expect(globalThis.lgs.theJourney.focus).toHaveBeenCalledWith({
            resetCamera: true,
            rotate:      false,
        }))
    })
})
