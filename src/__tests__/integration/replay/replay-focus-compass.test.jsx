/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-focus-compass.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-05
 * Last modified: 2026-11-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {act, cleanup, render} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {Camera, Cartesian3, Ellipsoid, GeographicProjection, SceneMode} from 'cesium'
import {proxy} from 'valtio'
import {Compass} from '@Components/MainUI/compass/Compass'
import {COMPASS_FULL} from '@Core/constants'
import {interpolateReplayExportSample, sampleJourneyReplayClipCameraPlan} from '@Core/ui/replay/JourneyReplayClipController'
import {buildReplayFrameState, publishReplayClipFrameState} from '@Core/ui/replay/JourneyReplayRuntime'
import {publishReplayFrameState, REPLAY_FRAME_PUBLICATION_TARGET_EXPORT} from '@Core/ui/replay/ReplayFramePublisher'
import {renderReplayWidgetFrames} from '@Core/ui/replay/ReplayWidgetFrameRenderers'
import {JOURNEY_REPLAY_INTERNAL_CALL, JOURNEY_REPLAY_INTERNAL_STATE} from '@Core/ui/replay/JourneyReplayInternal'
import {JourneyReplayMode} from '@Core/ui/replay/JourneyReplayMode'
import {JourneyReplayPlaybackController} from '@Core/ui/replay/JourneyReplayPlaybackController'
import {defaultJourneyReplaySettings} from '@Core/ui/replay/JourneyReplayProgressionStyle'
import {createBasicReplayTraceFocusClips} from '@Core/ui/replay/JourneyReplayBasicFocus'
import {REPLAY_CLIP_SLOT_STOP} from '@Core/ui/replay/JourneyReplayClips'
import {makeJourney, makeTrack} from '../../unit/replay/replay-phase1-fixtures'

const WIDGET_ID = 'compass-widget#focus'

/** Mount the real compass against a real Cesium camera and a controlled browser frame scheduler. */
const mountFocusCompass = ({exporting = false} = {}) => {
    const callbacks = new Map()
    let nextFrameId = 0
    vi.stubGlobal('requestAnimationFrame', callback => {
        nextFrameId += 1
        callbacks.set(nextFrameId, callback)
        return nextFrameId
    })
    vi.stubGlobal('cancelAnimationFrame', id => callbacks.delete(id))
    const scene = {
        mode: SceneMode.SCENE3D,
        mapProjection: new GeographicProjection(Ellipsoid.WGS84),
        ellipsoid: Ellipsoid.WGS84,
        drawingBufferWidth: 1000,
        drawingBufferHeight: 800,
    }
    const camera = new Camera(scene)
    camera.update(SceneMode.SCENE3D)
    camera.setView({
        destination: Cartesian3.fromDegrees(2, 48, 5000),
        orientation: {heading: 0.2, pitch: -0.8, roll: 0},
    })
    const $replay = proxy({
        active: false,
        playing: false,
        paused: false,
        clipSequenceActive: true,
        deferredExportPlan: {runtime: {status: exporting ? 'exporting' : 'idle'}},
    })
    vi.stubGlobal('lgs', {
        camera,
        settings: {
            ui: {compass: proxy({mode: COMPASS_FULL})},
            widgets: {'compass-widget': {configuration: proxy({default: {mode: COMPASS_FULL}})}},
        },
        stores: {replay: $replay, ui: {video: {exporting: false}}},
    })
    const mode = {[JOURNEY_REPLAY_INTERNAL_STATE]: {}, [JOURNEY_REPLAY_INTERNAL_CALL]: {}}
    mode[JOURNEY_REPLAY_INTERNAL_CALL].interpolateReplayExportSample = (...args) => interpolateReplayExportSample(mode, ...args)
    const sample = {longitude: 2, latitude: 48, altitude: 120}
    const plan = {
        kind: 'focus', duration: 5, rpm: 12,
        startView: {sample, heading: 0.2, pitch: -0.8, height: 5000},
        endView: {sample, heading: 0.2, pitch: -0.8, height: 7000},
    }
    const view = render(<Compass inWidget entity={WIDGET_ID} syncBounds={false}/>)
    lgs.stores.ui.video.exporting = exporting
    const rotatingPart = view.container.querySelector('svg > g')

    /** Apply one production focus pose and publish it through the matching Replay boundary. */
    const publishFocus = timeMs => {
        const pose = sampleJourneyReplayClipCameraPlan(mode, plan, {localMillis: timeMs, localProgress: timeMs / 5000})
        camera.setView({
            destination: Cartesian3.fromDegrees(2, 48, pose.height),
            orientation: {heading: pose.heading, pitch: pose.pitch, roll: 0},
        })
        const phase = {kind: 'stop', clipId: 'focus', localMillis: timeMs, frameTimeMs: timeMs}
        if (exporting) {
            return publishReplayFrameState({
                replay: $replay,
                plan: $replay.deferredExportPlan,
                target: REPLAY_FRAME_PUBLICATION_TARGET_EXPORT,
                frameState: buildReplayFrameState({active: true, phase, cameraPose: pose, renderMode: 'export'}),
                intentOptions: {resolved: true},
            })
        }
        publishReplayClipFrameState({store: $replay, slot: 'stop', phase, cameraPose: pose, intentResolved: true})
        return $replay.dynamicFrameState
    }

    /** Execute exactly one browser frame without advancing the Replay clock implicitly. */
    const advanceFrame = timestamp => {
        const pending = [...callbacks.values()]
        callbacks.clear()
        act(() => pending.forEach(callback => callback(timestamp)))
    }
    return {camera, scene, rotatingPart, publishFocus, advanceFrame, callbacks, unmount: view.unmount}
}

