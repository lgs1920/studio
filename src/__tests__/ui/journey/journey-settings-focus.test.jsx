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
 * Last modified: 2026-10-18
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { JourneySettings } from '@Editor/journey/JourneySettings'
import { Utils } from '@Editor/Utils'
import { DRAWING_FROM_UI, NO_FOCUS, UPDATE_JOURNEY_SILENTLY } from '@Core/constants'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

const trackDataMock = vi.hoisted(() => vi.fn())
const elevationProfileMock = vi.hoisted(() => vi.fn())
const terrainCheckMock = vi.hoisted(() => vi.fn(async (_track, {onProgress} = {}) => {
    onProgress?.(100)
    return {status: 'needs-correction', detectedPoints: 1}
}))
const terrainPrepareMock = vi.hoisted(() => vi.fn(async (_track, {onProgress} = {}) => {
    onProgress?.(100)
    return {changed: false, content: _track?.content}
}))
const terrainProgressMarkerMock = vi.hoisted(() => ({
    clear: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
}))

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
vi.mock('@Editor/track/TrackData', () => ({
    TrackData: props => {
        trackDataMock(props)
        return null
    },
}))
vi.mock('@Editor/track/TrackPoints', () => ({TrackPoints: () => null}))
vi.mock('@Editor/track/TrackSettings', () => ({TrackSettings: () => null}))
vi.mock('@Editor/track/TrackStyleSettings', () => ({TrackStyleSettings: () => null}))
vi.mock('@Editor/Utils', () => ({
    Utils: {
        renderJourneySettings: vi.fn(),
        updateJourney: vi.fn(async () => undefined),
    },
}))
vi.mock('@Utils/cesium/TrackUtils', () => ({TrackUtils: {
    getTrackTerrainAlignmentWidthMeters: vi.fn(() => 2),
    updatePOIsVisibility: vi.fn(),
}}))
vi.mock('@Utils/cesium/trackTerrainAlignment', () => ({
    checkTrackTerrainAlignment: terrainCheckMock,
    prepareTerrainAlignedTrackContent: terrainPrepareMock,
}))
vi.mock('@Utils/cesium/trackTerrainProgressMarker', () => ({
    createTrackTerrainAlignmentProgressMarker: terrainProgressMarkerMock.create,
}))
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
vi.mock('@Components/MainUI/ElevationProfile', () => ({
    ElevationProfile: props => {
        elevationProfileMock(props)
        return null
    },
}))
vi.mock('@Editor/journey/JourneyData', () => ({JourneyData: () => null}))
vi.mock('@awesome.me/webawesome/dist/react', () => {
    const Container = ({children, ...props}) => <div {...props}>{children}</div>
    const Button = ({children, ...props}) => <button type="button" {...props}>{children}</button>
    const Icon = ({name, animation, ...props}) => <span data-animation={animation} data-icon={name} {...props}/>
    const ProgressBar = ({children, label, value, ...props}) => (
        <div role="progressbar" aria-label={label} aria-valuenow={value} {...props}>{children}</div>
    )
    const Switch = ({checked, disabled, onChange, children, ...props}) => (
        <label data-width-auto={props['width-auto'] === true ? 'true' : 'false'}>
            <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange}/>
            {children}
        </label>
    )

    return {
        WaButton: Button,
        WaCard: Container,
        WaDetails: Container,
        WaIcon: Icon,
        WaInput: Container,
        WaOption: Container,
        WaProgressBar: ProgressBar,
        WaSelect: Container,
        WaSwitch: Switch,
        WaTab: Container,
        WaTabGroup: Container,
        WaTabPanel: Container,
        WaTextarea: Container,
        WaTooltip: () => null,
    }
})

