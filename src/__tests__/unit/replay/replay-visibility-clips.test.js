/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-phase1.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-01
 * Last modified: 2026-07-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { REPLAY_DRAWER }                                           from '@Core/constants'
import { createJourneyReplayClipInstance }                                from '@Core/ui/replay/JourneyReplayClips'
import {
    replayAngularDelta, replayCameraHeadingForPositionMode, replayCameraHeadingWithHysteresis,
    replayCameraRangeFromPitch, replayCameraRecenterDuration, replayCameraRecenterHeight,
    replayCameraRecenterHorizontalDistance, replayHeadingEasingFactor, replayHeadingFromLocalAxisAngle,
    replayIsWindowPointOutsideToleranceZone, replayPitchLookaheadFactor, JourneyReplayMode, replayTargetSampleForClip,
    replayToleranceZoneBounds, replayCenteredZone, replayRuntimeTrackingSettings, replayDynamicTargetPointInZone,
}                                                                      from '@Core/ui/replay/JourneyReplayMode'
import {
    REPLAY_SCOPE_ALL_TRACKS, REPLAY_SCOPE_CURRENT_TRACK, REPLAY_SCOPE_VISIBLE_TRACKS, JourneyReplayPathSampler,
}                                                                      from '@Core/ui/replay/JourneyReplayPathSampler'
import {
    REPLAY_EVENT_END, REPLAY_EVENT_START, REPLAY_EVENT_STOP, REPLAY_EVENT_UPDATE,
    JourneyReplayPlaybackController,
}                                                                      from '@Core/ui/replay/JourneyReplayPlaybackController'
import {
    defaultJourneyReplaySettings, REPLAY_CAMERA_ALTITUDE_CONSTANT, REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET,
    REPLAY_CAMERA_HEADING_OFFSET_MAX, REPLAY_CAMERA_POSITION_AHEAD, REPLAY_CAMERA_POSITION_BEHIND, REPLAY_CAMERA_POSITION_SYSTEM,
    REPLAY_CAMERA_PRESET_DEFAULT, REPLAY_CAMERA_PRESET_ULTRA_SMOOTH,
    REPLAY_MARKER_MODE_HYSTERESIS, REPLAY_MARKER_MODE_NAVIGATION, REPLAY_MARKER_MODE_TRACE,
    getJourneyReplayCameraPresetKey, normalizeJourneyReplayCamera, normalizeJourneyReplayMarker, normalizeJourneyReplaySettings,
}                                                                      from '@Core/ui/replay/JourneyReplayProgressionStyle'
import { gpx }                                                         from '@tmcw/togeojson'
import { applyGpxStyleExtensionProperties, extractLgsTrackProperties } from '@Utils/JourneyGpxUtils'
import { Cartesian3, Cartographic, Matrix4, Math as CesiumMath, Transforms } from 'cesium'
import { proxy }                                                       from 'valtio'
import { describe, expect, it, vi }                                    from 'vitest'

vi.mock('@Components/Toast', () => ({
    LGS_ERROR_TOAST:       'danger',
    LGS_INFORMATION_TOAST: 'primary',
    LGS_SUCCESS_TOAST:     'success',
    LGS_TOAST_DURATION:    5000,
    LGS_WARNING_TOAST:     'warning',
    showToast:             vi.fn(),
}))


import {makeJourney, makeTrack} from './replay-phase1-fixtures'

