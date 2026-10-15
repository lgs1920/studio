/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-camera-interaction-lifecycle.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-28
 * Last modified: 2026-10-15
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {Cartesian3} from 'cesium'
import {defaultJourneyReplaySettings, REPLAY_MARKER_MODE_HYSTERESIS} from '@Core/ui/replay/JourneyReplayProgressionStyle'
import {bindMarkerInteractions} from '@Core/ui/replay/JourneyReplayCameraBinding'
import {
    persistCameraSettings,
    updateCameraFromCesiumControls,
    updateCameraSettingsFromCesiumControls,
} from '@Core/ui/replay/JourneyReplayCameraState'
import {applyCameraFrame} from '@Core/ui/replay/JourneyReplayCameraTransition'
import {JOURNEY_REPLAY_INTERNAL_CALL, JOURNEY_REPLAY_INTERNAL_STATE} from '@Core/ui/replay/JourneyReplayInternal'
import {afterEach, describe, expect, it, vi} from 'vitest'

describe('JourneyReplay camera interaction lifecycle', () => {
    afterEach(() => {
        delete globalThis.lgs
    })

    it('ignores programmatic camera restore events after leaving Dynamic replay', () => {
        const replay = defaultJourneyReplaySettings()
        const cameraListeners = {}
        const camera = {
            changed: {
                addEventListener:    listener => {
                    cameraListeners.changed = listener
                },
                removeEventListener: vi.fn(),
            },
            moveStart: {
                addEventListener:    listener => {
                    cameraListeners.moveStart = listener
                },
                removeEventListener: vi.fn(),
            },
            moveEnd: {
                addEventListener:    listener => {
                    cameraListeners.moveEnd = listener
                },
                removeEventListener: vi.fn(),
            },
        }
        const scene = {canvas: null}
        const refreshCamera = vi.fn()
        const call = {
            cesiumScene:                () => scene,
            now:                        () => 0,
            startCameraLiveSyncLoop:    vi.fn(),
            stopCameraLiveSyncLoop:     vi.fn(),
            updateCameraFromCesiumControls: vi.fn(),
        }
        const state = {
            cameraAutoTrackingIgnoreUntil: 0,
            cameraApplyingView:            false,
            cameraFlightActive:             false,
            cameraManualInteractionTimer:  null,
            cameraPointerActive:            false,
            cameraUserAdjusting:            false,
            suppressPlaybackCameraSync:     true,
            unbind:                         [],
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_CALL]:  call,
            [JOURNEY_REPLAY_INTERNAL_STATE]: state,
            refreshCamera,
        }

        globalThis.lgs = {
            settings: {
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
            viewer: {camera},
        }

        bindMarkerInteractions(mode)
        cameraListeners.moveStart()
        cameraListeners.moveEnd()

        expect(state.suppressPlaybackCameraSync).toBe(true)
        expect(state.cameraUserAdjusting).toBe(false)
        expect(call.startCameraLiveSyncLoop).not.toHaveBeenCalled()
        expect(call.updateCameraFromCesiumControls).not.toHaveBeenCalled()
        expect(refreshCamera).not.toHaveBeenCalled()
    })

    it('synchronizes manual Expert camera settings with the journey replay configuration', () => {
        const previousLgs = globalThis.lgs
        const persistToDatabase = vi.fn()
        const camera = {...defaultJourneyReplaySettings().camera, altitude: 900, pitch: -60, positionMode: 'behind'}
        const journey = {
            replay: {expert: {camera}},
            persistToDatabase,
        }
        globalThis.lgs = {
            settings: {
                ui: {
                    replay: {
                        ...defaultJourneyReplaySettings(),
                        userMode: 'expert',
                        camera,
                    },
                },
            },
            stores: {replay: {camera}},
            theJourney: journey,
        }
        vi.useFakeTimers()

        try {
            const next = persistCameraSettings({
                [JOURNEY_REPLAY_INTERNAL_CALL]: {},
                [JOURNEY_REPLAY_INTERNAL_STATE]: {},
            }, {altitude: 2200, pitch: -36})

            expect(next).toMatchObject({altitude: 2200, pitch: -36})
            expect(journey.replay.expert.camera).toMatchObject({altitude: 2200, pitch: -36})

            vi.advanceTimersByTime(250)
            expect(persistToDatabase).toHaveBeenCalledOnce()
        } finally {
            vi.useRealTimers()
            if (previousLgs === undefined) {
                delete globalThis.lgs
            } else {
                globalThis.lgs = previousLgs
            }
        }
    })

    it('persists a departure pan that settles just after pointer release', async () => {
        vi.useFakeTimers()
        const listeners = {}
        const screenPositions = {x: 500, y: 500}
        let persistedReplay = null
        const journey = {
            replay: {simple: {startPosition: {x: 0.5, y: 0.5}}},
            persistToDatabase: vi.fn(async function () {
                persistedReplay = JSON.parse(JSON.stringify(this.replay))
            }),
        }
        const camera = {
            changed: {addEventListener: vi.fn(), removeEventListener: vi.fn()},
            moveStart: {addEventListener: listener => { listeners.moveStart = listener }, removeEventListener: vi.fn()},
            moveEnd: {addEventListener: listener => { listeners.moveEnd = listener }, removeEventListener: vi.fn()},
            pitch: -30 * Math.PI / 180,
            positionCartographic: {height: 1800},
        }
        const canvas = {
            addEventListener: (name, listener) => { listeners[name] = listener },
            removeEventListener: vi.fn(),
        }
        const state = {
            cameraAutoTrackingIgnoreUntil: 0,
            cameraApplyingView: false,
            cameraFlightActive: false,
            cameraManualInteractionTimer: null,
            cameraPointerActive: false,
            cameraUserAdjusting: false,
            suppressPlaybackCameraSync: false,
            replayPreparationSample: {longitude: 2, latitude: 48, altitude: 120},
            unbind: [],
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_CALL]: {
                now: () => 0,
                startCameraLiveSyncLoop: vi.fn(),
                stopCameraLiveSyncLoop: vi.fn(),
                updateCameraFromCesiumControls: vi.fn(),
                trackingWindowPositionForSample: () => ({...screenPositions}),
                viewportRectForCesiumSurface: () => ({width: 1000, height: 1000}),
            },
            [JOURNEY_REPLAY_INTERNAL_STATE]: state,
        }
        globalThis.lgs = {
            settings: {ui: {replay: {...defaultJourneyReplaySettings(), userMode: 'basic'}}},
            stores: {
                main: {theJourney: journey},
                replay: {active: false, playing: false, paused: false},
                ui: {video: {editing: true}},
            },
            viewer: {camera, canvas},
            theJourney: journey,
        }

        try {
            bindMarkerInteractions(mode)
            listeners.pointerdown()
            listeners.pointerup()
            setTimeout(() => {
                screenPositions.x = 720
                screenPositions.y = 340
                camera.pitch = -31 * Math.PI / 180
                camera.positionCartographic.height = 1802
            }, 50)
            await vi.advanceTimersByTimeAsync(360)

            expect(journey.replay.simple.startPosition).toEqual({x: 0.72, y: 0.34})
            expect(journey.persistToDatabase).toHaveBeenCalledOnce()
            expect(persistedReplay.simple.startPosition).toEqual({x: 0.72, y: 0.34})
            expect(state.preparationCameraGesturePromise).toBeNull()
        }
        finally {
            state.unbind.forEach(unbind => unbind())
            vi.useRealTimers()
        }
    })

    it('persists the Basic camera angle relative to the replay trace', () => {
        const settings = defaultJourneyReplaySettings()
        const camera = {...settings.camera, cameraAngle: 180}
        const persistToDatabase = vi.fn()
        const journey = {
            replay: {simple: {camera: {...camera, cameraAngle: 168}}},
            persistToDatabase,
        }
        settings.userMode = 'basic'
        settings.simple = {camera}
        globalThis.lgs = {
            settings: {ui: {replay: settings}},
            stores: {replay: {camera}},
            theJourney: journey,
        }
        vi.useFakeTimers()

        try {
            const next = persistCameraSettings({
                [JOURNEY_REPLAY_INTERNAL_CALL]: {},
                [JOURNEY_REPLAY_INTERNAL_STATE]: {},
            }, {cameraAngle: 32})

            expect(next).toMatchObject({cameraAngle: 32})
            expect(globalThis.lgs.settings.ui.replay.simple.camera.cameraAngle).toBe(0)
            expect(globalThis.lgs.settings.ui.replay.simple.camera).not.toHaveProperty('altitude')
            expect(globalThis.lgs.settings.ui.replay.simple.camera).not.toHaveProperty('pitch')
            expect(journey.replay.simple.camera).toMatchObject({
                cameraAngle: 32,
            })
            expect(globalThis.lgs.stores.replay.camera).toMatchObject({cameraAngle: 32})
            vi.advanceTimersByTime(250)
            expect(persistToDatabase).toHaveBeenCalledOnce()
        }
        finally {
            vi.useRealTimers()
        }
    })

    it('persists explicit preparation tilt and zoom while preserving the Replay angle', () => {
        const settings = defaultJourneyReplaySettings()
        const persistSettings = vi.fn()
        const syncCamera = vi.fn()
        globalThis.lgs = {
            settings: {ui: {replay: settings}},
            stores: {
                replay: {camera: settings.camera, cameraUpdateSource: null},
                ui: {video: {editing: true}},
            },
            viewer: {
                camera: {
                    pitch: -30 * Math.PI / 180,
                    positionCartographic: {height: 1800},
                },
            },
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_CALL]: {
                persistCameraSettings: persistSettings,
            },
            [JOURNEY_REPLAY_INTERNAL_STATE]: {
                cameraApplyingView: false,
                cameraFlightActive: false,
                cameraPointerActive: true,
                cameraUserAdjusting: true,
                preparationPointerPitch: -5 * Math.PI / 180,
                preparationPointerHeight: 539,
                suppressPlaybackCameraSync: false,
            },
            syncCameraFromCesiumControls: syncCamera,
        }

        expect(updateCameraSettingsFromCesiumControls(mode, {longitude: 2, latitude: 48, progress: 0})).toBeNull()
        updateCameraFromCesiumControls(mode, {userInteraction: true})

        expect(persistSettings).toHaveBeenCalledOnce()
        expect(persistSettings).toHaveBeenCalledWith(expect.objectContaining({
            altitude: 1800,
            pitch: -30,
            cameraAngle: settings.camera.cameraAngle,
        }), {journey: null})
        expect(syncCamera).not.toHaveBeenCalled()
    })

    it('stores prepared ground-offset zoom relative to the rendered Replay target', () => {
        const settings = defaultJourneyReplaySettings()
        settings.simple = {camera: {...settings.camera, altitudeMode: 'ground-offset'}}
        const persistSettings = vi.fn()
        const sample = {longitude: 2, latitude: 48}
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_CALL]: {
                markerRenderHeightForSample: () => 1290,
                persistCameraSettings: persistSettings,
            },
            [JOURNEY_REPLAY_INTERNAL_STATE]: {
                cameraApplyingView: false,
                cameraFlightActive: false,
                cameraPointerActive: false,
                cameraUserAdjusting: true,
                preparationPointerPitch: -38 * Math.PI / 180,
                preparationPointerHeight: 900,
                replayPreparationSample: sample,
            },
        }
        globalThis.lgs = {
            settings: {ui: {replay: settings}},
            stores: {
                replay: {camera: settings.simple.camera, simplePreparationActive: true},
                ui: {video: {editing: true}},
            },
            viewer: {camera: {
                pitch: -38 * Math.PI / 180,
                positionCartographic: {height: 1800},
            }},
        }

        updateCameraFromCesiumControls(mode)

        expect(persistSettings).toHaveBeenCalledWith(expect.objectContaining({
            altitude: 510,
            altitudeMode: 'ground-offset',
            cameraAngle: settings.camera.cameraAngle,
            pitch: settings.simple.camera.pitch,
        }), {journey: null})
    })

    it('does not persist explicit-looking gestures outside video preparation', () => {
        const persistSettings = vi.fn()
        globalThis.lgs = {
            settings: {ui: {replay: defaultJourneyReplaySettings()}},
            stores: {replay: {}, ui: {video: {editing: false}}},
            viewer: {camera: {pitch: -30 * Math.PI / 180, positionCartographic: {height: 1800}}},
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_CALL]: {persistCameraSettings: persistSettings},
            [JOURNEY_REPLAY_INTERNAL_STATE]: {
                cameraApplyingView: false,
                cameraFlightActive: false,
                cameraPointerActive: true,
                cameraUserAdjusting: true,
                preparationPointerPitch: -5 * Math.PI / 180,
                preparationPointerHeight: 539,
            },
        }

        updateCameraFromCesiumControls(mode)

        expect(persistSettings).not.toHaveBeenCalled()
    })

    it('ignores unauthorised Cesium move events once replay is inactive', () => {
        const replay = defaultJourneyReplaySettings()
        const cameraListeners = {}
        const camera = {
            changed: {
                addEventListener:    listener => {
                    cameraListeners.changed = listener
                },
                removeEventListener: vi.fn(),
            },
            moveStart: {
                addEventListener:    listener => {
                    cameraListeners.moveStart = listener
                },
                removeEventListener: vi.fn(),
            },
            moveEnd: {
                addEventListener:    listener => {
                    cameraListeners.moveEnd = listener
                },
                removeEventListener: vi.fn(),
            },
        }
        const scene = {canvas: null}
        const refreshCamera = vi.fn()
        const call = {
            cesiumScene:                   () => scene,
            now:                           () => 0,
            startCameraLiveSyncLoop:       vi.fn(),
            stopCameraLiveSyncLoop:        vi.fn(),
            updateCameraFromCesiumControls: vi.fn(),
        }
        const state = {
            cameraAutoTrackingIgnoreUntil: 0,
            cameraApplyingView:            false,
            cameraFlightActive:             false,
            cameraManualInteractionTimer:  null,
            cameraPointerActive:            false,
            cameraUserAdjusting:            false,
            suppressPlaybackCameraSync:     false,
            unbind:                         [],
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_CALL]:  call,
            [JOURNEY_REPLAY_INTERNAL_STATE]: state,
            refreshCamera,
        }

        globalThis.lgs = {
            settings: {
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
            stores: {
                replay: {
                    active:            false,
                    clipSequenceActive: false,
                    marker:            {mode: REPLAY_MARKER_MODE_HYSTERESIS},
                },
            },
            viewer: {camera},
        }

        bindMarkerInteractions(mode)
        cameraListeners.moveStart()
        cameraListeners.moveEnd()

        expect(call.updateCameraFromCesiumControls).not.toHaveBeenCalled()
        expect(refreshCamera).not.toHaveBeenCalled()
    })

    it('protects an automatically applied frame from delayed Cesium synchronization', () => {
        const setView = vi.fn()
        const exportSetView = vi.fn()
        const call = {
            now: () => 1000,
        }
        const state = {
            cameraApplyingView:            false,
            cameraAutoTrackingIgnoreUntil: 0,
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_CALL]:  call,
            [JOURNEY_REPLAY_INTERNAL_STATE]: state,
        }
        globalThis.lgs = {
            camera: {
                setView,
            },
            viewer: {
                camera: {setView: exportSetView},
            },
        }

        const applied = applyCameraFrame(mode, {
            destination: new Cartesian3(1, 2, 3),
            direction:   new Cartesian3(0, 1, 0),
            up:          new Cartesian3(0, 0, 1),
        })

        expect(applied).toBe(true)
        expect(setView).toHaveBeenCalledOnce()
        expect(exportSetView).not.toHaveBeenCalled()
        expect(state.cameraAutoTrackingIgnoreUntil).toBe(1250)
        expect(state.cameraApplyingView).toBe(false)
    })

    it('does not persist an automatic correction as a user camera setting', () => {
        const markPlaybackCameraUserAdjusted = vi.fn()
        const syncCameraFromCesiumControls = vi.fn()
        const call = {
            markPlaybackCameraUserAdjusted,
            now: () => 1100,
        }
        const state = {
            cameraApplyingView:            false,
            cameraAutoTrackingIgnoreUntil: 1250,
            cameraPointerActive:            false,
            suppressPlaybackCameraSync:     false,
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_CALL]:  call,
            [JOURNEY_REPLAY_INTERNAL_STATE]: state,
            syncCameraFromCesiumControls,
        }
        globalThis.lgs = {
            stores: {
                replay: {
                    cameraUpdateSource: null,
                },
            },
        }

        updateCameraFromCesiumControls(mode)

        expect(markPlaybackCameraUserAdjusted).not.toHaveBeenCalled()
        expect(syncCameraFromCesiumControls).not.toHaveBeenCalled()

        updateCameraFromCesiumControls(mode, {userInteraction: true})

        expect(markPlaybackCameraUserAdjusted).not.toHaveBeenCalled()
        expect(syncCameraFromCesiumControls).not.toHaveBeenCalled()
    })

    it('keeps mouse navigation outside prepared keyboard settings', () => {
        const syncCameraFromCesiumControls = vi.fn()
        const call = {
            markPlaybackCameraUserAdjusted: vi.fn(),
            now: () => 2000,
        }
        const state = {
            cameraApplyingView:            false,
            cameraAutoTrackingIgnoreUntil: 0,
            cameraPointerActive:            true,
            cameraUserAdjusting:            true,
            suppressPlaybackCameraSync:     false,
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_CALL]:  call,
            [JOURNEY_REPLAY_INTERNAL_STATE]: state,
            syncCameraFromCesiumControls,
        }
        globalThis.lgs = {
            stores: {
                replay: {
                    cameraUpdateSource: 'keyboard',
                },
            },
        }

        updateCameraFromCesiumControls(mode)

        expect(globalThis.lgs.stores.replay.cameraUpdateSource).toBe('keyboard')
        expect(syncCameraFromCesiumControls).not.toHaveBeenCalled()
    })

    it('does not accumulate repeated automatic pitch offsets into the nominal setting', () => {
        let now = 1000
        const camera = {
            pitch: -11 * Math.PI / 180,
            setView: vi.fn(),
        }
        const call = {
            markPlaybackCameraUserAdjusted: vi.fn(),
            now: () => now,
        }
        const state = {
            cameraApplyingView:            false,
            cameraAutoTrackingIgnoreUntil: 0,
            cameraPointerActive:            false,
            suppressPlaybackCameraSync:     false,
        }
        const syncCameraFromCesiumControls = vi.fn(() => {
            globalThis.lgs.settings.ui.replay.camera.pitch = camera.pitch * 180 / Math.PI
        })
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_CALL]:  call,
            [JOURNEY_REPLAY_INTERNAL_STATE]: state,
            syncCameraFromCesiumControls,
        }
        globalThis.lgs = {
            settings: {
                ui: {
                    replay: {
                        camera: {pitch: -11},
                    },
                },
            },
            stores: {
                replay: {
                    cameraUpdateSource: null,
                },
            },
            viewer: {camera},
        }
        const frame = {
            destination: new Cartesian3(1, 2, 3),
            direction:   new Cartesian3(0, 1, 0),
            up:          new Cartesian3(0, 0, 1),
        }

        for (const correctedPitchDegrees of [-15, -19, -23]) {
            applyCameraFrame(mode, frame)
            camera.pitch = correctedPitchDegrees * Math.PI / 180
            now += 10
            updateCameraFromCesiumControls(mode)
            now += 300
        }
        updateCameraFromCesiumControls(mode)

        expect(syncCameraFromCesiumControls).not.toHaveBeenCalled()
        expect(globalThis.lgs.settings.ui.replay.camera.pitch).toBe(-11)
    })
})