describe('JourneySettings focus control', () => {
    beforeEach(() => {
        trackDataMock.mockReset()
        elevationProfileMock.mockReset()
        terrainCheckMock.mockReset()
        terrainCheckMock.mockImplementation(async (_track, {onLocation, onProgress} = {}) => {
            onLocation?.([0.01, 0.02, 800])
            onProgress?.(100)
            return {status: 'needs-correction', detectedPoints: 1}
        })
        terrainProgressMarkerMock.clear.mockReset()
        terrainProgressMarkerMock.create.mockReset()
        terrainProgressMarkerMock.update.mockReset()
        terrainProgressMarkerMock.create.mockReturnValue({
            clear:  terrainProgressMarkerMock.clear,
            update: terrainProgressMarkerMock.update,
        })
        terrainPrepareMock.mockReset()
        terrainPrepareMock.mockImplementation(async (track, {onProgress} = {}) => {
            onProgress?.(100)
            return {changed: false, content: track?.content}
        })
        const journey = {
            antiCliffCorrection: false,
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
        Utils.updateJourney.mockReset()
    })

    afterEach(() => {
        cleanup()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('suppresses Profile and Data widget controls in the Track Editor', () => {
        const {container} = render(<JourneySettings/>)

        expect(elevationProfileMock).toHaveBeenCalledWith(expect.objectContaining({showWidgetControls: false}))
        expect(trackDataMock).toHaveBeenCalledWith(expect.objectContaining({
            compactAfterProfile: true,
            showWidgetControls:   false,
        }))
        expect(screen.getByText('Style', {exact: true})).toBeTruthy()
        expect(screen.getByText('Details', {exact: true})).toBeTruthy()
        expect(screen.getByRole('checkbox', {name: /Anti-cliff correction/}).checked).toBe(false)
        expect(screen.getByRole('checkbox', {name: /Anti-cliff correction/}).parentElement.dataset.widthAuto).toBe('true')
        expect(container.querySelector('.lgs--journey-activity-select')).toBeTruthy()
        expect(container.querySelector('.lgs--journey-details-card')).toBeTruthy()
        expect(container.querySelector('.lgs--journey-edit-details .lgs--journey-details-card')).toBeNull()
    })

    it('persists anti-cliff activation and redraws the Journey after correction', async () => {
        const redraw = vi.fn(async () => {})
        const track = {content: {geometry: {coordinates: [[0, 0], [1, 1]], type: 'LineString'}}}
        track.slug = 'track-1'
        globalThis.lgs.settings.layers = {terrain: 'terrain-a'}
        const persist = vi.fn(async () => {})
        const updated = {draw: redraw, persistToDatabase: persist, tracks: new Map([['track-1', track]])}
        Utils.updateJourney.mockResolvedValue(updated)
        render(<JourneySettings/>)

        const toggle = screen.getByRole('checkbox', {name: /Anti-cliff correction/})
        expect(toggle.checked).toBe(false)
        fireEvent.click(toggle)

        await waitFor(() => expect(Utils.updateJourney).toHaveBeenCalledWith(
            UPDATE_JOURNEY_SILENTLY,
            {focus: false},
        ))
        await waitFor(() => expect(redraw).toHaveBeenCalledWith({
            action:           DRAWING_FROM_UI,
            mode:             NO_FOCUS,
        }))
        expect(terrainPrepareMock).toHaveBeenCalledWith(track, expect.objectContaining({
            traceWidthMeters: 2,
            onProgress:       expect.any(Function),
        }))
        expect(terrainCheckMock).toHaveBeenCalledWith(track, expect.objectContaining({
            traceWidthMeters: 2,
            onProgress:       expect.any(Function),
        }))
        expect(screen.queryByRole('progressbar')).toBeNull()
        expect(globalThis.lgs.stores.journeyEditor.journey.antiCliffCorrection).toBe(true)
        expect(updated.antiCliffCorrectionData).toEqual({terrainId: 'terrain-a', tracks: {'track-1': []}})
        expect(persist).toHaveBeenCalledOnce()
    })

    it('shows correction progress without a visible percentage and clears it afterwards', async () => {
        let finishSaving
        let finishCorrection
        const track = {content: {geometry: {coordinates: [[0, 0], [1, 1]], type: 'LineString'}}}
        const redraw = vi.fn(async () => {})
        const updated = {draw: redraw, tracks: new Map([['track-1', track]])}
        Utils.updateJourney.mockImplementation(() => new Promise(resolve => {
            finishSaving = () => resolve(updated)
        }))
        terrainPrepareMock.mockImplementation(async (_track, {onProgress} = {}) => {
            onProgress?.(37)
            await new Promise(resolve => {
                finishCorrection = resolve
            })
            return {changed: true}
        })

        render(<JourneySettings/>)
        const toggle = screen.getByRole('checkbox', {name: /Anti-cliff correction/})
        fireEvent.click(toggle)

        const progress = await screen.findByRole('progressbar', {name: /Anti-cliff check and correction progress/})
        expect(toggle.parentElement.dataset.widthAuto).toBe('false')
        expect(progress.closest('.lgs--journey-antcliff-setting').classList.contains('is-processing')).toBe(true)
        const reset = screen.getByRole('button', {name: 'Reset anti-cliff correction'})
        expect(progress.parentElement.nextElementSibling).toBe(reset)
        expect(reset.parentElement.lastElementChild).toBe(reset)
        expect(progress).toBeTruthy()
        expect(progress.getAttribute('aria-label')).not.toContain('%')
        await waitFor(() => expect(Utils.updateJourney).toHaveBeenCalled())
        expect(Number(progress.getAttribute('aria-valuenow'))).toBe(0)
        expect(toggle.disabled).toBe(true)
        finishSaving()
        await waitFor(() => expect(Number(progress.getAttribute('aria-valuenow'))).toBe(56))
        expect(screen.queryByText('56%', {exact: true})).toBeNull()
        expect(terrainProgressMarkerMock.create).toHaveBeenCalled()
        expect(terrainProgressMarkerMock.update).toHaveBeenCalledWith([0.01, 0.02, 800])
        expect(screen.getByRole('checkbox', {name: /Anti-cliff correction/}).disabled).toBe(false)
        finishCorrection()
        await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull())
        expect(terrainProgressMarkerMock.clear).toHaveBeenCalledOnce()
        expect(redraw).toHaveBeenCalledWith(expect.objectContaining({action: DRAWING_FROM_UI, mode: NO_FOCUS}))
    })

    it('keeps the reset button at the row end without progress and clears saved corrections', async () => {
        const savedCorrectionData = {terrainId: 'terrain-a', tracks: {'track-1': [{coordinateIndex: 1}]}}
        const redraw = vi.fn(async () => {})
        const updated = {draw: redraw, tracks: new Map()}
        const journey = globalThis.lgs.stores.journeyEditor.journey
        journey.antiCliffCorrection = true
        journey.antiCliffCorrectionData = savedCorrectionData
        Utils.updateJourney.mockResolvedValue(updated)
        render(<JourneySettings/>)

        const row = document.querySelector('.lgs--journey-antcliff-setting')
        const reset = screen.getByRole('button', {name: 'Reset anti-cliff correction'})
        expect(screen.queryByRole('progressbar')).toBeNull()
        expect(row.lastElementChild).toBe(reset)

        fireEvent.click(reset)

        await waitFor(() => expect(redraw).toHaveBeenCalledWith({
            action: DRAWING_FROM_UI,
            mode:   NO_FOCUS,
        }))
        expect(Utils.updateJourney).toHaveBeenCalledWith(UPDATE_JOURNEY_SILENTLY, {focus: false})
        expect(screen.getByRole('checkbox', {name: /Anti-cliff correction/}).checked).toBe(false)
        expect(journey.antiCliffCorrection).toBe(false)
        expect(journey.antiCliffCorrectionData).toBeNull()
        expect(row.lastElementChild).toBe(reset)
    })

    it('cancels an active correction when reset is clicked and prevents stale corrected redraws', async () => {
        let finishCorrection
        const track = {content: {geometry: {coordinates: [[0, 0], [1, 1]], type: 'LineString'}}, slug: 'track-1'}
        const alignedDraw = vi.fn(async () => {})
        const rawDraw = vi.fn(async () => {})
        const alignedJourney = {draw: alignedDraw, tracks: new Map([['track-1', track]])}
        const rawJourney = {draw: rawDraw, tracks: new Map([['track-1', track]])}
        Utils.updateJourney.mockResolvedValueOnce(alignedJourney).mockResolvedValueOnce(rawJourney)
        terrainPrepareMock.mockImplementation(async (_track, {onProgress} = {}) => {
            onProgress?.(37)
            await new Promise(resolve => {
                finishCorrection = resolve
            })
            return {changed: true}
        })
        globalThis.lgs.settings.layers = {terrain: 'terrain-a'}
        globalThis.lgs.stores.journeyEditor.journey.tracks.set('track-1', track)
        render(<JourneySettings/>)

        fireEvent.click(screen.getByRole('checkbox', {name: /Anti-cliff correction/}))
        await screen.findByRole('progressbar', {name: /Anti-cliff check and correction progress/})
        await waitFor(() => expect(terrainPrepareMock).toHaveBeenCalled())
        fireEvent.click(screen.getByRole('button', {name: 'Reset anti-cliff correction'}))

        await waitFor(() => expect(rawDraw).toHaveBeenCalledWith({
            action: DRAWING_FROM_UI,
            mode:   NO_FOCUS,
        }))
        expect(globalThis.lgs.stores.journeyEditor.journey.antiCliffCorrection).toBe(false)
        expect(globalThis.lgs.stores.journeyEditor.journey.antiCliffCorrectionData).toBeNull()
        expect(screen.queryByRole('progressbar')).toBeNull()
        finishCorrection()
        await waitFor(() => expect(alignedDraw).not.toHaveBeenCalled())
        expect(terrainProgressMarkerMock.clear).toHaveBeenCalled()
    })

    it('allows disabling correction while its progress is running and skips the stale aligned redraw', async () => {
        let finishCorrection
        const track = {content: {geometry: {coordinates: [[0, 0], [1, 1]], type: 'LineString'}}}
        const alignedDraw = vi.fn(async () => {})
        const rawDraw = vi.fn(async () => {})
        const alignedJourney = {draw: alignedDraw, tracks: new Map([['track-1', track]])}
        const rawJourney = {draw: rawDraw, tracks: new Map([['track-1', track]])}
        Utils.updateJourney
            .mockResolvedValueOnce(alignedJourney)
            .mockResolvedValueOnce(rawJourney)
        terrainPrepareMock.mockImplementation(async (_track, {onProgress} = {}) => {
            onProgress?.(37)
            await new Promise(resolve => {
                finishCorrection = resolve
            })
            return {changed: true}
        })

        render(<JourneySettings/>)
        const toggle = screen.getByRole('checkbox', {name: /Anti-cliff correction/})
        fireEvent.click(toggle)
        const progress = await screen.findByRole('progressbar', {name: /Anti-cliff check and correction progress/})
        await waitFor(() => expect(Number(progress.getAttribute('aria-valuenow'))).toBe(56))
        expect(screen.getByRole('checkbox', {name: /Anti-cliff correction/}).disabled).toBe(false)

        fireEvent.click(screen.getByRole('checkbox', {name: /Anti-cliff correction/}))
        await waitFor(() => expect(rawDraw).toHaveBeenCalledWith(expect.objectContaining({action: DRAWING_FROM_UI, mode: NO_FOCUS})))
        expect(terrainProgressMarkerMock.clear).toHaveBeenCalled()
        finishCorrection()
        await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull())

        expect(alignedDraw).not.toHaveBeenCalled()
        expect(globalThis.lgs.stores.journeyEditor.journey.antiCliffCorrection).toBe(false)
    })

    it('always shows the switch and skips correction work when the on-demand check is clean', async () => {
        const redraw = vi.fn(async () => {})
        const track = {content: {geometry: {coordinates: [[0, 0], [1, 1]], type: 'LineString'}}}
        const updated = {draw: redraw, tracks: new Map([['track-1', track]])}
        terrainCheckMock.mockResolvedValue({status: 'clean', detectedPoints: 0})
        Utils.updateJourney.mockResolvedValue(updated)
        render(<JourneySettings/>)

        const toggle = screen.getByRole('checkbox', {name: /Anti-cliff correction/})
        fireEvent.click(toggle)

        await waitFor(() => expect(redraw).toHaveBeenCalledWith(expect.objectContaining({action: DRAWING_FROM_UI, mode: NO_FOCUS})))
        expect(terrainCheckMock).toHaveBeenCalledWith(track, expect.objectContaining({onProgress: expect.any(Function)}))
        expect(terrainPrepareMock).not.toHaveBeenCalled()
    })

    it('preserves saved corrections and the enabled switch while terrain identity is unavailable', async () => {
        const savedCorrectionData = {terrainId: 'terrain-a', tracks: {'track-1': []}}
        const track = {content: {geometry: {coordinates: [[0, 0], [1, 1]], type: 'LineString'}}}
        const persist = vi.fn(async () => {})
        const redraw = vi.fn(async () => {})
        const updated = {
            antiCliffCorrection: true,
            antiCliffCorrectionData: savedCorrectionData,
            draw: redraw,
            persistToDatabase: persist,
            tracks: new Map([['track-1', track]]),
        }
        globalThis.lgs.settings.layers = {terrain: null}
        globalThis.lgs.stores.journeyEditor.journey.antiCliffCorrectionData = savedCorrectionData
        terrainCheckMock.mockResolvedValue({status: 'unavailable', detectedPoints: 0})
        Utils.updateJourney.mockResolvedValue(updated)
        render(<JourneySettings/>)

        const toggle = screen.getByRole('checkbox', {name: /Anti-cliff correction/})
        fireEvent.click(toggle)

        await waitFor(() => expect(redraw).toHaveBeenCalled())
        expect(globalThis.lgs.stores.journeyEditor.journey.antiCliffCorrection).toBe(true)
        expect(globalThis.lgs.stores.journeyEditor.journey.antiCliffCorrectionData).toEqual(savedCorrectionData)
        expect(updated.antiCliffCorrectionData).toBe(savedCorrectionData)
        expect(terrainPrepareMock).not.toHaveBeenCalled()
        expect(persist).not.toHaveBeenCalled()
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
