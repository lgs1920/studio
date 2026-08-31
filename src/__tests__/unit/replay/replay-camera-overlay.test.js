/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-camera-overlay.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-28
 * Last modified: 2026-08-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultJourneyReplaySettings } from '@Core/ui/replay/JourneyReplayProgressionStyle'
import { JOURNEY_REPLAY_INTERNAL_CALL, JOURNEY_REPLAY_INTERNAL_STATE } from '@Core/ui/replay/JourneyReplayInternal'
import { updateToleranceZoneOverlay } from '@Core/ui/replay/JourneyReplayCameraOverlay'
import { isReplayVideoLinked } from '@Core/ui/replay/JourneyReplayClipController'
import { preparePlaybackSceneForExport } from '@Core/ui/replay/JourneyReplaySessionPlaybackController'

vi.hoisted(() => {
    if (!Object.getOwnPropertyDescriptor(document, 'adoptedStyleSheets')) {
        Object.defineProperty(document, 'adoptedStyleSheets', {
            configurable: true,
            get: () => [],
            set: () => {},
        })
    }
})

const createDrawingContext = () => ({
    arcTo:      vi.fn(),
    beginPath:  vi.fn(),
    clearRect:  vi.fn(),
    closePath:  vi.fn(),
    fill:       vi.fn(),
    fillText:   vi.fn(),
    measureText: vi.fn(() => ({width: 100})),
    moveTo:     vi.fn(),
    restore:    vi.fn(),
    save:       vi.fn(),
    setLineDash: vi.fn(),
    setTransform: vi.fn(),
    stroke:     vi.fn(),
})

afterEach(() => {
    document.querySelectorAll('[data-replay-video-overlay-canvas="true"], .replay-tolerance-zone-overlay').forEach(element => element.remove())
    globalThis.lgs = undefined
})