/** Read the displayed clockwise SVG angle in degrees. */
const readCompassAngle = element => Number(element.style.transform.match(/rotate\(([^)]+)deg\)/)?.[1])

/** Resolve the expected compass bearing for the focus's one-turn-per-five-seconds orbit. */
const focusCompassAngle = timeMs => ((-(0.2 + timeMs / 5000 * Math.PI * 2) * 180 / Math.PI) % 360 + 360) % 360

afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('Replay focus compass', () => {
    it.each([false, true])('publishes the moving focus pose through the production export boundary with dryRun=%s', async dryRun => {
        const {camera, scene, rotatingPart, advanceFrame} = mountFocusCompass({exporting: true})
        scene.requestRender = vi.fn()
        scene.globe = {getHeight: () => 120}
        const settings = defaultJourneyReplaySettings()
        settings.userMode = 'basic'
        settings.camera = {...settings.camera, altitude: 5000, pitch: -45, cameraAngle: 0, debug: false}
        settings.basic = {...settings.basic, camera: {...settings.camera}}
        const journey = makeJourney([makeTrack({slug: 'track#focus#gpx#main', coordinates: [[2, 48, 120], [2.01, 48.01, 120]]})])
        journey.replay = {basic: {camera: {...settings.camera}}}
        Object.assign(lgs, {scene, viewer: {camera, scene, canvas: document.createElement('canvas')}, theJourney: journey})
        lgs.settings.ui.replay = settings
        lgs.settings.ui.journeyToolbar = {show: true}
        lgs.stores.main = {theJourney: journey, components: {camera: {target: {}, position: {}}}}
        Object.assign(lgs.stores.replay, {camera: settings.camera, userMode: 'basic', basicPreparationActive: true})
        vi.stubGlobal('__', {ui: {cameraManager: {stopRotate: vi.fn()}, drawerManager: {isCurrent: () => false}}})
        const controller = new JourneyReplayPlaybackController()
        const mode = new JourneyReplayMode({controller, renderer: {clear: vi.fn(), show: vi.fn(), update: vi.fn()}})
        try {
            mode.beginReplayCameraExport()
            await mode.preparePlaybackSceneForExport({journey})
            mode.configure({duration: 1})
            await mode.renderReplayExportFrame({phase: {kind: 'replay', progress: 1}, frame: {frameTimeMs: 1000}, dryRun})
            const clip = createBasicReplayTraceFocusClips(settings.camera, {enabled: true, duration: 5}).stop[0]
            const headings = []
            for (const localMillis of [0, 1000, 2500, 4000, 5000]) {
                const phase = {
                    kind: REPLAY_CLIP_SLOT_STOP, slot: REPLAY_CLIP_SLOT_STOP, clip,
                    progress: 1, anchorProgress: 1, startMillis: 1000, endMillis: 6000,
                    localMillis, localProgress: localMillis / 5000, frameTimeMs: 1000 + localMillis,
                }
                await mode.renderReplayExportFrame({phase, frame: {frameTimeMs: phase.frameTimeMs, frameIntervalMs: 100}, dryRun})
                const logicalFrame = mode.lastReplayLogicalFrame
                expect(logicalFrame.phase.kind).toBe(REPLAY_CLIP_SLOT_STOP)
                expect(logicalFrame.frameTimeMs).toBe(1000 + localMillis)
                expect(logicalFrame.poiCameraFreeze).toBe(false)
                headings.push(logicalFrame.cameraPose.heading)
                const frameState = publishReplayFrameState({
                    plan: lgs.stores.replay.deferredExportPlan,
                    target: REPLAY_FRAME_PUBLICATION_TARGET_EXPORT,
                    frameState: buildReplayFrameState({renderMode: 'export', cameraPose: logicalFrame.cameraPose, phase}),
                    intentOptions: {logicalFrame, resolved: true},
                })
                if (dryRun) advanceFrame(phase.frameTimeMs)
                else await renderReplayWidgetFrames({widgetKeys: [WIDGET_ID], frameState})
                const expectedAngle = ((-logicalFrame.cameraPose.heading * 180 / Math.PI) % 360 + 360) % 360
                expect(readCompassAngle(rotatingPart)).toBeCloseTo(expectedAngle, 7)
            }
            expect(headings[1] - headings[0]).toBeCloseTo(2 * Math.PI / 5, 7)
            expect(headings.at(-1) - headings[0]).toBeCloseTo(2 * Math.PI, 7)
        }
        finally {
            mode.endReplayCameraExport()
            mode.dispose()
            await mode.waitForSceneRestore()
        }
    })

    it('follows the stop focus after route playback has ended', () => {
        const {rotatingPart, publishFocus, advanceFrame} = mountFocusCompass()
        for (const timeMs of [0, 1000, 2500, 4000, 5000]) {
            publishFocus(timeMs)
            advanceFrame(timeMs)
            expect(readCompassAngle(rotatingPart)).toBeCloseTo(focusCompassAngle(timeMs), 7)
        }
    })

    it('follows the displayed camera when the interactive focus publication is stale', () => {
        const {camera, rotatingPart, publishFocus, advanceFrame} = mountFocusCompass()
        publishFocus(0)
        lgs.stores.replay.dynamicFrameState.renderContract.logicalFrame.poiCameraFreeze = true
        camera.setView({orientation: {heading: 1.2, pitch: -0.8, roll: 0}})
        advanceFrame(1000)
        expect(readCompassAngle(rotatingPart)).toBeCloseTo(360 - 1.2 * 180 / Math.PI, 7)
    })

    it('follows published focus frames during Dry run without invoking widget capture', () => {
        const {rotatingPart, publishFocus, advanceFrame} = mountFocusCompass({exporting: true})
        for (const timeMs of [0, 1000, 2500, 4000, 5000]) {
            publishFocus(timeMs)
            advanceFrame(timeMs)
            expect(readCompassAngle(rotatingPart)).toBeCloseTo(focusCompassAngle(timeMs), 7)
        }
    })

    it('applies each supplied capture frame before capture without a browser animation frame', async () => {
        const {rotatingPart, publishFocus} = mountFocusCompass({exporting: true})
        for (const timeMs of [0, 1000, 2500, 4000, 5000]) {
            const frameState = publishFocus(timeMs)
            // Capture owns its supplied frame even when the live scene/store has moved on.
            publishFocus(0)
            await renderReplayWidgetFrames({widgetKeys: [WIDGET_ID], frameState})
            expect(readCompassAngle(rotatingPart)).toBeCloseTo(focusCompassAngle(timeMs), 7)
        }
    })

    it('cancels the mounted compass animation loop on unmount', () => {
        const {callbacks, unmount} = mountFocusCompass()
        expect(callbacks.size).toBe(1)
        unmount()
        expect(callbacks.size).toBe(0)
    })
})