describe('replay visibility and clips', () => {

    it('recenters on the current journey when stopping an active replay', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        journey.focus = vi.fn()
        journey.persistToDatabase = vi.fn(() => Promise.resolve())
        journey.visible = false
        const editorJourney = {visible: false}
        let cancelFlightCalls = 0

        globalThis.lgs = {
            theJourney: journey,
            theJourneyEditorProxy: {journey: editorJourney},
            theTrack:   null,
            settings:   {ui: {replay, journeyToolbar: {show: true}}},
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                      orbitAllowed: true,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                camera:        {
                    heading:              0.4,
                    pitch:                -0.7,
                    roll:                 0,
                    positionCartographic: {longitude: 0.1, latitude: 0.2, height: 3456},
                    moveStart:            {
                        addEventListener:       () => {
                        }, removeEventListener: () => {
                        },
                    },
                    moveEnd:              {
                        addEventListener:       () => {
                        }, removeEventListener: () => {
                        },
                    },
                    cancelFlight:         () => {
                        cancelFlightCalls += 1
                    },
                    lookAtTransform:      () => {
                    },
                    setView:              () => {
                    },
                },
            },
            scene:      {
                requestRender: () => {
                }, globe:      {getHeight: () => 120},
            },
        }

        try {
            const mode = new JourneyReplayMode({
                                                controller: new JourneyReplayPlaybackController({
                                                                                                 requestFrame: () => 1,
                                                                                                 cancelFrame:  () => {
                                                                                                 },
                                                                                                 now:          () => 0,
                                                                                             }),
                                                renderer:   {
                                                    clear:  () => {
                                                    },
                                                    show:   () => {
                                                    },
                                                    update: () => {
                                                    },
                                                },
            })
            mode.start()
            expect(mode.isJourneyToolbarTemporarilyHidden()).toBe(true)
            expect(globalThis.lgs.settings.ui.journeyToolbar.show).toBe(true)
            expect(journey.visible).toBe(false)
            expect(editorJourney.visible).toBe(false)
            expect(globalThis.lgs.stores.replay.orbitAllowed).toBe(false)
            mode.stop()
            expect(mode.isJourneyToolbarTemporarilyHidden()).toBe(false)
            expect(globalThis.lgs.settings.ui.journeyToolbar.show).toBe(true)
            expect(journey.visible).toBe(true)
            expect(editorJourney.visible).toBe(true)
            expect(globalThis.lgs.stores.replay.orbitAllowed).toBe(true)
            expect(journey.persistToDatabase).toHaveBeenCalled()

            expect(cancelFlightCalls).toBeGreaterThan(0)
            expect(journey.focus).toHaveBeenCalledTimes(1)
            expect(journey.focus).toHaveBeenCalledWith(expect.objectContaining({
                                                                                  resetCamera: true,
                                                                                  rotate: false,
                                                                                  snapDistance: 50000,
                                                                              }))
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('clears the replay marker and trace when stop clips complete', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        journey.focus = vi.fn()
        const renderer = {
            clear:  vi.fn(),
            show:   vi.fn(),
            update: vi.fn(),
        }
        const frames = []
        let now = 0
        const controller = new JourneyReplayPlaybackController({
            requestFrame: callback => {
                frames.push(callback)
                return frames.length
            },
            cancelFrame:  () => {
            },
            now:          () => now,
        })

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        duration: 1,
                        clips: {
                            catalog: {},
                            start:   [],
                            stop:    [],
                        },
                    },
                    journeyToolbar: {show: true},
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                      clips:  {
                                          catalog: {},
                                          start:   [],
                                          stop:    [],
                                      },
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                camera:        {
                    heading:              0.4,
                    pitch:                -0.7,
                    roll:                 0,
                    positionCartographic: {longitude: 0.1, latitude: 0.2, height: 3456},
                    moveStart:            {
                        addEventListener:       () => {
                        }, removeEventListener: () => {
                        },
                    },
                    moveEnd:              {
                        addEventListener:       () => {
                        }, removeEventListener: () => {
                        },
                    },
                    cancelFlight:         () => {
                    },
                    flyTo:                () => {
                    },
                    setView:              () => {
                    },
                    lookAtTransform:      () => {
                    },
                },
            },
            scene:      {
                canvas:                       {getBoundingClientRect: () => ({left: 0, top: 0, width: 1000, height: 800})},
                requestRender:                () => {
                },
                cartesianToCanvasCoordinates:  () => ({x: 500, y: 400}),
                globe:                        {getHeight: () => 120},
            },
        }

        try {
            const mode = new JourneyReplayMode({controller, renderer})
            mode.start()

            expect(renderer.clear).toHaveBeenCalledTimes(1)

            now = 1000
            frames.shift()()

            expect(renderer.clear).toHaveBeenCalledTimes(2)
            expect(journey.focus).toHaveBeenCalled()
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('lands on the last replay sample, not on the live camera position', async () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        const landingDefinition = {
            id:           'landing',
            label:        'Landing',
            slots:        ['stop'],
            maxInstances: 1,
            defaults:     {
                duration: 0,
            },
            fields:       [{
                key:     'duration',
                label:   'Duration (s)',
                type:    'number',
                min:     0,
                max:     60,
                step:    0.1,
                default: 0,
            }],
        }
        const landing = createJourneyReplayClipInstance(landingDefinition, 'stop', {
            params: {
                duration: 0,
            },
        })
        const currentCameraSample = {
            longitude: 9,
            latitude:  9,
            altitude:  999,
        }
        const runLanding = async endSample => {
            const setViewCalls = []
            const listeners = new Map()
            const sampler = {
                hasSamples: true,
                atProgress: progress => progress >= 1 ? endSample : {
                    longitude: 2,
                    latitude:  48,
                    altitude:  120,
                },
            }
            const controller = {
                configure: () => controller,
                on: (event, callback) => {
                    listeners.set(event, callback)
                    return () => listeners.delete(event)
                },
                start: () => {
                    listeners.get(REPLAY_EVENT_START)?.({
                                                                controller,
                                                                sampler,
                                                                sample:   sampler.atProgress(0),
                                                                progress: 0,
                                                            })
                    return sampler.atProgress(0)
                },
                pause: () => currentCameraSample,
                resume: () => currentCameraSample,
                stop: () => currentCameraSample,
                currentSample: () => currentCameraSample,
            }

            globalThis.lgs = {
                theJourney: journey,
                theTrack:   null,
                settings:   {
                    ui: {
                        replay: {
                            ...replay,
                            clips: {
                                catalog: {
                                    landing: landingDefinition,
                                },
                                start: [],
                                stop:  [landing],
                            },
                        },
                    },
                },
                stores:     {
                    replay: proxy({
                                          progress: 0,
                                          camera:   replay.camera,
                                          clips:  {
                                              catalog: {
                                                  landing: landingDefinition,
                                              },
                                              start: [],
                                              stop:  [landing],
                                          },
                                      }),
                },
                viewer:     {
                    trackedEntity: null,
                    camera:        {
                        heading:              0.4,
                        pitch:                -0.7,
                        roll:                 0,
                        positionCartographic: {longitude: 9, latitude: 9, height: 999},
                        moveStart:            {
                            addEventListener:       () => {
                            }, removeEventListener: () => {
                            },
                        },
                        moveEnd:              {
                            addEventListener:       () => {
                            }, removeEventListener: () => {
                            },
                        },
                        cancelFlight:         () => {
                        },
                        flyTo:                () => {
                        },
                        setView:              options => setViewCalls.push(options),
                        lookAtTransform:      () => {
                        },
                    },
                },
                scene:      {
                    requestRender: () => {
                    },
                    globe:         {
                        getHeight: () => 120,
                    },
                },
            }

            const mode = new JourneyReplayMode({
                                                controller,
                                                renderer:   {
                                                    clear:  () => {
                                                    },
                                                    show:   () => {
                                                    },
                                                    update: () => {
                                                    },
                                                },
                                            })

            mode.start()
            listeners.get(REPLAY_EVENT_END)?.({
                                                      controller,
                                                      sampler,
                                                      sample:   currentCameraSample,
                                                      progress: 1,
                                                  })
            await Promise.resolve()
            await Promise.resolve()

            expect(setViewCalls).toHaveLength(1)
            return setViewCalls[0].destination
        }

        try {
            const destinationFromFinal = await runLanding({
                longitude: 2.001,
                latitude:  48.001,
                altitude:  130,
            })
            const destinationFromCamera = await runLanding(currentCameraSample)

            expect(Cartesian3.distance(destinationFromFinal, destinationFromCamera)).toBeGreaterThan(1000)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('hides other journeys during replay and restores them at the end', () => {
        const currentJourney = makeJourney([
                                               makeTrack({
                                                             slug:        'track#journey#gpx#main',
                                                             coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                         }),
                                           ])
        const otherJourney = makeJourney([
                                             makeTrack({
                                                           slug:        'track#journey#other#main',
                                                           coordinates: [[3, 47, 90], [3.001, 47.001, 100]],
                                                       }),
                                         ])
        currentJourney.slug = 'journey-current'
        otherJourney.slug = 'journey-other'
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        const frames = []
        let now = 0
        currentJourney.visible = false
        otherJourney.visible = true
        currentJourney.focus = vi.fn()
        currentJourney.updateVisibility = vi.fn(visible => {
            currentJourney.visible = visible
        })
        otherJourney.updateVisibility = vi.fn(visible => {
            otherJourney.visible = visible
        })
        const controller = new JourneyReplayPlaybackController({
            requestFrame: callback => {
                frames.push(callback)
                return frames.length
            },
            cancelFrame:  () => {
            },
            now:          () => now,
        })

        globalThis.lgs = {
            theJourney: currentJourney,
            theTrack:   null,
            journeys:   new Map([
                [currentJourney.slug, currentJourney],
                [otherJourney.slug, otherJourney],
            ]),
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        hideOtherJourneys: true,
                        duration:          1,
                    },
                    journeyToolbar: {show: true},
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                      hideOtherJourneys: true,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                camera:        {
                    heading:              0.4,
                    pitch:                -0.7,
                    roll:                 0,
                    positionCartographic: {longitude: 0.1, latitude: 0.2, height: 3456},
                    moveStart:            {
                        addEventListener:       () => {
                        }, removeEventListener: () => {
                        },
                    },
                    moveEnd:              {
                        addEventListener:       () => {
                        }, removeEventListener: () => {
                        },
                    },
                    cancelFlight:         () => {
                    },
                    flyTo:                () => {
                    },
                    setView:              () => {
                    },
                    lookAtTransform:      () => {
                    },
                },
            },
            scene:      {
                requestRender: () => {
                },
            },
        }

        try {
            const mode = new JourneyReplayMode({
                                                controller,
                                                renderer: {
                                                    clear:  vi.fn(),
                                                    show:   vi.fn(),
                                                    update: vi.fn(),
                                                },
                                            })

            expect(otherJourney.visible).toBe(true)
            mode.start({duration: 1})
            expect(currentJourney.updateVisibility).toHaveBeenCalledWith(false)
            expect(currentJourney.visible).toBe(false)
            expect(otherJourney.updateVisibility).toHaveBeenCalledWith(false)
            expect(otherJourney.visible).toBe(false)

            now = 1000
            frames.shift()()

            expect(currentJourney.updateVisibility).toHaveBeenCalledWith(true)
            expect(currentJourney.visible).toBe(true)
            expect(otherJourney.updateVisibility).toHaveBeenCalledWith(true)
            expect(otherJourney.visible).toBe(true)
            expect(globalThis.lgs.stores.replay.hideOtherJourneys).toBe(true)
            expect(globalThis.lgs.settings.ui.replay.hideOtherJourneys).toBe(true)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('keeps current journey poi datasources visible while hiding current journey polylines', () => {
        const currentJourney = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
            }),
        ])
        currentJourney.slug = 'journey-current'
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        const frames = []
        let now = 0
        const currentSource = {
            name:     currentJourney.slug,
            show:     true,
            entities: {
                values: [
                    {
                        id:       'track-polyline',
                        polyline: {show: true},
                    },
                    {
                        id:   'poi-journey',
                        show: true,
                    },
                ],
                getById(id) {
                    return this.values.find(entity => entity.id === id)
                },
            },
        }
        const dataSources = {
            items: [currentSource],
            getByName(name) {
                return this.items.filter(source => source.name === name)
            },
            get(index) {
                return this.items[index]
            },
            get length() {
                return this.items.length
            },
        }
        const controller = new JourneyReplayPlaybackController({
            requestFrame: callback => {
                frames.push(callback)
                return frames.length
            },
            cancelFrame:  () => {},
            now:          () => now,
        })

        currentJourney.visible = true
        currentJourney.updateVisibility = vi.fn(visible => {
            currentJourney.visible = visible
            currentSource.show = visible
            currentSource.entities.values.forEach(entity => {
                if (entity.polyline) {
                    entity.polyline.show = visible
                }
            })
        })

        globalThis.lgs = {
            theJourney: currentJourney,
            theTrack:   null,
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        duration: 1,
                    },
                    journeyToolbar: {show: true},
                },
            },
            stores:     {
                replay: proxy({
                    progress: 0,
                    camera:   replay.camera,
                }),
            },
            viewer:     {
                trackedEntity: null,
                dataSources,
                camera: {
                    heading:              0.4,
                    pitch:                -0.7,
                    roll:                 0,
                    positionCartographic: {longitude: 2, latitude: 48, height: 120},
                    moveStart:            {addEventListener: () => {}, removeEventListener: () => {}},
                    moveEnd:              {addEventListener: () => {}, removeEventListener: () => {}},
                    cancelFlight:         () => {},
                    flyTo:                () => {},
                    setView:              () => {},
                    lookAtTransform:      () => {},
                },
            },
            scene:      {
                requestRender: () => {},
            },
        }

        try {
            const mode = new JourneyReplayMode({
                controller,
                renderer: {
                    clear:  vi.fn(),
                    show:   vi.fn(),
                    update: vi.fn(),
                },
            })

            mode.start({duration: 1})

            expect(currentJourney.updateVisibility).toHaveBeenCalledWith(false)
            expect(currentSource.show).toBe(true)
            expect(currentSource.entities.getById('track-polyline').polyline.show).toBe(false)

            now = 1000
            frames.shift()()

            expect(currentJourney.updateVisibility).toHaveBeenCalledWith(true)
            expect(currentSource.entities.getById('track-polyline').polyline.show).toBe(true)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('reduces nearby pois, opens them on passage for 3 seconds, then restores their previous state on stop', async () => {
        vi.useFakeTimers()

        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
            }),
        ])
        const previousLgs = globalThis.lgs
        const previous__ = globalThis.__
        const replay = defaultJourneyReplaySettings()
        const listeners = new Map()
        const poiA = {id: 'poi-a', expanded: true}
        const poiB = {id: 'poi-b', expanded: false}
        const poiList = new Map([
            [poiA.id, poiA],
            [poiB.id, poiB],
        ])
        const sampler = {
            hasSamples: true,
            totalDistance: 100,
            atProgress: progress => ({
                longitude: 2,
                latitude:  48,
                altitude:  120,
                progress,
                distanceFromStart: progress * 100,
            }),
        }
        const controller = {
            progress:   0,
            running:    false,
            playing:    false,
            paused:     false,
            configure:  vi.fn(() => controller),
            currentSample: vi.fn(() => sampler.atProgress(controller.progress)),
            on:         (event, callback) => {
                listeners.set(event, callback)
                return () => listeners.delete(event)
            },
            start:      vi.fn(({progress = 0} = {}) => {
                controller.progress = progress
                controller.running = true
                controller.playing = true
                const sample = sampler.atProgress(progress)
                listeners.get(REPLAY_EVENT_START)?.({
                    controller,
                    sampler,
                    sample,
                    progress,
                })
                return sample
            }),
            pause:      vi.fn(),
            resume:     vi.fn(),
            stop:       vi.fn(),
        }
        const updatePOI = vi.fn(async (id, updates) => {
            const poi = poiList.get(id)
            Object.assign(poi, updates)
            poiList.set(id, poi)
            return poi
        })

        globalThis.__ = {
            ui: {
                poiManager: {
                    updatePOI,
                    getJourneyReplayPOIsForJourney: vi.fn(() => [
                        {poi: {id: 'poi-a'}, projectedAbscissa: 10},
                        {poi: {id: 'poi-b'}, projectedAbscissa: 60},
                    ]),
                },
                cameraManager: {
                    stopRotate: vi.fn(async () => undefined),
                },
            },
        }

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        poiDistance: 1000,
                    },
                    journeyToolbar: {show: true},
                },
            },
            stores:     {
                main: {
                    components: {
                        pois: {
                            list: poiList,
                        },
                    },
                },
                replay: proxy({
                    progress:    0,
                    duration:    60,
                    poiDistance: 1000,
                    camera:      replay.camera,
                    nearbyPois:  [],
                }),
            },
            viewer:     {
                trackedEntity: null,
                camera:        {
                    heading:              0.4,
                    pitch:                -0.7,
                    roll:                 0,
                    positionCartographic: {longitude: 2, latitude: 48, height: 120},
                    moveStart:            {
                        addEventListener:       () => {},
                        removeEventListener:    () => {},
                    },
                    moveEnd:              {
                        addEventListener:       () => {},
                        removeEventListener:    () => {},
                    },
                    cancelFlight:         () => {},
                    flyTo:                () => {},
                    setView:              () => {},
                    lookAtTransform:      () => {},
                },
            },
            scene:      {
                requestRender: () => {},
            },
        }

        try {
            const mode = new JourneyReplayMode({
                controller,
                renderer: {
                    clear:  vi.fn(),
                    show:   vi.fn(),
                    update: vi.fn(),
                },
            })

            mode.start()
            await Promise.resolve()
            await Promise.resolve()

            expect(updatePOI).toHaveBeenCalledWith('poi-a', {expanded: false}, expect.any(Object))
            expect(poiB.expanded).toBe(false)

            listeners.get(REPLAY_EVENT_UPDATE)?.({
                controller,
                sampler,
                sample:   sampler.atProgress(0.15),
                progress: 0.15,
            })
            await Promise.resolve()

            expect(poiA.expanded).toBe(true)
            expect(poiB.expanded).toBe(false)

            await vi.advanceTimersByTimeAsync(3000)
            expect(poiA.expanded).toBe(false)

            listeners.get(REPLAY_EVENT_STOP)?.({
                controller,
                sampler,
                sample:   sampler.atProgress(0.15),
                progress: 0.15,
            })
            await Promise.resolve()
            await Promise.resolve()

            expect(poiA.expanded).toBe(true)
            expect(poiB.expanded).toBe(false)
        }
        finally {
            vi.useRealTimers()
            globalThis.lgs = previousLgs
            globalThis.__ = previous__
        }
    })

    it('closes POIs opened by replay before running stop clips', async () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
            }),
        ])
        const previousLgs = globalThis.lgs
        const previous__ = globalThis.__
        const replay = defaultJourneyReplaySettings()
        const stopClips = {
            catalog: {
                focus: {
                    label: 'Focus',
                    slots: ['stop'],
                    defaults: {
                        duration: 0,
                    },
                },
            },
            start: [],
            stop:  [
                {
                    clipId: 'focus',
                    params: {duration: 0},
                },
            ],
        }
        const listeners = new Map()
        const poiA = {id: 'poi-a', expanded: true}
        const poiList = new Map([[poiA.id, poiA]])
        const focusClipPOIStates = []
        const sampler = {
            hasSamples: true,
            totalDistance: 100,
            atProgress: progress => ({
                longitude: 2,
                latitude:  48,
                altitude:  120,
                progress,
                distanceFromStart: progress * 100,
            }),
        }
        const controller = {
            progress:   0,
            running:    false,
            playing:    false,
            paused:     false,
            configure:  vi.fn(() => controller),
            currentSample: vi.fn(() => sampler.atProgress(controller.progress)),
            on:         (event, callback) => {
                listeners.set(event, callback)
                return () => listeners.delete(event)
            },
            start:      vi.fn(({progress = 0} = {}) => {
                controller.progress = progress
                controller.running = true
                controller.playing = true
                const sample = sampler.atProgress(progress)
                listeners.get(REPLAY_EVENT_START)?.({
                    controller,
                    sampler,
                    sample,
                    progress,
                })
                return sample
            }),
            pause:      vi.fn(),
            resume:     vi.fn(),
            stop:       vi.fn(),
        }
        const updatePOI = vi.fn(async (id, updates) => {
            const poi = poiList.get(id)
            Object.assign(poi, updates)
            poiList.set(id, poi)
            return poi
        })

        journey.focus = vi.fn((options = {}) => {
            if (options.rotate === true) {
                focusClipPOIStates.push(poiA.expanded)
            }
            options.callback?.()
            return Promise.resolve()
        })

        globalThis.__ = {
            ui: {
                poiManager: {
                    updatePOI,
                    getJourneyReplayPOIsForJourney: vi.fn(() => [
                        {poi: {id: 'poi-a'}, projectedAbscissa: 10},
                    ]),
                },
                cameraManager: {
                    stopRotate: vi.fn(async () => undefined),
                },
            },
        }

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        poiDistance: 1000,
                        clips:       stopClips,
                    },
                    journeyToolbar: {show: true},
                },
            },
            stores:     {
                main: {
                    components: {
                        pois: {
                            list: poiList,
                        },
                    },
                },
                replay: proxy({
                    progress:    0,
                    duration:    60,
                    poiDistance: 1000,
                    camera:      replay.camera,
                    nearbyPois:  [],
                    clips:       stopClips,
                }),
            },
            viewer:     {
                trackedEntity: null,
                camera:        {
                    heading:              0.4,
                    pitch:                -0.7,
                    roll:                 0,
                    positionCartographic: {longitude: 2, latitude: 48, height: 120},
                    moveStart:            {
                        addEventListener:    () => {},
                        removeEventListener: () => {},
                    },
                    moveEnd:              {
                        addEventListener:    () => {},
                        removeEventListener: () => {},
                    },
                    cancelFlight:         () => {},
                    flyTo:                () => {},
                    setView:              () => {},
                    lookAtTransform:      () => {},
                },
            },
            scene:      {
                requestRender: () => {},
            },
        }

        try {
            const mode = new JourneyReplayMode({
                controller,
                renderer: {
                    clear:  vi.fn(),
                    show:   vi.fn(),
                    update: vi.fn(),
                },
            })

            mode.start({clips: stopClips})
            await Promise.resolve()
            await Promise.resolve()

            listeners.get(REPLAY_EVENT_UPDATE)?.({
                controller,
                sampler,
                sample:   sampler.atProgress(0.15),
                progress: 0.15,
            })
            await Promise.resolve()

            expect(poiA.expanded).toBe(true)

            listeners.get(REPLAY_EVENT_END)?.({
                controller,
                sampler,
                sample:   sampler.atProgress(1),
                progress: 1,
            })
            await new Promise(resolve => setTimeout(resolve, 0))

            expect(focusClipPOIStates).toEqual([false])

            await new Promise(resolve => setTimeout(resolve, 0))

            expect(poiA.expanded).toBe(true)
        }
        finally {
            globalThis.lgs = previousLgs
            globalThis.__ = previous__
        }
    })

    it('starts the replay after the take-off start clip completes without extra delay', async () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        const frames = []
        let now = 0
        const flyToCalls = []
        const setViewCalls = []
        const takeOffDefinition = {
            id:           'take-off',
            label:        'TakeOff',
            slots:        ['start'],
            maxInstances: 1,
            defaults:     {
                duration: 0.1,
                altitude: 300,
                pitch:    -35,
            },
            fields:       [],
        }
        const takeOff = createJourneyReplayClipInstance(takeOffDefinition, 'start', {
            params: {
                duration: 0.1,
                altitude: 300,
                pitch:    -35,
            },
        })
        journey.replay = {
            start: [takeOff],
            stop:  [],
        }

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            canvas:     {
                clientWidth:         1000,
                clientHeight:        1000,
                addEventListener:    () => {
                },
                removeEventListener: () => {
                },
            },
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        clips: {
                            catalog: {
                                'take-off': takeOffDefinition,
                            },
                            start: [],
                            stop:  [],
                        },
                    },
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                      clips:  {
                                          catalog: {
                                              'take-off': takeOffDefinition,
                                          },
                                          start: [],
                                          stop:  [],
                                      },
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                canvas:        {
                    clientWidth:         1000,
                    clientHeight:        1000,
                    addEventListener:    () => {
                    },
                    removeEventListener: () => {
                    },
                },
                camera:        {
                    heading:              0.8,
                    pitch:                -Math.PI / 4,
                    roll:                 0,
                    positionCartographic: {
                        longitude: 2,
                        latitude:  48,
                        height:    1800,
                    },
                    moveStart:            {
                        addEventListener:       () => {
                        }, removeEventListener: () => {
                        },
                    },
                    moveEnd:              {
                        addEventListener:       () => {
                        }, removeEventListener: () => {
                        },
                    },
                    cancelFlight:         () => {
                    },
                    flyTo:                options => flyToCalls.push(options),
                    setView:              options => setViewCalls.push(options),
                    lookAtTransform:      () => {
                    },
                },
            },
            scene:      {
                requestRender: () => {
                },
                globe:         {getHeight: () => 120},
            },
        }

        try {
            const mode = new JourneyReplayMode({
                                                controller: new JourneyReplayPlaybackController({
                                                                                                 requestFrame: callback => {
                                                                                                     frames.push(callback)
                                                                                                     return frames.length
                                                                                                 },
                                                                                                 cancelFrame:  () => {
                                                                                                 },
                                                                                                 now:          () => now,
                                                                                             }),
                                                renderer:   {
                                                    clear:  () => {
                                                    },
                                                    show:   () => {
                                                    },
                                                    update: () => {
                                                    },
                                                },
                                            })
            const controllerStartSpy = vi.spyOn(mode.controller, 'start')

            mode.start({duration: 1})
            await Promise.resolve()
            expect(controllerStartSpy).not.toHaveBeenCalled()

            expect(flyToCalls).toHaveLength(1)
            flyToCalls[0].complete?.()
            await new Promise(resolve => setTimeout(resolve, 0))

            expect(controllerStartSpy).toHaveBeenCalledTimes(1)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('starts the replay immediately after a zoom-in start clip finishes', async () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        const flyToCalls = []
        const zoomInDefinition = {
            id:           'zoom-in',
            label:        'Zoom in',
            slots:        ['start'],
            maxInstances: 1,
            defaults:     {
                duration: 0.1,
                altitude: 300,
                pitch:    -35,
            },
            fields:       [],
        }
        const zoomIn = createJourneyReplayClipInstance(zoomInDefinition, 'start', {
            params: {
                duration: 0.1,
                altitude: 300,
                pitch:    -35,
            },
        })
        journey.replay = {
            start: [zoomIn],
            stop:  [],
        }

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            canvas:     {
                clientWidth:         1000,
                clientHeight:        1000,
                addEventListener:    () => {
                },
                removeEventListener: () => {
                },
            },
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        clips: {
                            catalog: {
                                'zoom-in': zoomInDefinition,
                            },
                            start: [],
                            stop:  [],
                        },
                    },
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                      clips:    {
                                          catalog: {
                                              'zoom-in': zoomInDefinition,
                                          },
                                          start: [],
                                          stop:  [],
                                      },
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                canvas:        {
                    clientWidth:         1000,
                    clientHeight:        1000,
                    addEventListener:    () => {
                    },
                    removeEventListener: () => {
                    },
                },
                camera:        {
                    heading:              0.8,
                    pitch:                -Math.PI / 4,
                    roll:                 0,
                    positionCartographic: {
                        longitude: 2,
                        latitude:  48,
                        height:    1800,
                    },
                    moveStart:            {
                        addEventListener:       () => {
                        }, removeEventListener: () => {
                        },
                    },
                    moveEnd:              {
                        addEventListener:       () => {
                        }, removeEventListener: () => {
                        },
                    },
                    cancelFlight:         () => {
                    },
                    flyTo:                options => flyToCalls.push(options),
                    setView:              () => {
                    },
                    lookAtTransform:      () => {
                    },
                },
            },
            scene:      {
                requestRender: () => {
                },
                globe:         {getHeight: () => 120},
            },
        }

        try {
            const mode = new JourneyReplayMode({
                                                controller: new JourneyReplayPlaybackController({
                                                                                                 requestFrame: () => 1,
                                                                                                 cancelFrame:  () => {
                                                                                                 },
                                                                                                 now:          () => 0,
                                                                                             }),
                                                renderer:   {
                                                    clear:  () => {
                                                    },
                                                    show:   () => {
                                                    },
                                                    update: () => {
                                                    },
                                                },
                                            })
            const controllerStartSpy = vi.spyOn(mode.controller, 'start')

            mode.start({duration: 1})
            await Promise.resolve()
            expect(controllerStartSpy).not.toHaveBeenCalled()
            expect(flyToCalls).toHaveLength(1)

            flyToCalls[0].complete?.()
            await new Promise(resolve => setTimeout(resolve, 0))

            expect(controllerStartSpy).toHaveBeenCalledTimes(1)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('resolves zoom-in on the journey start sample and zoom-out on the centroid', async () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const sample = {
            longitude: 2,
            latitude:  48,
            altitude:  120,
        }
        const sceneManager = {
            getJourneyCentroid: vi.fn(async () => ({
                longitude: 2.25,
                latitude:  48.25,
                height:    120,
            })),
        }

        const zoomInTarget = await replayTargetSampleForClip({
            sample,
            clipId: 'zoom-in',
            journey,
            sceneManager,
            markerHeightForSample: () => 120,
        })
        expect(zoomInTarget).toEqual(expect.objectContaining({
            longitude: 2,
            latitude:  48,
            altitude:  120,
        }))

        sceneManager.getJourneyCentroid.mockResolvedValueOnce({
            longitude: 2.75,
            latitude:  48.75,
            height:    120,
        })
        const zoomOutTarget = await replayTargetSampleForClip({
            sample,
            clipId: 'zoom-out',
            journey,
            sceneManager,
            markerHeightForSample: () => 120,
        })
        expect(zoomOutTarget).toEqual(expect.objectContaining({
            longitude: 2.75,
            latitude:  48.75,
            altitude:  120,
        }))
        expect(sceneManager.getJourneyCentroid).toHaveBeenCalledTimes(1)
    })

    it('zoomin starts high and descends to the replay altitude', async () => {
        vi.useFakeTimers()
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        journey.replay = {
            start: [],
            stop:  [],
        }
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        const flyToCalls = []
        const setViewCalls = []
        const zoomInDefinition = {
            id:           'zoom-in',
            label:        'ZoomIn',
            slots:        ['start'],
            maxInstances: 1,
            defaults:     {
                duration: 1,
                altitude: 900,
                pitch:    -35,
            },
            fields:       [],
        }
        const zoomIn = createJourneyReplayClipInstance(zoomInDefinition, 'start', {
            params: {
                duration: 1,
                altitude: 900,
                pitch:    -35,
            },
        })
        journey.replay.start = [zoomIn]

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            canvas:     {
                clientWidth:         1000,
                clientHeight:        1000,
                addEventListener:    () => {
                },
                removeEventListener: () => {
                },
            },
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        clips: {
                            catalog: {
                                'zoom-in': zoomInDefinition,
                            },
                            start: [],
                            stop:  [],
                        },
                    },
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                      clips:  {
                                          catalog: {
                                              'zoom-in': zoomInDefinition,
                                          },
                                          start: [],
                                          stop:  [],
                                      },
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                canvas:        {
                    clientWidth:         1000,
                    clientHeight:        1000,
                    addEventListener:    () => {
                    },
                    removeEventListener: () => {
                    },
                },
                camera:        {
                    heading:              0.8,
                    pitch:                -Math.PI / 4,
                    roll:                 0,
                    positionCartographic: {
                        longitude: 2,
                        latitude:  48,
                        height:    1800,
                    },
                    moveStart:            {
                        addEventListener:       () => {
                        }, removeEventListener: () => {
                        },
                    },
                    moveEnd:              {
                        addEventListener:       () => {
                        }, removeEventListener: () => {
                        },
                    },
                    cancelFlight:         () => {
                    },
                    flyTo:                options => flyToCalls.push(options),
                    setView:              options => setViewCalls.push(options),
                    lookAtTransform:      () => {
                    },
                },
            },
            scene:      {
                requestRender: () => {
                },
                globe:         {getHeight: () => 120},
            },
        }

        try {
            const mode = new JourneyReplayMode({
                                                controller: new JourneyReplayPlaybackController({
                                                                                                 requestFrame: () => 1,
                                                                                                 cancelFrame:  () => {
                                                                                                 },
                                                                                                 now:          () => 0,
                                                                                             }),
                                                renderer:   {
                                                    clear:  () => {
                                                    },
                                                    show:   () => {
                                                    },
                                                    update: () => {
                                                    },
                                                },
                                            })

            mode.start({duration: 1})
            await Promise.resolve()
            await vi.advanceTimersByTimeAsync(3000)
            await Promise.resolve()

            const target = {
                longitude: 2,
                latitude:  48,
                altitude:  120,
            }
            const targetCartesian = Cartesian3.fromDegrees(target.longitude, target.latitude, target.altitude)
            const targetTransform = Transforms.eastNorthUpToFixedFrame(targetCartesian)
            const east = Matrix4.getColumn(targetTransform, 0, new Cartesian3())
            const north = Matrix4.getColumn(targetTransform, 1, new Cartesian3())
            const delta = Cartesian3.subtract(flyToCalls[0].destination, targetCartesian, new Cartesian3())

            expect(flyToCalls).toHaveLength(1)
            expect(setViewCalls).toHaveLength(1)
            expect(flyToCalls[0].maximumHeight).toBe(1800)
            expect(Cartesian3.dot(delta, east)).toBeCloseTo(0, 6)
            expect(Cartesian3.dot(delta, north)).toBeLessThan(0)
        }
        finally {
            vi.useRealTimers()
            globalThis.lgs = previousLgs
        }
    })

    it('does not recenter the camera when pausing an active replay', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        const flyToCalls = []

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            canvas:     {
                clientWidth:            1000, clientHeight: 1000, addEventListener: () => {
                }, removeEventListener: () => {
                },
            },
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        marker: {
                            ...replay.marker,
                            mode: REPLAY_MARKER_MODE_HYSTERESIS,
                        },
                    },
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                canvas:        {clientWidth: 1000, clientHeight: 1000},
                camera:        {
                    heading:              0.4,
                    pitch:                -0.7,
                    roll:                 0,
                    positionCartographic: {longitude: 0.1, latitude: 0.2, height: 3456},
                    moveStart:            {
                        addEventListener:       () => {
                        }, removeEventListener: () => {
                        },
                    },
                    moveEnd:              {
                        addEventListener:       () => {
                        }, removeEventListener: () => {
                        },
                    },
                    cancelFlight:         () => {
                    },
                    lookAtTransform:      () => {
                    },
                    flyTo:                options => flyToCalls.push(options),
                    setView:              () => {
                    },
                },
            },
            scene:      {
                cartesianToCanvasCoordinates: () => ({x: 990, y: 990}),
                requestRender:                () => {
                },
                globe:                        {getHeight: () => 120},
            },
        }

        try {
            const mode = new JourneyReplayMode({
                                                controller: new JourneyReplayPlaybackController({
                                                                                                 requestFrame: () => 1,
                                                                                                 cancelFrame:  () => {
                                                                                                 },
                                                                                                 now:          () => 0,
                                                                                             }),
                                                renderer:   {
                                                    clear:  () => {
                                                    },
                                                    show:   () => {
                                                    },
                                                    update: () => {
                                                    },
                                                },
                                            })
            mode.start()
            flyToCalls.length = 0
            mode.pause()

            expect(flyToCalls).toHaveLength(0)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('restores the captured camera altitude even when the start camera height is missing', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[0.1, 0.2, 120], [0.2, 0.3, 140]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const previousDoubleUnderscore = globalThis.__
        const replay = defaultJourneyReplaySettings()
        journey.visible = false
        journey.updateVisibility = vi.fn(visible => {
            journey.visible = visible
        })
        const setViewCalls = []
        const controller = new JourneyReplayPlaybackController({
            requestFrame: () => 1,
            cancelFrame:  () => {},
            now:          () => 0,
        })

        globalThis.__ = {
            ui: {
                cameraManager: {
                    stopRotate: vi.fn(async () => undefined),
                },
            },
        }
        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {
                ui: {
                    replay,
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                camera:        {
                    heading:              0.4,
                    pitch:                -0.7,
                    roll:                 0,
                    positionCartographic: {
                        longitude: 0.1,
                        latitude:  0.2,
                        height:    undefined,
                    },
                    moveStart:            {
                        addEventListener: () => {},
                        removeEventListener: () => {},
                    },
                    moveEnd:              {
                        addEventListener: () => {},
                        removeEventListener: () => {},
                    },
                    cancelFlight:         () => {},
                    flyTo:                () => {},
                    setView:              options => setViewCalls.push(options),
                    lookAtTransform:      () => {},
                },
            },
            scene:      {
                requestRender: () => {},
                globe:         {getHeight: () => 120},
            },
        }

        try {
            const mode = new JourneyReplayMode({
                controller,
                renderer: {
                    clear:  () => {},
                    show:   () => {},
                    update: () => {},
                },
            })

            mode.start({duration: 1})
            mode.stop({emit: false})

            expect(setViewCalls).toHaveLength(1)
            const restoredLongitude = (0.1 * 180) / Math.PI
            const restoredLatitude = (0.2 * 180) / Math.PI
            expect(Cartesian3.distance(
                setViewCalls[0].destination,
                Cartesian3.fromDegrees(restoredLongitude, restoredLatitude, 120),
            )).toBeLessThan(1)
            expect(journey.visible).toBe(true)
            expect(journey.updateVisibility).toHaveBeenCalledWith(true)
        }
        finally {
            globalThis.lgs = previousLgs
            globalThis.__ = previousDoubleUnderscore
        }
    })

    it('places the replay camera at the start sample when trace marker mode has no start clip', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const previousDoubleUnderscore = globalThis.__
        const replay = defaultJourneyReplaySettings()
        const staleMarkerPosition = {
            longitude: 8,
            latitude:  9,
            altitude:  999,
        }
        const setViewCalls = []

        globalThis.__ = {
            ui: {
                cameraManager: {
                    stopRotate: vi.fn(async () => undefined),
                },
            },
        }
        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        marker: {
                            ...replay.marker,
                            mode: REPLAY_MARKER_MODE_TRACE,
                            position: staleMarkerPosition,
                        },
                        clips: {
                            ...replay.clips,
                            start: [],
                        },
                    },
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                      marker:   {
                                          ...replay.marker,
                                          mode: REPLAY_MARKER_MODE_TRACE,
                                          position: staleMarkerPosition,
                                      },
                                      clips:    {
                                          ...replay.clips,
                                          start: [],
                                      },
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                camera:        {
                    heading:              1.1,
                    pitch:                -0.2,
                    roll:                 0,
                    positionCartographic: {longitude: 0.1, latitude: 0.2, height: 3456},
                    moveStart:            {
                        addEventListener:    () => {},
                        removeEventListener: () => {},
                    },
                    moveEnd:              {
                        addEventListener:    () => {},
                        removeEventListener: () => {},
                    },
                    cancelFlight:         () => {},
                    setView:              options => setViewCalls.push(options),
                    lookAtTransform:      () => {},
                },
            },
            scene:      {
                requestRender: () => {},
                globe:         {getHeight: () => 120},
            },
        }

        try {
            const mode = new JourneyReplayMode({
                controller: new JourneyReplayPlaybackController({
                    requestFrame: () => 1,
                    cancelFrame:  () => {},
                    now:          () => 0,
                }),
                renderer:   {
                    clear:  () => {},
                    show:   () => {},
                    update: () => {},
                },
            })

            mode.start({duration: 1})

            expect(setViewCalls).toHaveLength(1)
            expect(setViewCalls[0]).toEqual(expect.objectContaining({
                destination: expect.any(Cartesian3),
                orientation: expect.objectContaining({
                    direction: expect.any(Cartesian3),
                    up:        expect.any(Cartesian3),
                }),
            }))
            const destination = Cartographic.fromCartesian(setViewCalls[0].destination)
            expect(CesiumMath.toDegrees(destination.longitude)).toBeCloseTo(2, 1)
            expect(CesiumMath.toDegrees(destination.latitude)).toBeCloseTo(48, 1)
        }
        finally {
            globalThis.lgs = previousLgs
            globalThis.__ = previousDoubleUnderscore
        }
    })

    it('focuses the full journey when playback naturally ends', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const previousDoubleUnderscore = globalThis.__
        const focusCalls = []
        const frames = []
        let now = 0
        const rendererUpdate = vi.fn()
        const replay = defaultJourneyReplaySettings()
        journey.visible = false
        journey.updateVisibility = vi.fn(visible => {
            journey.visible = visible
        })
        journey.focus = props => focusCalls.push(props)

        globalThis.__ = {ui: {}}
        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {
                ui: {
                    camera: {start: {rotate: {journey: true}}},
                    replay,
                },
            },
            stores:     {
                replay: proxy({
                                      active:   false,
                                      playing:  false,
                                      paused:   false,
                                      progress: 0,
                                      camera:   replay.camera,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                camera:        {
                    heading:              0,
                    pitch:                -Math.PI / 4,
                    positionCartographic: {longitude: 0, latitude: 0, height: 1000},
                    moveStart:            {
                        addEventListener:       () => {
                        }, removeEventListener: () => {
                        },
                    },
                    moveEnd:              {
                        addEventListener:       () => {
                        }, removeEventListener: () => {
                        },
                    },
                    cancelFlight:         () => {
                    },
                },
            },
            scene:      {
                requestRender: () => {
                }, globe:      {},
            },
        }

        try {
            const mode = new JourneyReplayMode({
                                                controller: new JourneyReplayPlaybackController({
                                                                                                 requestFrame: callback => {
                                                                                                     frames.push(callback)
                                                                                                     return frames.length
                                                                                                 },
                                                                                                 cancelFrame:  () => {
                                                                                                 },
                                                                                                 now:          () => now,
                                                                                             }),
                                                renderer:   {
                                                    clear:  () => {
                                                    },
                                                    show:   () => {
                                                    },
                                                    update: rendererUpdate,
                                                },
                                            })
            mode.start({duration: 1})
            now = 1000
            frames.shift()()

            expect(focusCalls).toHaveLength(1)
            expect(journey.visible).toBe(true)
            expect(journey.updateVisibility).toHaveBeenCalledWith(true)
            expect(focusCalls[0]).toEqual(expect.objectContaining({
                                                                       resetCamera: true,
                                                                       rotate:      false,
                                                                       snapDistance: 50000,
                                                                   }))
            expect(rendererUpdate).toHaveBeenCalledWith(expect.objectContaining({
                freezeDynamic: true,
                hideCursor:    true,
            }))
        }
        finally {
            globalThis.lgs = previousLgs
            globalThis.__ = previousDoubleUnderscore
        }
    })

})