describe('replay camera diagnostics overlay', () => {
    it('reports a video link only when replay-video sync is enabled', () => {
        globalThis.lgs = {
            settings: {ui: {replay: {recordingSync: false}}},
            stores:   {replay: {recordingSync: false}},
        }

        expect(isReplayVideoLinked()).toBe(false)

        globalThis.lgs.stores.replay.recordingSync = true

        expect(isReplayVideoLinked()).toBe(true)
    })

    it('keeps one visible diagnostics canvas while camera updates redraw it', () => {
        const settings = defaultJourneyReplaySettings()
        settings.camera.debug = true
        const container = document.createElement('div')
        document.body.appendChild(container)
        const drawingContext = createDrawingContext()
        const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(drawingContext)
        const cameraChanged = {
            addEventListener:    vi.fn(),
            removeEventListener: vi.fn(),
        }
        const camera = {
            changed:              cameraChanged,
            heading:              0.4,
            pitch:                -0.7,
            roll:                 0,
            positionCartographic: {height: 2400},
        }
        const state = {
            lastToleranceZoneHysteresis:   null,
            toleranceZoneOverlay:          null,
            toleranceZoneOverlayCanvas:    null,
            toleranceZoneOverlayVisible:   true,
            toleranceZoneOverlayCameraChangedRemove: null,
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: state,
            [JOURNEY_REPLAY_INTERNAL_CALL]: {
                viewportRectForCesiumSurface: () => ({left: 0, top: 0, width: 1000, height: 800}),
            },
        }
        globalThis.lgs = {
            settings: {ui: {replay: settings}},
            stores:   {
                replay: {
                    recordingSync:     true,
                    dynamicFrameState: {phase: {kind: 'start', clip: {clipId: 'zoom-in'}}},
                },
            },
            viewer:   {
                camera,
                container,
                scene: {canvas: {clientWidth: 1000}},
            },
        }

        updateToleranceZoneOverlay(mode, settings.camera.hysteresis)
        const canvas = state.toleranceZoneOverlayCanvas

        updateToleranceZoneOverlay(mode, settings.camera.hysteresis)

        expect(state.toleranceZoneOverlayCanvas).toBe(canvas)
        expect(canvas.isConnected).toBe(true)
        expect(canvas.hidden).toBe(false)
        expect(canvas.style.display).toBe('')
        expect(canvas.style.visibility).toBe('visible')
        expect(cameraChanged.addEventListener).toHaveBeenCalledOnce()
        expect(drawingContext.clearRect).toHaveBeenCalledTimes(2)
        expect(drawingContext.fillText.mock.calls.map(([label]) => label)).toContain('Phase  Clip: zoom-in')

        globalThis.lgs.stores.replay.dynamicFrameState.phase = {kind: 'replay', clip: null}
        updateToleranceZoneOverlay(mode, settings.camera.hysteresis)

        expect(drawingContext.fillText.mock.calls.map(([label]) => label)).toContain('Phase  Replay')

        cameraChanged.addEventListener.mock.calls[0][0]()

        expect(drawingContext.clearRect).toHaveBeenCalledTimes(4)

        getContext.mockRestore()
    })

    it('does not mount linked diagnostics when debug camera is disabled', () => {
        const settings = defaultJourneyReplaySettings()
        const container = document.createElement('div')
        document.body.appendChild(container)
        const state = {
            lastToleranceZoneHysteresis:   null,
            toleranceZoneOverlay:          null,
            toleranceZoneOverlayCanvas:    null,
            toleranceZoneOverlayVisible:   true,
            toleranceZoneOverlayCameraChangedRemove: null,
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: state,
            [JOURNEY_REPLAY_INTERNAL_CALL]: {
                viewportRectForCesiumSurface: () => ({left: 0, top: 0, width: 1000, height: 800}),
            },
        }
        globalThis.lgs = {
            settings: {ui: {replay: settings}},
            stores:   {replay: {recordingSync: true}},
            viewer:   {container},
        }

        updateToleranceZoneOverlay(mode, settings.camera.hysteresis)

        expect(state.toleranceZoneOverlayVisible).toBe(false)
        expect(state.toleranceZoneOverlayCanvas).toBeNull()
        expect(container.querySelector('.replay-tolerance-zone-overlay')).toBeNull()
    })

    it('restores linked diagnostics visibility when preparing the HQ scene', async () => {
        const settings = defaultJourneyReplaySettings()
        settings.camera.debug = true
        const setVisible = vi.fn()
        const updateOverlay = vi.fn()
        const sample = {progress: 0}
        const journey = {
            visible: false,
            updateVisibility: vi.fn(),
        }
        const state = {
            controller: {progress: 0},
            renderer: {
                show: vi.fn(),
            },
            sampler: null,
            savedCameraState: null,
            replayEntryCameraState: null,
        }
        const call = {
            bindCesiumCameraBridge: vi.fn(),
            configure: vi.fn(() => ({
                atProgress: vi.fn(() => sample),
                hasSamples: true,
            })),
            resetCameraInterpolationState: vi.fn(),
            clipListForSlot: vi.fn(() => []),
            captureCameraState: vi.fn(),
            captureJourneyReplayDrawerStateBeforePlayback: vi.fn(),
            capturePlaybackCameraSettings: vi.fn(),
            placeCameraAtPlaybackStart: vi.fn(),
            smoothedGuide: vi.fn(() => null),
            setJourneyReplayOrbitAllowed: vi.fn(),
            restoreOtherJourneysVisibility: vi.fn(),
            hideCurrentJourneyVisibility: vi.fn(),
            hideOtherJourneysVisibility: vi.fn(),
            prepareNearbyPOIsForPlayback: vi.fn(),
            hideMainUI: vi.fn(),
            isReplayVideoLinked: vi.fn(() => true),
            setToleranceZoneOverlayVisible: setVisible,
            updateToleranceZoneOverlay: updateOverlay,
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: state,
            [JOURNEY_REPLAY_INTERNAL_CALL]: call,
        }
        globalThis.lgs = {
            settings: {ui: {replay: settings}},
            stores: {replay: {recordingSync: true}},
            scene: {requestRender: vi.fn()},
        }

        await preparePlaybackSceneForExport(mode, {
            journey,
            hideOtherJourneys: false,
        })

        expect(setVisible).toHaveBeenCalledWith(true)
        expect(updateOverlay).toHaveBeenCalledWith(settings.camera.hysteresis)
    })
})
