/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-export-frame-mode.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-15
 * Last modified: 2026-07-15
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { JourneyReplayMode }          from '@Core/ui/replay/JourneyReplayMode'
import { JourneyReplayPlaybackController } from '@Core/ui/replay/JourneyReplayPlaybackController'
import { REPLAY_CLIP_SLOT_START, REPLAY_CLIP_SLOT_STOP } from '@Core/ui/replay/JourneyReplayClips'
import { defaultJourneyReplaySettings } from '@Core/ui/replay/JourneyReplayProgressionStyle'
import { Cartesian3 }                  from 'cesium'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@Utils/cesium/TrackUtils', () => ({
    TrackUtils: {
        getTrackRenderStyle: vi.fn(() => null),
        createTrackMaterial: vi.fn(() => null),
        getDataSourcesByName: vi.fn(() => []),
    },
}))

vi.mock('@Components/Toast', () => ({
    LGS_ERROR_TOAST:       'danger',
    LGS_INFORMATION_TOAST: 'primary',
    LGS_SUCCESS_TOAST:     'success',
    LGS_TOAST_DURATION:    5000,
    LGS_WARNING_TOAST:     'warning',
    showToast:             vi.fn(),
}))

const makeTrack = ({slug, coordinates}) => ({
    slug,
    visible: true,
    metrics: {},
    content: {
        type:       'Feature',
        properties: {},
        geometry:   {
            type: 'LineString',
            coordinates,
        },
    },
})

const makeJourney = tracks => ({
    slug:   'journey#gpx',
    tracks: new Map(tracks.map(track => [track.slug, track])),
})

const makeDataSources = () => ({
    items: [],
    add(source) {
        this.items.push(source)
        return Promise.resolve(source)
    },
    contains(source) {
        return this.items.includes(source)
    },
    getByName(name) {
        return this.items.filter(source => source.name === name)
    },
    raiseToTop: vi.fn(),
})

const replaySource = dataSources => dataSources.getByName('replay#journey#gpx')[0]

const visibleTraceEntities = dataSources => replaySource(dataSources)
    ?.entities
    ?.values
    ?.filter(entity => entity.polyline && entity.show !== false) ?? []

const installReplayGlobals = (journey, {dataSources = null} = {}) => {
    const replay = defaultJourneyReplaySettings()
    globalThis.lgs = {
        theJourney: journey,
        theTrack:   null,
        settings:   {
            ui: {
                replay,
                journeyToolbar: {show: true},
            },
        },
        stores:     {
            replay: {
                progress: 0,
                camera:   replay.camera,
                marker:   replay.marker,
                trace:    replay.trace,
            },
        },
        viewer:     {
            trackedEntity: null,
            dataSources,
            canvas: {
                clientWidth:  1000,
                clientHeight: 1000,
                addEventListener:    () => {},
                removeEventListener: () => {},
            },
            camera: {
                heading: 0,
                pitch:   -0.8,
                roll:    0,
                position: Cartesian3.fromDegrees(2, 48, 1500),
                frustum:  {fovy: Math.PI / 3},
                positionCartographic: {longitude: 2, latitude: 48, height: 1000},
                moveStart: {addEventListener: () => {}, removeEventListener: () => {}},
                moveEnd:   {addEventListener: () => {}, removeEventListener: () => {}},
                cancelFlight:    () => {},
                lookAtTransform: () => {},
            },
        },
        scene:      {
            canvas: {height: 1000},
            requestRender: vi.fn(),
            globe: {getHeight: () => 120},
        },
    }
    globalThis.__ = {
        ui: {
            cameraManager: {
                stopRotate: vi.fn(),
            },
        },
    }
}

