/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-export-frame-mode.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
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
import {
    defaultJourneyReplaySettings,
    REPLAY_CAMERA_POSITION_AHEAD,
    REPLAY_CAMERA_POSITION_BEHIND,
    REPLAY_CAMERA_POSITION_SYSTEM,
    REPLAY_MARKER_MODE_HYSTERESIS,
    REPLAY_MARKER_MODE_NAVIGATION,
} from '@Core/ui/replay/JourneyReplayProgressionStyle'
import { Cartesian3, Cartographic } from 'cesium'
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

    it('descends progressively during HQ landing clips', async () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
            }),
        ])
        installReplayGlobals(journey)

        const setView = vi.fn(options => {
            globalThis.lgs.viewer.camera.position = options.destination
            globalThis.lgs.viewer.camera.positionCartographic = Cartographic.fromCartesian(options.destination)
        })
        globalThis.lgs.viewer.camera.setView = setView

        const mode = new JourneyReplayMode({
            controller: new JourneyReplayPlaybackController({
                requestFrame: () => 1,
                cancelFrame:  () => {},
                now:          () => 0,
            }),
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
        await mode.renderReplayExportFrame({
            phase: {
                kind: REPLAY_CLIP_SLOT_STOP,
                slot: REPLAY_CLIP_SLOT_STOP,
                clip: {clipId: 'landing', params: {duration: 1}},
                anchorProgress: 1,
                localProgress: 0.5,
                localMillis: 500,
            },
        })

        expect(setView).toHaveBeenCalledTimes(2)
        expect(Cartesian3.distance(
            setView.mock.calls[0][0].destination,
            setView.mock.calls[1][0].destination,
        )).toBeGreaterThan(1)
    })

    it('uses the replay camera heading for HQ zoom clip frames instead of snapping to north', async () => {
        const destinationForHeading = async heading => {
            const journey = makeJourney([
                makeTrack({
                    slug:        'track#journey#gpx#main',
                    coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                }),
            ])
            installReplayGlobals(journey)
            globalThis.lgs.settings.ui.replay.camera.heading = heading
            globalThis.lgs.stores.replay.camera = globalThis.lgs.settings.ui.replay.camera

            const setView = vi.fn(options => {
                globalThis.lgs.viewer.camera.position = options.destination
                globalThis.lgs.viewer.camera.positionCartographic = Cartographic.fromCartesian(options.destination)
            })
            globalThis.lgs.viewer.camera.setView = setView

            const mode = new JourneyReplayMode({
                controller: new JourneyReplayPlaybackController({
                    requestFrame: () => 1,
                    cancelFrame:  () => {},
                    now:          () => 0,
                }),
            })

            mode.configure({duration: 1})

            await mode.renderReplayExportFrame({
                phase: {
                    kind: REPLAY_CLIP_SLOT_START,
                    slot: REPLAY_CLIP_SLOT_START,
                    clip: {clipId: 'zoom-in', params: {duration: 1}},
                    anchorProgress: 0,
                    localProgress: 1,
                    localMillis: 1000,
                },
            })

            return setView.mock.calls[0][0].destination
        }

        const northDestination = await destinationForHeading(0)
        const replayAngleDestination = await destinationForHeading(45)

        expect(Cartesian3.distance(northDestination, replayAngleDestination)).toBeGreaterThan(100)
    })

    it('uses the replay camera position mode for HQ zoom clip headings', async () => {
        const destinationForCameraMode = async ({positionMode, heading = 0, headingOffset = 0}) => {
            const journey = makeJourney([
                makeTrack({
                    slug:        'track#journey#gpx#main',
                    coordinates: [[2, 48, 120], [2.001, 48.001, 130], [2.002, 48.002, 140]],
                }),
            ])
            installReplayGlobals(journey)
            globalThis.lgs.settings.ui.replay.camera.positionMode = positionMode
            globalThis.lgs.settings.ui.replay.camera.heading = heading
            globalThis.lgs.settings.ui.replay.camera.headingOffset = headingOffset
            globalThis.lgs.stores.replay.camera = globalThis.lgs.settings.ui.replay.camera

            const setView = vi.fn(options => {
                globalThis.lgs.viewer.camera.position = options.destination
                globalThis.lgs.viewer.camera.positionCartographic = Cartographic.fromCartesian(options.destination)
            })
            globalThis.lgs.viewer.camera.setView = setView

            const mode = new JourneyReplayMode({
                controller: new JourneyReplayPlaybackController({
                    requestFrame: () => 1,
                    cancelFrame:  () => {},
                    now:          () => 0,
                }),
            })

            mode.configure({duration: 1})

            await mode.renderReplayExportFrame({
                phase: {
                    kind: REPLAY_CLIP_SLOT_START,
                    slot: REPLAY_CLIP_SLOT_START,
                    clip: {clipId: 'zoom-in', params: {duration: 1}},
                    anchorProgress: 0,
                    localProgress: 1,
                    localMillis: 1000,
                },
            })

            return setView.mock.calls[0][0].destination
        }

        const fixedDestination = await destinationForCameraMode({
            positionMode: REPLAY_CAMERA_POSITION_SYSTEM,
            heading: 150,
        })
        const behindDestination = await destinationForCameraMode({
            positionMode: REPLAY_CAMERA_POSITION_BEHIND,
        })
        const aheadDestination = await destinationForCameraMode({
            positionMode: REPLAY_CAMERA_POSITION_AHEAD,
        })
        const offsetBehindDestination = await destinationForCameraMode({
            positionMode: REPLAY_CAMERA_POSITION_BEHIND,
            headingOffset: 30,
        })

        expect(Cartesian3.distance(fixedDestination, behindDestination)).toBeGreaterThan(100)
        expect(Cartesian3.distance(behindDestination, aheadDestination)).toBeGreaterThan(100)
        expect(Cartesian3.distance(behindDestination, offsetBehindDestination)).toBeGreaterThan(100)
    })

    it('renders HQ replay frames from the export controller sample', async () => {
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
        const exportSample = {
            longitude: 9,
            latitude:  43,
            altitude:  220,
            height:    220,
            progress:  0.75,
        }
        const exportController = {
            progress: 0.75,
            seek:     vi.fn(() => exportSample),
        }

        mode.configure({duration: 1})
        renderer.update.mockClear()

        await mode.renderReplayExportFrame({
            controller: exportController,
            phase: {
                kind: 'replay',
                slot: 'replay',
                progress: 0.75,
                localMillis: 750,
            },
        })

        expect(exportController.seek).toHaveBeenCalledWith(0.75)
        expect(renderer.update).toHaveBeenCalledWith(expect.objectContaining({
            sample: exportSample,
            syncCursorToTrace: true,
        }))
    })

    it('updates the camera only through the deterministic HQ frame path', async () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
            }),
        ])
        installReplayGlobals(journey)
        const renderer = {clear: vi.fn(), show: vi.fn(), update: vi.fn(), hideCursor: vi.fn()}
        const mode = new JourneyReplayMode({
            controller: new JourneyReplayPlaybackController({
                requestFrame: () => 1,
                cancelFrame:  () => {},
                now:          () => 0,
            }),
            renderer,
        })

        mode.configure({duration: 1})
        renderer.update.mockClear()
        await mode.renderReplayExportFrame({
            phase: {kind: 'replay', slot: 'replay', progress: 0.5, localMillis: 500},
        })

        expect(renderer.update).toHaveBeenCalledTimes(1)
    })

    it('uses the corrected up vector for deterministic HQ navigation following', async () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
            }),
        ])
        installReplayGlobals(journey)
        globalThis.lgs.settings.ui.replay.marker.mode = REPLAY_MARKER_MODE_NAVIGATION
        globalThis.lgs.stores.replay.marker = globalThis.lgs.settings.ui.replay.marker
        globalThis.lgs.viewer.camera.setView = vi.fn()

        const mode = new JourneyReplayMode({
            controller: new JourneyReplayPlaybackController({
                requestFrame: () => 1,
                cancelFrame:  () => {},
                now:          () => 0,
            }),
        })

        mode.configure({duration: 1})

        await expect(mode.renderReplayExportFrame({
            frame: {
                frameTimeMs: 500,
            },
            phase: {
                kind:        'replay',
                slot:        'replay',
                progress:    0.5,
                localMillis: 500,
            },
        })).resolves.toBeTruthy()

        expect(globalThis.lgs.viewer.camera.setView).toHaveBeenCalledWith(expect.objectContaining({
            orientation: expect.objectContaining({
                up: expect.objectContaining({
                    x: expect.any(Number),
                    y: expect.any(Number),
                    z: expect.any(Number),
                }),
            }),
        }))
    })

    it('uses the corrected up vector for deterministic HQ dynamic following', async () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
            }),
        ])
        installReplayGlobals(journey)
        globalThis.lgs.settings.ui.replay.marker.mode = REPLAY_MARKER_MODE_HYSTERESIS
        globalThis.lgs.stores.replay.marker = globalThis.lgs.settings.ui.replay.marker
        globalThis.lgs.viewer.camera.setView = vi.fn()

        const mode = new JourneyReplayMode({
            controller: new JourneyReplayPlaybackController({
                requestFrame: () => 1,
                cancelFrame:  () => {},
                now:          () => 0,
            }),
        })

        mode.configure({duration: 1})

        await expect(mode.renderReplayExportFrame({
            frame: {
                frameTimeMs: 500,
            },
            phase: {
                kind:        'replay',
                slot:        'replay',
                progress:    0.5,
                localMillis: 500,
            },
        })).resolves.toBeTruthy()

        expect(globalThis.lgs.viewer.camera.setView).toHaveBeenCalledWith(expect.objectContaining({
            orientation: expect.objectContaining({
                up: expect.objectContaining({
                    x: expect.any(Number),
                    y: expect.any(Number),
                    z: expect.any(Number),
                }),
            }),
        }))
    })

    it('keeps the replay trace visible on the final HQ scene frame after stop clips', async () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
            }),
        ])
        journey.visible = false
        journey.updateVisibility = vi.fn(visible => {
            journey.visible = visible
        })
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
        renderer.update.mockClear()
        renderer.clear.mockClear()

        await mode.renderReplayExportFrame({
            phase: {
                kind: REPLAY_CLIP_SLOT_STOP,
                slot: REPLAY_CLIP_SLOT_STOP,
                clip: {clipId: 'zoom-out', params: {duration: 1}},
                anchorProgress: 1,
                localProgress: 1,
                localMillis: 1000,
                isFinalSceneFrame: true,
            },
        })

        expect(renderer.update.mock.calls).toEqual(expect.arrayContaining([
            [expect.objectContaining({
            hideCursor:           true,
            hideRemainingTrace:   true,
            completedTraceMode:   'stop-dynamic',
            })],
        ]))
        expect(renderer.clear).not.toHaveBeenCalled()
        expect(journey.visible).toBe(false)
        expect(journey.updateVisibility).not.toHaveBeenCalled()
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