describe('JourneyReplayMode HQ export frames', () => {
    afterEach(() => {
        delete globalThis.lgs
        delete globalThis.__
    })

    it('hides the replay marker before and during HQ start clips', async () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
            }),
        ])
        installReplayGlobals(journey)

        const renderer = {
            clear:      vi.fn(),
            show:       vi.fn(),
            update:     vi.fn(),
            hideCursor: vi.fn(),
        }
        const mode = new JourneyReplayMode({
            controller: new JourneyReplayPlaybackController({
                requestFrame: () => 1,
                cancelFrame:  () => {},
                now:          () => 0,
            }),
            renderer,
        })

        mode.configure({duration: 1})

        await mode.preparePlaybackSceneForExport({
            journey,
            progress: 0,
            hideReplayMarker: true,
        })

        expect(renderer.hideCursor).toHaveBeenCalledTimes(1)

        await mode.renderReplayExportFrame({
            phase: {
                kind: REPLAY_CLIP_SLOT_START,
                slot: REPLAY_CLIP_SLOT_START,
                clip: {clipId: 'zoom-in', params: {duration: 1}},
                anchorProgress: 0,
                localProgress: 0,
                localMillis: 0,
            },
        })

        expect(renderer.update).toHaveBeenCalledWith(expect.objectContaining({
            forceGeometry: true,
            hideCursor:    true,
            freezeDynamic: false,
        }))
    })

    it('renders stop clip frames with the existing dynamic terrain trace and without the remaining trace layer', async () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
            }),
        ])
        installReplayGlobals(journey)

        const renderer = {
            clear:      vi.fn(),
            show:       vi.fn(),
            update:     vi.fn(),
            hideCursor: vi.fn(),
        }
        const mode = new JourneyReplayMode({
            controller: new JourneyReplayPlaybackController({
                requestFrame: () => 1,
                cancelFrame:  () => {},
                now:          () => 0,
            }),
            renderer,
        })

        mode.configure({duration: 1})

        await mode.renderReplayExportFrame({
            phase: {
                kind: REPLAY_CLIP_SLOT_STOP,
                slot: REPLAY_CLIP_SLOT_STOP,
                clip: {clipId: 'landing', params: {duration: 1}},
                anchorProgress: 1,
                localProgress: 0,
                localMillis: 0,
            },
        })

        expect(renderer.update).toHaveBeenLastCalledWith(expect.objectContaining({
            forceGeometry:        true,
            hideCursor:           true,
            freezeDynamic:        false,
            hideRemainingTrace:   true,
            staticCompletedTrace: false,
            completedTraceMode:   'stop-dynamic',
        }))
    })

    it('does not use a video trace overlay because the replay trace must stay terrain clamped', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
            }),
        ])
        installReplayGlobals(journey)

        const sourceCanvas = document.createElement('canvas')
        const renderer = {
            createCompletedTraceVideoOverlay: vi.fn(),
        }
        const mode = new JourneyReplayMode({
            controller: new JourneyReplayPlaybackController({
                requestFrame: () => 1,
                cancelFrame:  () => {},
                now:          () => 0,
            }),
            renderer,
        })

        expect(mode.createReplayExportTraceOverlay({
            phase: {slot: REPLAY_CLIP_SLOT_START},
            sourceCanvas,
        })).toBeNull()
        expect(mode.createReplayExportTraceOverlay({
            phase: {slot: 'replay'},
            cropRect: {left: 0, top: 0, width: 320, height: 180},
            outputDpr: 2,
            sourceCanvas,
        })).toBeNull()
        expect(mode.createReplayExportTraceOverlay({
            phase: {slot: REPLAY_CLIP_SLOT_STOP},
            sourceCanvas,
        })).toBeNull()
        expect(renderer.createCompletedTraceVideoOverlay).not.toHaveBeenCalled()
    })

    it('prepares the replay renderer for HQ export even when playback is not already configured', async () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
            }),
        ])
        installReplayGlobals(journey)

        const renderer = {
            clear:      vi.fn(),
            show:       vi.fn(),
            update:     vi.fn(),
            hideCursor: vi.fn(),
        }
        const mode = new JourneyReplayMode({
            controller: new JourneyReplayPlaybackController({
                requestFrame: () => 1,
                cancelFrame:  () => {},
                now:          () => 0,
            }),
            renderer,
        })

        await mode.preparePlaybackSceneForExport({
            journey,
            progress: 0,
        })

        expect(renderer.show).toHaveBeenCalledWith(expect.objectContaining({
            sampler: expect.objectContaining({
                hasSamples: true,
            }),
        }))

        await mode.renderReplayExportFrame({
            phase: {
                kind: REPLAY_CLIP_SLOT_STOP,
                slot: REPLAY_CLIP_SLOT_STOP,
                clip: {clipId: 'landing', params: {duration: 1}},
                anchorProgress: 1,
                localProgress: 0,
                localMillis: 0,
            },
        })

        expect(renderer.update).toHaveBeenLastCalledWith(expect.objectContaining({
            forceGeometry:        true,
            freezeDynamic:        false,
            hideRemainingTrace:   true,
            staticCompletedTrace: false,
            completedTraceMode:   'stop-dynamic',
        }))
    })

    it('renders a visible completed trace on HQ stop clips after export preparation', async () => {
        const dataSources = makeDataSources()
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[2, 48, 120], [2.001, 48.001, 130], [2.002, 48.002, 140]],
            }),
        ])
        installReplayGlobals(journey, {dataSources})
        const mode = new JourneyReplayMode({
            controller: new JourneyReplayPlaybackController({
                requestFrame: () => 1,
                cancelFrame:  () => {},
                now:          () => 0,
            }),
        })

        await mode.preparePlaybackSceneForExport({
            journey,
            progress: 0,
        })
        await Promise.resolve()

        await mode.renderReplayExportFrame({
            phase: {
                kind: REPLAY_CLIP_SLOT_STOP,
                slot: REPLAY_CLIP_SLOT_STOP,
                clip: {clipId: 'landing', params: {duration: 1}},
                anchorProgress: 1,
                localProgress: 0,
                localMillis: 0,
            },
        })

        expect(visibleTraceEntities(dataSources)
            .some(entity => String(entity.id).includes('#completed#'))).toBe(true)
        expect(visibleTraceEntities(dataSources)
            .some(entity => String(entity.id).includes('#remaining#'))).toBe(false)
    })
})
