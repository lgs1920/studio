/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-camera-real-lifecycle.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-10
 * Last modified: 2026-10-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, describe, expect, it, vi} from 'vitest'
import {Camera, Cartesian3, Ellipsoid, Event, GeographicProjection, HeadingPitchRange, Matrix4, SceneMode, Transforms} from 'cesium'
import {proxy} from 'valtio'
import {JourneyReplayMode} from '@Core/ui/replay/JourneyReplayMode'
import {applyCameraView} from '@Core/ui/replay/JourneyReplayCameraState'
import {JourneyReplayPlaybackController} from '@Core/ui/replay/JourneyReplayPlaybackController'
import {prepareReplayDeferredExportPlan} from '@Core/ui/replay/ReplayDeferredExporter'
import {resolveReplayVideoFramePhase} from '@Core/ui/replay/ReplayVideoTimeline'
import {isCameraOwnedByReplay} from '@Core/ui/replay/ReplayCameraOwnership'
import {resolveJourneyReplayCameraAngleGuide} from '@Core/ui/replay/JourneyReplayCameraAngleGuide'
import {defaultJourneyReplaySettings} from '@Core/ui/replay/JourneyReplayProgressionStyle'
import {JOURNEY_REPLAY_INTERNAL_CALL, JOURNEY_REPLAY_INTERNAL_STATE} from '@Core/ui/replay/JourneyReplayInternal'
import {makeJourney, makeTrack} from '../../unit/replay/replay-phase1-fixtures'
import {
    projectReplayTargetInCameraFrame,
    replayAngularDelta,
    replayCameraHeadingForAngle,
} from '@Core/ui/replay/JourneyReplayCameraMath'

/** Read the actual Cesium basis and reference frame, excluding mutable aliases. */
const readPose = camera => ({
    position: Cartesian3.clone(camera.positionWC),
    direction: Cartesian3.clone(camera.directionWC),
    up: Cartesian3.clone(camera.upWC),
    transform: Matrix4.clone(camera.transform),
})

/** Assert a physical camera pose rather than the arguments passed to a mock. */
const expectPose = (camera, expected) => {
    expect(Cartesian3.distance(camera.positionWC, expected.position)).toBeLessThan(0.00001)
    expect(Cartesian3.distance(camera.directionWC, expected.direction)).toBeLessThan(1e-10)
    expect(Cartesian3.distance(camera.upWC, expected.up)).toBeLessThan(1e-10)
    expect(Matrix4.equalsEpsilon(camera.transform, expected.transform, 1e-10)).toBe(true)
}

/** Resolve a camera's local heading at a target position. */
const directionHeadingAt = (camera, target) => {
    const local = Matrix4.inverseTransformation(Transforms.eastNorthUpToFixedFrame(target), new Matrix4())
    const direction = Matrix4.multiplyByPointAsVector(local, camera.directionWC, new Cartesian3())
    return Math.atan2(direction.x, direction.y)
}

/** Install a real Cesium camera with only the rendering surface stubbed. */
const installScene = ({userMode = 'expert', terrainHeight = 120, pitch = -38, altitude = 1600, cameraAngle = 65, journeyCameraSaved = true} = {}) => {
    const settings = defaultJourneyReplaySettings()
    settings.userMode = userMode
    settings.camera = {...settings.camera, altitude, pitch, cameraAngle, debug: false}
    settings.clips = {...settings.clips, start: [], stop: []}
    const scene = {
        mode: SceneMode.SCENE3D,
        mapProjection: new GeographicProjection(Ellipsoid.WGS84),
        ellipsoid: Ellipsoid.WGS84,
        drawingBufferWidth: 1000,
        drawingBufferHeight: 800,
        requestRender: vi.fn(),
        postRender: new Event(),
        globe: {getHeight: () => terrainHeight},
    }
    const camera = new Camera(scene)
    camera.update(SceneMode.SCENE3D)
    camera.lookAtTransform(
        Transforms.eastNorthUpToFixedFrame(Cartesian3.fromDegrees(5.8, 45.8, 120)),
        new HeadingPitchRange(0.9, -0.5, 8000),
    )
    const journey = makeJourney([makeTrack({slug: 'track#journey#gpx#main', coordinates: [[2, 48, 120], [2.01, 48.01, 130]]})])
    if (userMode === 'basic') {
        settings.basic = {...settings.basic, camera: {...settings.camera}}
        journey.replay = {basic: journeyCameraSaved ? {camera: {...settings.camera}} : {}}
    } else {
        journey.replay = {expert: journeyCameraSaved ? {camera: {...settings.camera}} : {}}
    }
    const canvas = document.createElement('canvas')
    let elapsed = 0
    const frames = []
    const controller = new JourneyReplayPlaybackController({
        requestFrame: callback => { frames.push(callback)
            return frames.length },
        cancelFrame: () => {},
        now: () => elapsed,
    })
    vi.stubGlobal('lgs', {
        camera, scene, viewer: {camera, scene, canvas}, theJourney: journey,
        settings: {ui: {replay: settings, journeyToolbar: {show: true}}},
        stores: {
            main: {theJourney: journey, components: {camera: {target: {longitude: 5.8, latitude: 45.8, height: 120}, position: {}}}},
            replay: proxy({camera: settings.camera, progress: 0, userMode, basicPreparationActive: userMode === 'basic'}),
            ui: {video: {editing: true}},
        },
    })
    vi.stubGlobal('__', {ui: {cameraManager: {stopRotate: vi.fn()}, drawerManager: {isCurrent: () => false}}})
    const renderer = {clear: vi.fn(), show: vi.fn(), update: vi.fn()}
    const mode = new JourneyReplayMode({controller, renderer})
    return {camera, mode, settings, journey, controller, renderer, advance: milliseconds => {
        elapsed = milliseconds
        frames.shift()?.()
    }}
}

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('Replay with the real Cesium camera', () => {
    it.each(['basic', 'expert'])('applies joystick height and pitch during %s preparation and restores the original view', async userMode => {
        const {camera, mode, journey} = installScene({userMode, cameraAngle: 65})
        const normal = readPose(camera)
        try {
            expect(mode.updatePreparationCamera({altitude: 2400, pitch: -50})).toBeNull()
            await mode.enterReplayPreparation({journey})
            const prepared = readPose(camera)
            expect(mode.updatePreparationCamera({altitude: 2400, pitch: -50})).toMatchObject({
                altitude: 2400, pitch: -50, cameraAngle: 65,
            })
            expect(journey.replay[userMode].camera).toMatchObject({altitude: 2400, pitch: -50, cameraAngle: 65})
            expect(Cartesian3.distance(camera.positionWC, prepared.position)).toBeGreaterThan(100)
            const target = Cartesian3.fromDegrees(2, 48, 120)
            const local = Matrix4.inverseTransformation(Transforms.eastNorthUpToFixedFrame(target), new Matrix4())
            const direction = Matrix4.multiplyByPointAsVector(local, camera.directionWC, new Cartesian3())
            expect(Math.asin(direction.z)).toBeCloseTo(-50 * Math.PI / 180, 7)
            expect(isCameraOwnedByReplay(camera)).toBe(false)
            lgs.stores.ui.video.exporting = true
            expect(mode.updatePreparationCamera({altitude: 9999})).toBeNull()
            expect(journey.replay[userMode].camera.altitude).toBe(2400)
            lgs.stores.ui.video.exporting = false
            mode.leaveReplayPreparation()
            expectPose(camera, normal)
        }
        finally {
            mode.dispose()
            await mode.waitForSceneRestore()
        }
    })

    it.each([false, true])('applies each export frame once without the interactive listener with dryRun=%s', async dryRun => {
        const {camera, mode, journey, controller, renderer} = installScene()
        const returnPose = readPose(camera)
        try {
            mode.beginReplayCameraExport()
            lgs.stores.ui.video.exporting = true
            await mode.preparePlaybackSceneForExport({journey})
            mode.configure({duration: 1})
            const seek = vi.spyOn(controller, 'seek')
            const updateCamera = vi.spyOn(mode[JOURNEY_REPLAY_INTERNAL_CALL], 'updateCamera')
            const syncNearbyPOIs = vi.spyOn(mode[JOURNEY_REPLAY_INTERNAL_CALL], 'syncNearbyPOIsForSample')
            renderer.update.mockClear()
            const {exporter, plan} = prepareReplayDeferredExportPlan({
                replay: lgs.stores.replay,
                journey,
                controller,
                fps: 10,
                dimensions: {width: 320, height: 180},
                uiToast: {success: vi.fn()},
            })
            const samples = []
            await exporter.renderOnly({
                seekBeforeRender: false,
                renderFrame: async ({frame}) => {
                    const phase = resolveReplayVideoFramePhase({timeline: plan.videoTimeline, frame, isFinalSceneFrame: frame.isLast})
                    samples.push(await mode.renderReplayExportFrame({phase, frame, resolvedSample: frame.sample, dryRun}))
                },
            })

            expect(seek).toHaveBeenCalledTimes(exporter.timeline.frameCount)
            expect(renderer.update).toHaveBeenCalledTimes(exporter.timeline.frameCount)
            expect(updateCamera).toHaveBeenCalledTimes(exporter.timeline.frameCount)
            // Initial POI preparation may finish asynchronously, but export frames must not run scrub updates.
            expect(syncNearbyPOIs.mock.calls.filter(([sample]) => sample?.progress > 0)).toHaveLength(0)
            expect(samples[0].progress).toBe(0)
            expect(samples.at(-1).progress).toBe(1)
            expect(Number.isFinite(camera.positionCartographic.height)).toBe(true)
            if (!dryRun) {
                expect(renderer.update.mock.calls.every(([options]) => options.forceGeometry === true)).toBe(true)
            }
        }
        finally {
            mode.endReplayCameraExport()
            mode.dispose()
            await mode.waitForSceneRestore()
        }
        expectPose(camera, returnPose)
    })

    it.each([539, 3454, 7000])('contains the real marker in an offset crop during a ten-second Basic export at height %s', async altitude => {
        const {camera, mode, journey, settings} = installScene({userMode: 'basic', altitude, pitch: -30})
        const coordinates = Array.from({length: 21}, (_, index) => [2 + index * 0.02, 48 + Math.sin(index) * 0.02, 120])
        journey.tracks = new Map([['track#journey#gpx#main', makeTrack({slug: 'track#journey#gpx#main', coordinates})]])
        settings.basic.duration = 10
        settings.basic.camera.canFixHiddenMarker = false
        journey.replay.basic.camera.canFixHiddenMarker = false
        const viewport = {left: 180, top: 100, width: 640, height: 480, canvasWidth: 1000, canvasHeight: 800}
        camera.frustum.aspectRatio = 1.25
        mode[JOURNEY_REPLAY_INTERNAL_CALL].viewportRectForCesiumSurface = () => viewport
        try {
            mode.beginReplayCameraExport()
            lgs.stores.ui.video.exporting = true
            await mode.preparePlaybackSceneForExport({journey})
            for (let index = 0; index <= 300; index += 1) {
                const sample = await mode.renderReplayExportFrame({
                    phase: {kind: 'replay', progress: index / 300},
                    frame: {frameTimeMs: index * 1000 / 30, frameIntervalMs: 1000 / 30, isLast: index === 300},
                })
                const point = projectReplayTargetInCameraFrame({
                    frame: {destination: camera.positionWC, direction: camera.directionWC, up: camera.upWC},
                    target: mode[JOURNEY_REPLAY_INTERNAL_CALL].markerRenderCartesianForSample(sample),
                    viewport,
                    verticalFovRadians: camera.frustum.fovy,
                    aspectRatio: camera.frustum.aspectRatio,
                })
                expect(point).not.toBeNull()
                expect(point.x).toBeGreaterThanOrEqual(viewport.width * 0.2 - 1e-6)
                expect(point.x).toBeLessThanOrEqual(viewport.width * 0.8 + 1e-6)
                expect(point.y).toBeGreaterThanOrEqual(viewport.height * 0.2 - 1e-6)
                expect(point.y).toBeLessThanOrEqual(viewport.height * 0.8 + 1e-6)
            }
            expect(journey.replay.basic.camera.altitude).toBe(altitude)
            expect(journey.replay.basic.camera.pitch).toBe(-30)
        }
        finally {
            mode.endReplayCameraExport()
            mode.dispose()
            await mode.waitForSceneRestore()
        }
    })

    it('follows the route gently through turns without changing camera orientation, height, or zoom', async () => {
        const {camera, mode, journey, settings} = installScene({userMode: 'basic', altitude: 1600, pitch: -38})
        const slug = 'track#journey#gpx#main'
        journey.tracks = new Map([[
            slug,
            makeTrack({
                slug,
                coordinates: [
                    [2, 48, 120],
                    [2.0008, 48, 120],
                    [2.0008, 48.0008, 120],
                    [2.0016, 48.0008, 120],
                ],
            }),
        ]])
        settings.basic.duration = 12
        const replayViewport = {left: 0, top: 0, width: 10_000, height: 8_000, canvasWidth: 10_000, canvasHeight: 8_000}
        camera.frustum.aspectRatio = 1.25
        const replayCall = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        replayCall.viewportRectForCesiumSurface = () => replayViewport
        replayCall.cameraCollisionForFrame = () => null
        const applyCameraFrame = replayCall.applyCameraFrame
        const appliedNavigationFrames = []
        let activeProgress = 0
        replayCall.applyCameraFrame = frame => {
            const positionBefore = Cartesian3.clone(camera.positionWC)
            const directionBefore = Cartesian3.clone(camera.directionWC)
            const heightBefore = camera.positionCartographic.height
            const applied = applyCameraFrame(frame)
            if (activeProgress > 0) {
                appliedNavigationFrames.push({
                    destinationDelta: Cartesian3.distance(frame.destination, positionBefore),
                    positionDelta: Cartesian3.distance(camera.positionWC, positionBefore),
                    heightDelta: Math.abs(camera.positionCartographic.height - heightBefore),
                    orientationDelta: Cartesian3.angleBetween(frame.direction, directionBefore),
                })
            }
            return applied
        }
        mode.configure({duration: 12})
        const returnPose = readPose(camera)
        const replayDirections = []

        try {
            mode.beginReplayCameraExport()
            lgs.stores.ui.video.exporting = true
            await mode.preparePlaybackSceneForExport({journey})
            const replayFrustumFov = camera.frustum.fovy
            const replayStartPosition = Cartesian3.clone(camera.positionWC)

            for (let index = 0; index <= 346; index += 1) {
                const progress = index / 360
                activeProgress = progress
                await mode.renderReplayExportFrame({
                    phase: {kind: 'replay', progress},
                    frame: {
                        frameTimeMs: progress * 12_000,
                        frameIntervalMs: 1000 / 30,
                        isLast: false,
                    },
                })
                replayDirections.push(Cartesian3.clone(camera.directionWC))
            }

            const directionSteps = replayDirections.slice(1).map((direction, index) => (
                Cartesian3.angleBetween(replayDirections[index], direction)
            ))

            expect(appliedNavigationFrames.length).toBeGreaterThan(30)
            expect(Math.max(...appliedNavigationFrames.map(frame => frame.destinationDelta))).toBeGreaterThan(0.001)
            expect(Math.max(...appliedNavigationFrames.map(frame => frame.destinationDelta))).toBeLessThan(2)
            expect(Math.max(...appliedNavigationFrames.map(frame => frame.positionDelta))).toBeGreaterThan(0.001)
            expect(Math.max(...appliedNavigationFrames.map(frame => frame.positionDelta))).toBeLessThan(2)
            expect(Math.max(...appliedNavigationFrames.map(frame => frame.heightDelta))).toBeLessThan(0.02)
            expect(Math.max(...appliedNavigationFrames.map(frame => frame.orientationDelta))).toBeLessThan(0.02)
            expect(Cartesian3.distance(camera.positionWC, replayStartPosition)).toBeGreaterThan(0.1)
            expect(Math.max(...directionSteps)).toBeLessThan(1e-4)
            expect(camera.frustum.fovy).toBe(replayFrustumFov)
        }
        finally {
            mode.endReplayCameraExport()
            mode.dispose()
            await mode.waitForSceneRestore()
        }

        expectPose(camera, returnPose)
    })

    it.each(['basic', 'expert'])('seeds first %s Replay H/P from the live Cesium camera and starts at zero azimuth', async userMode => {
        const {camera, mode, journey, settings} = installScene({userMode, journeyCameraSaved: false})
        const cesiumHeight = camera.positionCartographic.height
        const cesiumPitch = camera.pitch * 180 / Math.PI
        const expectedPitch = Math.max(-89, Math.min(-5, Math.ceil(cesiumPitch)))
        const replayKey = userMode === 'basic' ? 'basic' : 'expert'
        settings.camera = {...settings.camera, altitude: 9000, pitch: -5, cameraAngle: 120}
        if (settings.basic) {
            settings.basic.camera = {...settings.basic.camera, altitude: 7000, pitch: -15, cameraAngle: 90}
        }

        try {
            mode.start({journey})

            expect(journey.replay[replayKey].camera).toMatchObject({
                altitude: Math.ceil(cesiumHeight),
                pitch: expectedPitch,
                cameraAngle: 0,
                altitudeMode: 'constant',
            })
            expect(lgs.stores.replay.camera).toMatchObject({
                altitude: Math.ceil(cesiumHeight),
                pitch: expectedPitch,
                cameraAngle: 0,
            })
            expect(settings.camera).not.toHaveProperty('altitude')
            expect(settings.camera).not.toHaveProperty('pitch')
            expect(settings.camera.cameraAngle).toBe(0)
            if (settings.basic) {
                expect(settings.basic.camera).not.toHaveProperty('altitude')
                expect(settings.basic.camera).not.toHaveProperty('pitch')
                expect(settings.basic.camera.cameraAngle).toBe(0)
            }
        }
        finally {
            mode.dispose()
            await mode.waitForSceneRestore()
        }
    })

    it.each(['constant', 'ground-offset'])('persists mouse-selected Basic camera settings before %s altitude export', async altitudeMode => {
        const {camera, mode, journey, settings} = installScene({userMode: 'basic', terrainHeight: 2969, altitude: 485, pitch: -45, cameraAngle: 65})
        settings.basic.camera.altitudeMode = altitudeMode
        journey.replay.basic.camera.altitudeMode = altitudeMode
        lgs.stores.replay.camera.altitudeMode = altitudeMode
        vi.useFakeTimers()
        try {
            await mode.enterReplayPreparation({journey})
            const canvas = lgs.viewer.canvas
            canvas.dispatchEvent(new MouseEvent('pointerdown', {bubbles: true}))
            camera.setView({destination: Cartesian3.fromDegrees(2, 47.995, 3454), orientation: {heading: 1.7, pitch: -Math.PI / 6, roll: 0}})
            canvas.dispatchEvent(new MouseEvent('pointerup', {bubbles: true}))
            const selectedAltitude = altitudeMode === 'constant' ? 3454 : 485
            camera.moveEnd.raiseEvent()
            expect(lgs.stores.replay.camera).toMatchObject({pitch: -30, altitude: selectedAltitude, altitudeMode, cameraAngle: 65})
            await mode.prepareReplayCamera()
            expect(journey.replay.basic.camera).toMatchObject({
                pitch: -30,
                altitude: selectedAltitude,
                altitudeMode,
                cameraAngle: 65,
            })
            await mode.preparePlaybackSceneForExport()
            expect(settings.camera).not.toHaveProperty('altitude')
            expect(settings.camera).not.toHaveProperty('pitch')
        }
        finally {
            mode.dispose()
            await mode.waitForSceneRestore()
            vi.useRealTimers()
        }
    })

    it.each(['constant', 'ground-offset'])('starts Basic playback from the latest mouse-selected camera (%s altitude)', async altitudeMode => {
        const {camera, mode, journey, settings} = installScene({userMode: 'basic', terrainHeight: 2969, altitude: 485, pitch: -45, cameraAngle: 65})
        settings.basic.camera.altitudeMode = altitudeMode
        journey.replay.basic.camera.altitudeMode = altitudeMode
        lgs.stores.replay.camera.altitudeMode = altitudeMode
        vi.useFakeTimers()
        try {
            await mode.enterReplayPreparation({journey})
            const canvas = lgs.viewer.canvas
            canvas.dispatchEvent(new MouseEvent('pointerdown', {bubbles: true}))
            camera.setView({destination: Cartesian3.fromDegrees(2, 47.995, 3454), orientation: {heading: 1.7, pitch: -Math.PI / 6, roll: 0}})
            canvas.dispatchEvent(new MouseEvent('pointerup', {bubbles: true}))
            const selectedAltitude = altitudeMode === 'constant' ? 3454 : 485
            camera.moveEnd.raiseEvent()
            expect(lgs.stores.replay.camera).toMatchObject({altitude: selectedAltitude, altitudeMode, pitch: -30, cameraAngle: 65})
            await mode.prepareReplayCamera()
            mode.start()

            const target = Cartesian3.fromDegrees(2, 48, 2969)
            const local = Matrix4.inverseTransformation(Transforms.eastNorthUpToFixedFrame(target), new Matrix4())
            const direction = Matrix4.multiplyByPointAsVector(local, camera.directionWC, new Cartesian3())
            const position = Matrix4.multiplyByPoint(local, camera.positionWC, new Cartesian3())
            expect(Math.asin(direction.z)).toBeCloseTo(-30 * Math.PI / 180, 8)
            expect(position.z).toBeCloseTo(3454 - 2969, 5)
            expect(journey.replay.basic.camera).toMatchObject({
                altitude: selectedAltitude,
                altitudeMode,
                pitch: -30,
                cameraAngle: 65,
            })
        }
        finally {
            mode.stop({emit: false})
            await mode.waitForSceneRestore()
            mode.dispose()
            await mode.waitForSceneRestore()
            vi.useRealTimers()
        }
    })

    it('flushes a pending mouse wheel zoom into Replay settings before Record', async () => {
        const {camera, mode, journey} = installScene({userMode: 'basic', pitch: -30, altitude: 485, cameraAngle: 65})
        vi.useFakeTimers()
        try {
            await mode.enterReplayPreparation({journey})
            lgs.viewer.canvas.dispatchEvent(new WheelEvent('wheel'))
            // Cesium applies wheel movement after dispatch, on the scene update.
            camera.setView({destination: Cartesian3.fromDegrees(2, 47.995, 3454), orientation: {heading: camera.heading, pitch: camera.pitch, roll: camera.roll}})
            const preparing = mode.prepareReplayCamera()
            camera.moveEnd.raiseEvent()
            await preparing
            expect(lgs.stores.replay.camera).toMatchObject({altitude: 3454, pitch: -30, cameraAngle: 65})
            expect(journey.replay.basic.camera).toMatchObject({altitude: 3454, pitch: -30, cameraAngle: 65})
        }
        finally {
            mode.dispose()
            await mode.waitForSceneRestore()
            vi.useRealTimers()
        }
    })

    it.each([
        ['basic', 'constant', 'wheel'], ['basic', 'ground-offset', 'wheel'],
        ['expert', 'constant', 'wheel'], ['expert', 'ground-offset', 'wheel'],
        ['basic', 'constant', 'drag'], ['basic', 'ground-offset', 'drag'],
        ['expert', 'constant', 'drag'], ['expert', 'ground-offset', 'drag'],
    ])('waits for the final inertial zoom before preparing %s Replay (%s, %s)', async (userMode, altitudeMode, gesture) => {
        const {camera, mode, journey, settings} = installScene({userMode, altitude: 539, pitch: -30})
        const replayKey = userMode === 'basic' ? 'basic' : 'expert'
        journey.replay[replayKey].camera.altitudeMode = altitudeMode
        const settingsCamera = userMode === 'basic' ? settings.basic.camera : settings.camera
        settingsCamera.altitudeMode = altitudeMode
        lgs.stores.replay.camera.altitudeMode = altitudeMode
        vi.useFakeTimers()
        try {
            await mode.enterReplayPreparation({journey})
            const canvas = lgs.viewer.canvas
            if (gesture === 'wheel') {
                canvas.dispatchEvent(new WheelEvent('wheel'))
            }
            else {
                canvas.dispatchEvent(new MouseEvent('pointerdown', {bubbles: true}))
            }
            camera.setView({destination: Cartesian3.fromDegrees(2, 47.995, 2630), orientation: {heading: camera.heading, pitch: camera.pitch, roll: camera.roll}})
            if (gesture === 'drag') {
                canvas.dispatchEvent(new MouseEvent('pointerup', {bubbles: true}))
                camera.setView({destination: Cartesian3.fromDegrees(2, 47.995, 2800), orientation: {heading: camera.heading, pitch: camera.pitch, roll: camera.roll}})
            }
            let prepared = false
            const preparation = mode.prepareReplayCamera().then(result => {
                prepared = true
                return result
            })

            await vi.advanceTimersByTimeAsync(120)
            expect(prepared).toBe(false)
            // Zoom inertia continues after the former fixed gesture timeout.
            camera.setView({destination: Cartesian3.fromDegrees(2, 47.995, 3515), orientation: {heading: camera.heading, pitch: camera.pitch, roll: camera.roll}})
            await vi.advanceTimersByTimeAsync(120)
            expect(prepared).toBe(false)
            await vi.advanceTimersByTimeAsync(120)
            expect(await preparation).toBe(true)
            expect(journey.replay[replayKey].camera).toMatchObject({
                altitude: altitudeMode === 'constant' ? 3515 : 3395,
                altitudeMode,
                pitch: -30,
                cameraAngle: 65,
            })
        }
        finally {
            mode.dispose()
            await mode.waitForSceneRestore()
            vi.useRealTimers()
        }
    })

    it.each(['basic', 'expert'])('starts %s playback only after the preparation zoom settles', async userMode => {
        const {camera, mode, journey, controller} = installScene({userMode, altitude: 539, pitch: -30})
        const replayKey = userMode === 'basic' ? 'basic' : 'expert'
        vi.useFakeTimers()
        try {
            await mode.enterReplayPreparation({journey})
            lgs.viewer.canvas.dispatchEvent(new WheelEvent('wheel'))
            camera.setView({destination: Cartesian3.fromDegrees(2, 47.995, 2630), orientation: {heading: camera.heading, pitch: camera.pitch, roll: camera.roll}})
            const starting = mode.start({journey})
            expect(controller.playing).toBe(false)
            await vi.advanceTimersByTimeAsync(120)
            expect(controller.playing).toBe(false)
            camera.setView({destination: Cartesian3.fromDegrees(2, 47.995, 3515), orientation: {heading: camera.heading, pitch: camera.pitch, roll: camera.roll}})
            await vi.advanceTimersByTimeAsync(240)
            expect(await starting).not.toBeNull()
            expect(controller.playing).toBe(true)
            // The target-local camera frame adds a small ellipsoid-curvature
            // difference, but must not reuse the previous 539 m zoom.
            expect(Math.abs(camera.positionCartographic.height - 3515)).toBeLessThan(5)
            expect(journey.replay[replayKey].camera.altitude).toBe(3515)
        }
        finally {
            mode.dispose()
            await mode.waitForSceneRestore()
            vi.useRealTimers()
        }
    })

    it.each(['basic', 'expert'])('cancels pending %s zoom preparation and startup before restoring the map', async userMode => {
        const {camera, mode, journey, controller} = installScene({userMode, altitude: 539, pitch: -30})
        const replayKey = userMode === 'basic' ? 'basic' : 'expert'
        vi.useFakeTimers()
        try {
            await mode.enterReplayPreparation({journey})
            lgs.viewer.canvas.dispatchEvent(new WheelEvent('wheel'))
            const preparing = mode.prepareReplayCamera({journey})
            const starting = mode.start({journey})
            mode.stop({emit: false})
            expect(await preparing).toBe(false)
            expect(await starting).toBeNull()
            await mode.waitForSceneRestore()
            camera.setView({destination: Cartesian3.fromDegrees(2, 47.995, 9000)})
            await vi.advanceTimersByTimeAsync(360)
            expect(controller.playing).toBe(false)
            expect(journey.replay[replayKey].camera.altitude).toBe(539)
            expect(mode[JOURNEY_REPLAY_INTERNAL_STATE].preparationCameraGesturePromise).toBeNull()
        }
        finally {
            mode.dispose()
            await mode.waitForSceneRestore()
            vi.useRealTimers()
        }
    })

    it.each([
        ['basic', 'stop', true], ['basic', 'error', true],
        ['expert', 'stop', true], ['expert', 'error', true],
        ['basic', 'stop', false], ['basic', 'error', false],
        ['expert', 'stop', false], ['expert', 'error', false],
    ])('keeps the latest Journey zoom when %s Replay exits through %s (Journey changed: %s)', async (userMode, terminal, changeJourney) => {
        const {mode, journey, renderer, controller} = installScene({userMode, altitude: 539, pitch: -5})
        const replayKey = userMode === 'basic' ? 'basic' : 'expert'
        lgs.stores.replay.basicPreparationActive = false
        lgs.stores.ui.video.editing = false
        const selectedJourney = changeJourney
            ? makeJourney([makeTrack({slug: 'track#selected#gpx#main', coordinates: [[3, 49, 120], [3.01, 49.01, 130]]})])
            : journey
        if (changeJourney) {
            selectedJourney.slug = 'selected#gpx'
        }
        const savedCamera = {...journey.replay[replayKey].camera, altitude: 3454, pitch: -30}
        try {
            mode.start({journey})
            // A newer Journey configuration can arrive before terminal cleanup,
            // even after the preparation UI has switched to recording.
            selectedJourney.replay = {[replayKey]: {camera: savedCamera}}
            lgs.theJourney = selectedJourney
            lgs.stores.main.theJourney = selectedJourney
            lgs.stores.replay.cameraUserAdjusted = true
            if (terminal === 'error') {
                renderer.update.mockImplementationOnce(() => { throw new Error('Rendering failed') })
                mode.seek(0.2)
            }
            else {
                mode.stop({emit: false})
            }
            await mode.waitForSceneRestore()

            expect(controller.playing).toBe(false)
            expect(selectedJourney.replay[replayKey].camera).toMatchObject({altitude: 3454, pitch: -30})
            if (changeJourney) {
                expect(journey.replay[replayKey].camera).toMatchObject({altitude: 539, pitch: -5})
            }
            expect(lgs.stores.replay.camera).toMatchObject({altitude: 3454, pitch: -30})
        }
        finally {
            mode.dispose()
            await mode.waitForSceneRestore()
        }
    })

    it.each([
        ['basic', 'playback'], ['basic', 'export'],
        ['expert', 'playback'], ['expert', 'export'],
    ])('uses explicit preparation mouse tilt in %s %s Replay camera settings', async (userMode, entry) => {
        const {camera, mode, journey, settings} = installScene({userMode, pitch: -5, altitude: 2630, cameraAngle: 65})
        vi.useFakeTimers()
        try {
            await mode.enterReplayPreparation({journey})
            const preparedPose = readPose(camera)
            const canvas = lgs.viewer.canvas
            canvas.dispatchEvent(new MouseEvent('pointerdown', {bubbles: true}))
            camera.setView({orientation: {heading: 1.7, pitch: -Math.PI / 4, roll: 0}})
            // Release is the public input boundary. Do not depend on the camera's
            // changed threshold or wait for the delayed live-sync frame.
            canvas.dispatchEvent(new MouseEvent('pointerup', {bubbles: true}))
            expect(lgs.stores.replay.camera).toMatchObject({pitch: -45, altitude: 2630, cameraAngle: 65})
            camera.moveEnd.raiseEvent()
            expect(Cartesian3.distance(camera.directionWC, preparedPose.direction)).toBeGreaterThan(0.1)
            const manualPreparationPose = readPose(camera)
            await mode.prepareReplayCamera()
            if (entry === 'playback') {
                mode.start()
            }
            else {
                await mode.preparePlaybackSceneForExport()
            }
            const target = Cartesian3.fromDegrees(2, 48, 120)
            const local = Matrix4.inverseTransformation(Transforms.eastNorthUpToFixedFrame(target), new Matrix4())
            const direction = Matrix4.multiplyByPointAsVector(local, camera.directionWC, new Cartesian3())
            expect(Math.asin(direction.z)).toBeCloseTo(-45 * Math.PI / 180, 8)
            mode.stop()
            await mode.waitForSceneRestore()
            expectPose(camera, manualPreparationPose)
        }
        finally {
            mode.dispose()
            await mode.waitForSceneRestore()
            vi.useRealTimers()
        }
    })

    it('ignores automatic and post-preparation Cesium gestures but persists intentional preparation gestures', async () => {
        const {camera, mode, journey} = installScene({userMode: 'basic', pitch: -5, altitude: 2630, cameraAngle: 65})
        vi.useFakeTimers()
        try {
            await mode.enterReplayPreparation({journey})
            camera.setView({orientation: {heading: 1, pitch: -Math.PI / 3, roll: 0}})
            camera.changed.raiseEvent()
            expect(lgs.stores.replay.camera.pitch).toBe(-5)
            const canvas = lgs.viewer.canvas
            canvas.dispatchEvent(new MouseEvent('pointerdown', {bubbles: true}))
            camera.setView({orientation: {heading: 1.7, pitch: -Math.PI / 4, roll: 0}})
            camera.changed.raiseEvent()
            canvas.dispatchEvent(new MouseEvent('pointerup', {bubbles: true}))
            expect(lgs.stores.replay.camera).toMatchObject({pitch: -45, altitude: 2630, cameraAngle: 65})
            vi.advanceTimersByTime(120)
            expect(lgs.stores.replay.camera.pitch).toBe(-45)
            lgs.stores.ui.video.editing = false
            canvas.dispatchEvent(new MouseEvent('pointerdown', {bubbles: true}))
            camera.setView({orientation: {heading: 1.7, pitch: -Math.PI / 4, roll: 0}})
            camera.changed.raiseEvent()
            canvas.dispatchEvent(new MouseEvent('pointerup', {bubbles: true}))
            expect(lgs.stores.replay.camera.pitch).toBe(-45)
        }
        finally {
            mode.dispose()
            await mode.waitForSceneRestore()
            vi.useRealTimers()
        }
    })

    it.each(['playback', 'export'])('preserves the prepared -45 degree pitch above terrain during %s entry', async entry => {
        const {camera, mode, journey, settings} = installScene({userMode: 'basic', terrainHeight: 1180, altitude: 539, pitch: -45, cameraAngle: -112})
        const normal = readPose(camera)
        try {
            await mode.prepareReplayCamera()
            if (entry === 'playback') {
                mode.start()
            }
            else {
                await mode.preparePlaybackSceneForExport()
            }
            const target = Cartesian3.fromDegrees(2, 48, 1180)
            const local = Matrix4.inverseTransformation(Transforms.eastNorthUpToFixedFrame(target), new Matrix4())
            const direction = Matrix4.multiplyByPointAsVector(local, camera.directionWC, new Cartesian3())
            const guide = resolveJourneyReplayCameraAngleGuide({journey, camera: journey.replay.basic.camera})
            expect(Math.atan2(direction.x, direction.y)).toBeCloseTo(Math.atan2(Math.sin(guide.cameraHeading), Math.cos(guide.cameraHeading)), 4)
            expect(Math.asin(direction.z)).toBeCloseTo(-Math.PI / 4, 8)
            expect(Cartesian3.distance(camera.positionWC, target)).toBeLessThan(10)
            expect(lgs.stores.replay.camera).toMatchObject({pitch: -45, altitude: 539, cameraAngle: -112})
            if (entry === 'playback') {
                mode[JOURNEY_REPLAY_INTERNAL_STATE].lastNavigationRecenterProgress = 0.8
                await mode.seek(0.5)
                expect(mode[JOURNEY_REPLAY_INTERNAL_STATE].lastNavigationRecenterProgress).toBeNull()
                const sample = lgs.stores.replay.sample
                const cameraAnchor = mode.lastReplayLogicalFrame?.cameraPose?.cameraAnchorSample ?? sample
                const trackedTarget = Cartesian3.fromDegrees(cameraAnchor.longitude, cameraAnchor.latitude, 1180)
                const trackedLocal = Matrix4.inverseTransformation(Transforms.eastNorthUpToFixedFrame(trackedTarget), new Matrix4())
                const trackedDirection = Matrix4.multiplyByPointAsVector(trackedLocal, camera.directionWC, new Cartesian3())
                expect(Math.asin(trackedDirection.z)).toBeCloseTo(-Math.PI / 4, 8)
                expect(Cartesian3.distance(camera.positionWC, trackedTarget)).toBeLessThan(10)
            }
            mode.stop()
            await mode.waitForSceneRestore()
            expectPose(camera, normal)
        }
        finally {
            mode.dispose()
            await mode.waitForSceneRestore()
        }
    })

    it.each(['basic', 'expert'])('stops the orbit and aligns the departure view with the route during %s preparation', async userMode => {
        const {camera, mode, journey, settings} = installScene({userMode, pitch: -23, altitude: 2630})
        const normal = readPose(camera)
        let finishRotation
        const rotationStopped = new Promise(resolve => { finishRotation = resolve })
        const stopRotate = vi.fn(() => rotationStopped)
        __.ui.cameraManager.stopRotate = stopRotate
        try {
            const preparing = mode.enterReplayPreparation({journey})
            expect(stopRotate).toHaveBeenCalledOnce()
            expectPose(camera, normal)
            finishRotation()
            await expect(preparing).resolves.toBe(true)
            const cameraSettings = userMode === 'basic' ? journey.replay.basic.camera : journey.replay.expert.camera
            const guide = resolveJourneyReplayCameraAngleGuide({journey, camera: cameraSettings})
            const departure = Cartesian3.fromDegrees(guide.anchor.longitude, guide.anchor.latitude, 120)
            const departureFrame = Matrix4.inverseTransformation(Transforms.eastNorthUpToFixedFrame(departure), new Matrix4())
            const preparedDirection = Matrix4.multiplyByPointAsVector(departureFrame, camera.directionWC, new Cartesian3())
            const preparedPosition = Matrix4.multiplyByPoint(departureFrame, camera.positionWC, new Cartesian3())
            expect(Math.atan2(preparedDirection.x, preparedDirection.y)).toBeCloseTo(Math.atan2(Math.sin(guide.cameraHeading), Math.cos(guide.cameraHeading)), 4)
            expect(Math.asin(preparedDirection.z)).toBeCloseTo(-23 * Math.PI / 180, 8)
            expect(preparedPosition.z).toBeCloseTo(2630 - 120, 5)
            const towardDeparture = Cartesian3.normalize(Cartesian3.subtract(departure, camera.positionWC, new Cartesian3()), new Cartesian3())
            expect(Cartesian3.distance(towardDeparture, camera.directionWC)).toBeLessThan(1e-10)
            expect(lgs.stores.replay.camera).toMatchObject({altitude: 2630, pitch: -23})
            const preparedNormal = readPose(camera)
            expect(isCameraOwnedByReplay(camera)).toBe(false)
            mode.start()
            expect(isCameraOwnedByReplay(camera)).toBe(true)
            const target = Cartesian3.fromDegrees(2, 48, 120)
            const local = Matrix4.inverseTransformation(Transforms.eastNorthUpToFixedFrame(target), new Matrix4())
            const direction = Matrix4.multiplyByPointAsVector(local, camera.directionWC, new Cartesian3())
            expect(Math.asin(direction.z)).toBeCloseTo(-23 * Math.PI / 180, 8)
            expect(userMode === 'basic' ? journey.replay.basic.camera.pitch : journey.replay.expert.camera.pitch).toBe(-23)
            await mode.seek(0.75)
            expect(lgs.stores.replay.sample.progress).toBeCloseTo(0.75)
            mode.stop()
            await mode.waitForSceneRestore()
            expectPose(camera, preparedNormal)
            expect(isCameraOwnedByReplay(camera)).toBe(false)
            expect(mode.leaveReplayPreparation()).toBe(true)
            expectPose(camera, normal)
        }
        finally {
            finishRotation()
            mode.dispose()
            await mode.waitForSceneRestore()
        }
    })

    it('restores the original map camera when leaving preparation before playback', async () => {
        const {camera, mode, journey} = installScene()
        const normal = readPose(camera)
        try {
            await expect(mode.enterReplayPreparation({journey})).resolves.toBe(true)
            expect(Cartesian3.distance(camera.positionWC, normal.position)).toBeGreaterThan(1000)
            expect(isCameraOwnedByReplay(camera)).toBe(false)
            expect(mode.leaveReplayPreparation()).toBe(true)
            expectPose(camera, normal)
        }
        finally {
            mode.dispose()
            await mode.waitForSceneRestore()
        }
    })

    it('keeps map navigation intact when drawer refreshes and timeline seeks during preparation', async () => {
        const {camera, mode} = installScene()
        const normal = readPose(camera)
        try {
            await mode.prepareReplayCamera()
            expectPose(camera, normal)
            mode.refresh()
            expectPose(camera, normal)
            mode.refreshCamera({source: 'drawer'})
            expectPose(camera, normal)
            mode.seek(0.6)
            expectPose(camera, normal)
        }
        finally {
            mode.dispose()
            await mode.waitForSceneRestore()
        }
    })

    it.each(['basic', 'expert'])('keeps the route-aligned preparation view identical to the first %s Replay view', async userMode => {
        const {camera, mode, settings, journey} = installScene({userMode})
        try {
            await mode.enterReplayPreparation({journey})
            const cameraSettings = userMode === 'basic' ? journey.replay.basic.camera : journey.replay.expert.camera
            const guide = resolveJourneyReplayCameraAngleGuide({journey, camera: cameraSettings})
            const preparedPose = readPose(camera)
            mode.start()
            expectPose(camera, preparedPose)
            const target = Cartesian3.fromDegrees(guide.anchor.longitude, guide.anchor.latitude, 120)
            const local = Matrix4.inverseTransformation(Transforms.eastNorthUpToFixedFrame(target), new Matrix4())
            const direction = Matrix4.multiplyByPointAsVector(local, camera.directionWC, new Cartesian3())
            const position = Matrix4.multiplyByPoint(local, camera.positionWC, new Cartesian3())
            expect(Math.atan2(direction.x, direction.y)).toBeCloseTo(Math.atan2(Math.sin(guide.cameraHeading), Math.cos(guide.cameraHeading)), 4)
            expect(Math.asin(direction.z)).toBeCloseTo(cameraSettings.pitch * Math.PI / 180, 8)
            expect(position.z).toBeCloseTo(cameraSettings.altitude - 120, 5)
        }
        finally {
            mode.dispose()
            await mode.waitForSceneRestore()
        }
    })

    it.each(['basic', 'expert'])('applies Replay camera-angle edits to the %s preparation view', async userMode => {
        const {camera, mode, settings, journey} = installScene({userMode})
        try {
            await mode.enterReplayPreparation({journey})
            const replayKey = userMode === 'basic' ? 'basic' : 'expert'
            const currentCamera = userMode === 'basic' ? settings.basic.camera : settings.camera
            const nextCamera = {...currentCamera, cameraAngle: currentCamera.cameraAngle - 35}
            if (userMode === 'basic') {
                settings.basic.camera = nextCamera
            }
            else {
                settings.camera = nextCamera
            }
            journey.replay[replayKey].camera = nextCamera
            lgs.stores.replay.camera = nextCamera

            mode.refreshCamera({sample: null, source: 'drawer'})

            const guide = resolveJourneyReplayCameraAngleGuide({journey, camera: nextCamera})
            const target = Cartesian3.fromDegrees(guide.anchor.longitude, guide.anchor.latitude, 120)
            const headingDifference = directionHeadingAt(camera, target) - guide.cameraHeading
            expect(Math.atan2(Math.sin(headingDifference), Math.cos(headingDifference))).toBeCloseTo(0, 4)
            expect(lgs.stores.replay.camera.cameraAngle).toBe(currentCamera.cameraAngle - 35)
        }
        finally {
            mode.dispose()
            await mode.waitForSceneRestore()
        }
    })

    it.each([-5, -38, -65, -89])('keeps prepared pitch %s during Basic playback despite an Expert trace-only setting', async pitch => {
        const {camera, mode, controller, settings, journey} = installScene({userMode: 'basic', pitch})
        try {
            await mode.prepareReplayCamera()
            mode.start()
            const entry = readPose(camera)
            mode.seek(1)
            expect(Cartesian3.distance(camera.positionWC, entry.position)).toBeGreaterThan(100)
            const sample = controller.currentSample()
            const target = Cartesian3.fromDegrees(sample.longitude, sample.latitude, 120)
            const local = Matrix4.inverseTransformation(Transforms.eastNorthUpToFixedFrame(target), new Matrix4())
            const direction = Matrix4.multiplyByPointAsVector(local, camera.directionWC, new Cartesian3())
            const position = Matrix4.multiplyByPoint(local, camera.positionWC, new Cartesian3())
            expect(Math.asin(direction.z)).toBeCloseTo(journey.replay.basic.camera.pitch * Math.PI / 180, 8)
            expect(position.z).toBeCloseTo(journey.replay.basic.camera.altitude - 120, 5)
        }
        finally {
            mode.dispose()
            await mode.waitForSceneRestore()
        }
    })

    it.each([[false, 120], [true, 120], [false, 3000], [true, 3000]])('records -23 pitch, 3515 absolute altitude and -113 angle after preview %s over terrain %s', async (previousPreview, terrainHeight) => {
        const {camera, mode, controller, journey, settings} = installScene({userMode: 'basic', terrainHeight})
        const normal = readPose(camera)
        try {
            // A previous preview can still have a return/settings snapshot at record startup.
            if (previousPreview) {
                mode.start()
            }
            const prepared = {pitch: -23, altitude: 3515, cameraAngle: -113}
            settings.basic.camera = {...settings.basic.camera, ...prepared}
            journey.replay.basic.camera = {...journey.replay.basic.camera, ...prepared}
            lgs.stores.replay.camera = {...lgs.stores.replay.camera, ...prepared}
            await mode.prepareReplayCamera()
            mode.beginReplayCameraExport()
            await mode.restorePlaybackScene({force: true})
            lgs.stores.ui.video.editing = false
            lgs.stores.ui.video.exporting = true
            await mode.preparePlaybackSceneForExport({journey, progress: 0})
            const guide = resolveJourneyReplayCameraAngleGuide({journey, camera: journey.replay.basic.camera})
            const cameraCall = mode[JOURNEY_REPLAY_INTERNAL_CALL]
            const viewport = cameraCall.viewportRectForCesiumSurface()
            for (const progress of [0, 0.1, 0.5, 1]) {
                await mode.renderReplayExportFrame({phase: {kind: 'replay', progress}, frame: {frameTimeMs: progress * controller.duration * 1000, frameIntervalMs: 1000 / 30}})
                const sample = controller.currentSample()
                const target = Cartesian3.fromDegrees(sample.longitude, sample.latitude, terrainHeight)
                const local = Matrix4.inverseTransformation(Transforms.eastNorthUpToFixedFrame(target), new Matrix4())
                const direction = Matrix4.multiplyByPointAsVector(local, camera.directionWC, new Cartesian3())
                const position = Matrix4.multiplyByPoint(local, camera.positionWC, new Cartesian3())
                const markerPoint = projectReplayTargetInCameraFrame({
                    frame: {destination: camera.positionWC, direction: camera.directionWC, up: camera.upWC},
                    target: cameraCall.markerRenderCartesianForSample(sample),
                    viewport,
                    verticalFovRadians: camera.frustum.fovy,
                    aspectRatio: camera.frustum.aspectRatio,
                })
                expect(markerPoint.x, `left margin at ${progress}`)
                    .toBeGreaterThanOrEqual(viewport.width * 0.2 - 1e-6)
                expect(markerPoint.x, `right margin at ${progress}`)
                    .toBeLessThanOrEqual(viewport.width * 0.8 + 1e-6)
                expect(markerPoint.y, `top margin at ${progress}`)
                    .toBeGreaterThanOrEqual(viewport.height * 0.2 - 1e-6)
                expect(markerPoint.y, `bottom margin at ${progress}`)
                    .toBeLessThanOrEqual(viewport.height * 0.8 + 1e-6)
                if (progress === 0) {
                    expect(Math.atan2(direction.x, direction.y)).toBeCloseTo(Math.atan2(Math.sin(guide.cameraHeading), Math.cos(guide.cameraHeading)), 4)
                }
                // The duration-scaled capture transition may still be settling
                // in intermediate frames.
                expect(Math.asin(direction.z), `pitch at ${progress}`).toBeCloseTo(-23 * Math.PI / 180, progress === 1 ? 8 : 4)
                if (progress === 0 || progress === 1) {
                    expect(position.z, `height at ${progress}`).toBeCloseTo(3515 - terrainHeight, 5)
                }
                expect(journey.replay.basic.camera).toMatchObject({pitch: -23, altitude: 3515, cameraAngle: -113})
            }
        }
        finally {
            await mode.restorePlaybackScene({force: true})
            mode.endReplayCameraExport()
            expectPose(camera, normal)
            mode.dispose()
            await mode.waitForSceneRestore()
        }
    })

    it('keeps newer Basic edits through delayed cleanup and applies them to the real recording camera', async () => {
        const {camera, mode, journey, settings} = installScene({userMode: 'basic', altitude: 539, pitch: -5})
        const normal = readPose(camera)
        try {
            mode.start()
            const restoring = mode.restorePlaybackScene({force: true})
            const prepared = {...settings.basic.camera, altitude: 2630, pitch: -23}
            lgs.stores.replay.camera = prepared
            settings.basic.camera = prepared
            journey.replay.basic.camera = prepared
            await restoring
            expect(lgs.stores.replay.camera).toMatchObject({altitude: 2630, pitch: -23})
            expectPose(camera, normal)
            await mode.prepareReplayCamera()
            mode.beginReplayCameraExport()
            lgs.stores.replay.basicPreparationActive = false
            lgs.stores.ui.video.editing = false
            lgs.stores.ui.video.exporting = true
            await mode.preparePlaybackSceneForExport({journey, progress: 0})
            const target = Cartesian3.fromDegrees(2, 48, 120)
            const local = Matrix4.inverseTransformation(Transforms.eastNorthUpToFixedFrame(target), new Matrix4())
            const direction = Matrix4.multiplyByPointAsVector(local, camera.directionWC, new Cartesian3())
            expect(Math.asin(direction.z)).toBeCloseTo(-23 * Math.PI / 180, 8)
            expect(journey.replay.basic.camera).toMatchObject({altitude: 2630, pitch: -23})
        }
        finally {
            await mode.restorePlaybackScene({force: true})
            mode.endReplayCameraExport()
            expectPose(camera, normal)
            mode.dispose()
            await mode.waitForSceneRestore()
        }
    })

    it('records the prepared Basic camera instead of the older journey defaults', async () => {
        const {camera, mode, journey, settings} = installScene({userMode: 'basic', altitude: 539, pitch: -5})
        const normal = readPose(camera)
        try {
            lgs.stores.replay.camera = {...lgs.stores.replay.camera, altitude: 2630, pitch: -23}
            await mode.prepareReplayCamera()
            mode.beginReplayCameraExport()
            await mode.restorePlaybackScene({force: true})
            lgs.stores.replay.basicPreparationActive = false
            lgs.stores.ui.video.editing = false
            lgs.stores.ui.video.exporting = true
            await mode.preparePlaybackSceneForExport({journey, progress: 0})
            await mode.renderReplayExportFrame({phase: {kind: 'replay', progress: 0}, frame: {frameTimeMs: 0, frameIntervalMs: 1000 / 30}})
            const target = Cartesian3.fromDegrees(2, 48, 120)
            const local = Matrix4.inverseTransformation(Transforms.eastNorthUpToFixedFrame(target), new Matrix4())
            const direction = Matrix4.multiplyByPointAsVector(local, camera.directionWC, new Cartesian3())
            const position = Matrix4.multiplyByPoint(local, camera.positionWC, new Cartesian3())
            expect(Math.asin(direction.z)).toBeCloseTo(-23 * Math.PI / 180, 8)
            expect(position.z).toBeCloseTo(2630 - 120, 5)
            expect(journey.replay.basic.camera).toMatchObject({altitude: 2630, pitch: -23})
        }
        finally {
            await mode.restorePlaybackScene({force: true})
            mode.endReplayCameraExport()
            expectPose(camera, normal)
            mode.dispose()
            await mode.waitForSceneRestore()
        }
    })

    it('applies camera-only anchor smoothing through the actual Basic export boundary', async () => {
        const {camera, mode, journey, settings} = installScene({userMode: 'basic', altitude: 3515, pitch: -23})
        settings.basic.camera.canFixHiddenMarker = false
        journey.replay.basic.camera.canFixHiddenMarker = false
        try {
            mode.beginReplayCameraExport()
            lgs.stores.ui.video.exporting = true
            await mode.preparePlaybackSceneForExport({journey})
            const cameraCall = mode[JOURNEY_REPLAY_INTERNAL_CALL]
            cameraCall.cameraCollisionForFrame = () => ({hard: false})
            const cameraMotion = vi.spyOn(mode.sampler, 'cameraMotionAtProgress').mockImplementation(progress => ({
                heading: Math.PI / 4,
                sample: {...mode.sampler.atProgress(progress), longitude: 2.005},
                cameraAnchorAdjusted: true,
            }))

            await mode.renderReplayExportFrame({
                phase: {kind: 'replay', progress: 1},
                frame: {frameTimeMs: 10000, frameIntervalMs: 1000 / 30, isLast: true},
            })

            expect(cameraMotion).toHaveBeenCalled()
            const pose = mode.lastReplayLogicalFrame.cameraPose
            expect(pose.cameraAnchorSample?.longitude).toBe(2.005)
            const expectedFrame = cameraCall.cameraRecenterFrame({
                ...pose,
                cameraSettings: journey.replay.basic.camera,
            })
            expect(Cartesian3.distance(camera.positionWC, expectedFrame.destination)).toBeLessThan(0.0001)
        }
        finally {
            mode.endReplayCameraExport()
            mode.dispose()
            await mode.waitForSceneRestore()
        }
    })

    it('anticipates an untimed Basic route and eases over its duration-scaled transition', async () => {
        const {camera, mode, journey, settings} = installScene({userMode: 'basic', altitude: 3515, pitch: -23})
        settings.basic.duration = 10
        settings.basic.camera.canFixHiddenMarker = false
        journey.replay.basic.camera.canFixHiddenMarker = false
        try {
            mode.beginReplayCameraExport()
            lgs.stores.ui.video.exporting = true
            await mode.preparePlaybackSceneForExport({journey})
            const cameraCall = mode[JOURNEY_REPLAY_INTERNAL_CALL]
            cameraCall.cameraCollisionForFrame = ({sample}) => ({hard: sample.progress >= 0.45})
            /** Render a fixed Replay timestamp through the production export method. */
            const renderAt = seconds => mode.renderReplayExportFrame({
                phase: {kind: 'replay', progress: seconds / 10},
                frame: {frameTimeMs: seconds * 1000, frameIntervalMs: 1000 / 30},
            })
            await renderAt(0)
            const initialPose = readPose(camera)
            await renderAt(2)
            expectPose(camera, initialPose)
            await renderAt(2.3)
            expectPose(camera, initialPose)
            await renderAt(3.3)
            const before = readPose(camera)
            await renderAt(3.5)
            const transition = mode[JOURNEY_REPLAY_INTERNAL_STATE].deterministicCameraTransition

            expect(transition).not.toBeNull()
            expect(transition.endAt - transition.startAt).toBe(1500)
            expect(transition.sample.progress).toBeCloseTo(0.5, 6)
            // Starting a correction must not rotate immediately toward its future target.
            expect(Cartesian3.angleBetween(before.direction, camera.directionWC)).toBeLessThan(1e-8)
            expect(Cartesian3.distance(before.position, camera.positionWC)).toBeLessThan(0.0001)

            const poses = [readPose(camera)]
            for (let frame = 1; frame <= 45; frame += 1) {
                await renderAt(3.5 + frame / 30)
                poses.push(readPose(camera))
            }
            const totalTravel = Cartesian3.distance(poses[0].position, poses[45].position)
            const positionSteps = poses.slice(1).map((pose, index) => Cartesian3.distance(pose.position, poses[index].position))
            const angularSteps = poses.slice(1).map((pose, index) => Cartesian3.angleBetween(pose.direction, poses[index].direction))
            expect(totalTravel).toBeGreaterThan(100)
            expect(Math.max(...positionSteps)).toBeLessThan(totalTravel * 0.04)
            expect(Math.max(...angularSteps)).toBeLessThan(Math.PI / 180)
        }
        finally {
            mode.endReplayCameraExport()
            mode.dispose()
            await mode.waitForSceneRestore()
        }
    })

    it('eases the exact final Basic pose instead of snapping an unfinished recenter', async () => {
        const {camera, mode, journey, settings} = installScene({userMode: 'basic', altitude: 3515, pitch: -23})
        settings.basic.duration = 10
        settings.basic.camera.canFixHiddenMarker = false
        journey.replay.basic.camera.canFixHiddenMarker = false
        try {
            mode.beginReplayCameraExport()
            lgs.stores.ui.video.exporting = true
            await mode.preparePlaybackSceneForExport({journey})
            const poses = []
            for (let index = 0; index <= 300; index += 1) {
                await mode.renderReplayExportFrame({
                    phase: {kind: 'replay', progress: index / 300},
                    frame: {frameTimeMs: index * 1000 / 30, frameIntervalMs: 1000 / 30, isLast: index === 300},
                })
                poses.push(readPose(camera))
                if (index === 255) {
                    expect(mode[JOURNEY_REPLAY_INTERNAL_STATE].deterministicCameraTransition?.finishAtReplayEnd).toBe(true)
                }
            }
            const angularSteps = poses.slice(256).map((pose, index) => Cartesian3.angleBetween(pose.direction, poses[index + 255].direction))
            expect(Math.max(...angularSteps)).toBeLessThan(Math.PI / 180)
            const pose = mode.lastReplayLogicalFrame.cameraPose
            const frame = mode[JOURNEY_REPLAY_INTERNAL_CALL].cameraRecenterFrame({...pose, cameraSettings: journey.replay.basic.camera})
            expect(Cartesian3.distance(camera.positionWC, frame.destination)).toBeLessThan(0.0001)
        }
        finally {
            mode.endReplayCameraExport()
            mode.dispose()
            await mode.waitForSceneRestore()
        }
    })

    it('keeps Basic camera aim on the rendered terrain marker when GPX altitude differs', async () => {
        const {camera, mode, controller, settings, journey} = installScene({userMode: 'basic', terrainHeight: 900})
        settings.basic.camera.canFixHiddenMarker = false
        journey.replay.basic.camera.canFixHiddenMarker = false
        lgs.stores.replay.camera.canFixHiddenMarker = false
        try {
            await mode.prepareReplayCamera()
            mode.start()
            // Exercise the live command used by Navigation after its startup placement.
            const sample = {...controller.currentSample(), longitude: 2.0001, latitude: 48.0001}
            applyCameraView(mode, {anchor: sample, heading: 1, pitch: -38 * Math.PI / 180, cameraSettings: journey.replay.basic.camera})
            const target = Cartesian3.fromDegrees(sample.longitude, sample.latitude, 900)
            const expectedDirection = Cartesian3.normalize(Cartesian3.subtract(target, camera.positionWC, new Cartesian3()), new Cartesian3())
            expect(Cartesian3.angleBetween(expectedDirection, camera.directionWC)).toBeLessThan(1e-7)
            const local = Matrix4.inverseTransformation(Transforms.eastNorthUpToFixedFrame(target), new Matrix4())
            const direction = Matrix4.multiplyByPointAsVector(local, camera.directionWC, new Cartesian3())
            const position = Matrix4.multiplyByPoint(local, camera.positionWC, new Cartesian3())
            expect(Math.asin(direction.z)).toBeCloseTo(-38 * Math.PI / 180, 8)
            expect(position.z).toBeCloseTo(1600 - 900, 5)
        }
        finally {
            mode.dispose()
            await mode.waitForSceneRestore()
        }
    })

    it('immediately tracks the exact GPX start point and initial route heading', () => {
        const {camera, mode, controller, settings, journey} = installScene({
            userMode: 'basic',
            terrainHeight: 120,
            altitude: 3515,
            pitch: -30,
            cameraAngle: 0,
        })
        const coordinates = [[2.12345, 48.23456, 120], [2.1242, 48.237, 130]]
        journey.tracks = new Map([[
            'track#journey#gpx#main',
            makeTrack({slug: 'track#journey#gpx#main', coordinates}),
        ]])
        settings.basic.camera.canFixHiddenMarker = false
        journey.replay.basic.camera.canFixHiddenMarker = false
        const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        const updateCamera = vi.spyOn(call, 'updateCamera')

        try {
            mode.start({journey})

            const startSample = controller.currentSample()
            expect(startSample.longitude).toBeCloseTo(coordinates[0][0], 12)
            expect(startSample.latitude).toBeCloseTo(coordinates[0][1], 12)
            expect(startSample.altitude).toBeCloseTo(coordinates[0][2], 8)

            const startUpdate = updateCamera.mock.calls
                .map(([options]) => options)
                .find(options => options.source === 'start')
            expect(startUpdate).toMatchObject({
                progress: 0,
                source: 'start',
                forceToleranceRecenter: true,
                immediateToleranceRecenter: true,
                sample: {
                    longitude: coordinates[0][0],
                    latitude: coordinates[0][1],
                },
            })
            const target = Cartesian3.fromDegrees(coordinates[0][0], coordinates[0][1], 120)
            const targetDirection = Cartesian3.normalize(
                Cartesian3.subtract(target, camera.positionWC, new Cartesian3()),
                new Cartesian3(),
            )
            expect(Cartesian3.angleBetween(targetDirection, camera.directionWC)).toBeLessThan(1e-7)

            const routeHeading = call.headingFromPositionProperty(0, {
                easing: journey.replay.basic.camera.hysteresis.easing,
            })
            const expectedHeading = replayCameraHeadingForAngle({axisHeading: routeHeading, cameraAngle: 0})
            const headingDifference = replayAngularDelta(expectedHeading, directionHeadingAt(camera, target))
            expect(Math.abs(headingDifference)).toBeLessThan(1e-6)
        }
        finally {
            mode.dispose()
        }
    })

    it.each([
        ['Basic', 'basic', 2 / 3],
        ['Expert', 'expert', 4 / 5],
    ])('preserves a prepared %s start position inside the replay tracking zone', async (label, userMode, screenPosition) => {
        const {camera, mode, controller, settings, journey} = installScene({
            userMode,
            terrainHeight: 120,
            altitude: 3515,
            pitch: -30,
            cameraAngle: 0,
        })
        const replayKey = userMode === 'basic' ? 'basic' : 'expert'
        const replayCamera = journey.replay[replayKey].camera
        const coordinates = [[2.12345, 48.23456, 120], [2.1242, 48.237, 130]]
        journey.tracks = new Map([[
            'track#journey#gpx#main',
            makeTrack({slug: 'track#journey#gpx#main', coordinates}),
        ]])
        const selectedSettingsCamera = userMode === 'basic' ? settings.basic.camera : settings.camera
        selectedSettingsCamera.canFixHiddenMarker = false
        replayCamera.canFixHiddenMarker = false
        const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        const viewport = {left: 0, top: 0, width: 1000, height: 800, canvasWidth: 1000, canvasHeight: 800}
        call.viewportRectForCesiumSurface = () => viewport
        call.trackingWindowPositionForSample = sample => projectReplayTargetInCameraFrame({
            frame: call.currentCameraFrame(null),
            target: call.markerRenderCartesianForSample(sample),
            viewport,
            verticalFovRadians: camera.frustum.fovy,
            aspectRatio: camera.frustum.aspectRatio,
        })
        const updateCamera = vi.spyOn(call, 'updateCamera')

        try {
            await mode.prepareReplayCamera()
            const sample = mode[JOURNEY_REPLAY_INTERNAL_STATE].sampler.atProgress(0)
            const view = call.cameraViewForSample({
                sample,
                progress: 0,
                source: 'drawer',
                cameraSettings: replayCamera,
                markerSettings: {mode: 'navigation', position: null},
                previousHeading: null,
                previousPitch: null,
            })
            const centeredFrame = call.cameraRecenterFrame({
                sample: view.sample,
                heading: view.heading,
                pitch: view.pitch,
                roll: view.roll,
                cameraSettings: view.cameraSettings,
                cameraHeight: view.cameraHeight,
            })
            const depth = Cartesian3.dot(
                Cartesian3.subtract(centeredFrame.target, centeredFrame.destination, new Cartesian3()),
                centeredFrame.direction,
            )
            const desiredY = viewport.height * screenPosition
            const verticalOffset = (desiredY - (viewport.height / 2))
                * 2 * depth * Math.tan(camera.frustum.fovy / 2) / viewport.height
            const destination = Cartesian3.add(
                centeredFrame.destination,
                Cartesian3.multiplyByScalar(centeredFrame.correctedUp, verticalOffset, new Cartesian3()),
                new Cartesian3(),
            )
            call.applyCameraFrame({
                destination,
                direction: centeredFrame.direction,
                up: centeredFrame.correctedUp,
            })
            const preparedFrame = call.currentCameraFrame(null)
            const preparedScreenPosition = call.trackingWindowPositionForSample(sample)
            expect(preparedScreenPosition.y / viewport.height).toBeCloseTo(screenPosition, 2)

            mode.start({journey})

            const startSample = controller.currentSample()
            const replayScreenPosition = call.trackingWindowPositionForSample(startSample)
            const startUpdate = updateCamera.mock.calls
                .map(([options]) => options)
                .find(options => options.source === 'start')
            expect(startUpdate).toMatchObject({
                preserveCurrentFrame: true,
                forceToleranceRecenter: false,
                immediateToleranceRecenter: false,
            })
            expect(replayScreenPosition.x).toBeCloseTo(preparedScreenPosition.x, 1)
            expect(replayScreenPosition.y / viewport.height).toBeCloseTo(screenPosition, 2)
            expect(Cartesian3.distance(camera.directionWC, preparedFrame.direction)).toBeLessThan(1e-10)
            expect(Cartesian3.distance(camera.upWC, preparedFrame.up)).toBeLessThan(1e-10)
            expect(startSample.longitude).toBeCloseTo(coordinates[0][0], 12)
            expect(startSample.latitude).toBeCloseTo(coordinates[0][1], 12)
        }
        finally {
            mode.dispose()
        }
    })

    it.each([
        ['Basic', 'basic', 2 / 3],
        ['Expert', 'expert', 4 / 5],
    ])('keeps the prepared %s start position through export initialization and its first frame', async (label, userMode, screenPosition) => {
        const {camera, mode, settings, journey} = installScene({
            userMode,
            terrainHeight: 120,
            altitude: 3515,
            pitch: -30,
            cameraAngle: 0,
        })
        const replayKey = userMode === 'basic' ? 'basic' : 'expert'
        const replayCamera = journey.replay[replayKey].camera
        const coordinates = [[2.12345, 48.23456, 120], [2.1242, 48.237, 130]]
        journey.tracks = new Map([[
            'track#journey#gpx#main',
            makeTrack({slug: 'track#journey#gpx#main', coordinates}),
        ]])
        const selectedSettingsCamera = userMode === 'basic' ? settings.basic.camera : settings.camera
        selectedSettingsCamera.canFixHiddenMarker = false
        replayCamera.canFixHiddenMarker = false
        const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        const viewport = {left: 0, top: 0, width: 1000, height: 800, canvasWidth: 1000, canvasHeight: 800}
        call.viewportRectForCesiumSurface = () => viewport
        call.trackingWindowPositionForSample = sample => projectReplayTargetInCameraFrame({
            frame: call.currentCameraFrame(null),
            target: call.markerRenderCartesianForSample(sample),
            viewport,
            verticalFovRadians: camera.frustum.fovy,
            aspectRatio: camera.frustum.aspectRatio,
        })

        try {
            await mode.prepareReplayCamera()
            const sample = mode[JOURNEY_REPLAY_INTERNAL_STATE].sampler.atProgress(0)
            const view = call.cameraViewForSample({
                sample,
                progress: 0,
                source: 'drawer',
                cameraSettings: replayCamera,
                markerSettings: {mode: 'navigation', position: null},
                previousHeading: null,
                previousPitch: null,
            })
            const centeredFrame = call.cameraRecenterFrame({
                sample: view.sample,
                heading: view.heading,
                pitch: view.pitch,
                roll: view.roll,
                cameraSettings: view.cameraSettings,
                cameraHeight: view.cameraHeight,
            })
            const depth = Cartesian3.dot(
                Cartesian3.subtract(centeredFrame.target, centeredFrame.destination, new Cartesian3()),
                centeredFrame.direction,
            )
            const desiredY = viewport.height * screenPosition
            const verticalOffset = (desiredY - (viewport.height / 2))
                * 2 * depth * Math.tan(camera.frustum.fovy / 2) / viewport.height
            call.applyCameraFrame({
                destination: Cartesian3.add(
                    centeredFrame.destination,
                    Cartesian3.multiplyByScalar(centeredFrame.correctedUp, verticalOffset, new Cartesian3()),
                    new Cartesian3(),
                ),
                direction: centeredFrame.direction,
                up: centeredFrame.correctedUp,
            })
            const preparedPosition = call.trackingWindowPositionForSample(sample)
            expect(preparedPosition.y / viewport.height).toBeCloseTo(screenPosition, 2)

            mode.beginReplayCameraExport()
            lgs.stores.ui.video.exporting = true
            await mode.preparePlaybackSceneForExport({journey})
            const initializedPosition = call.trackingWindowPositionForSample(sample)
            expect(initializedPosition.y / viewport.height).toBeCloseTo(screenPosition, 2)

            await mode.renderReplayExportFrame({
                phase: {kind: 'replay', progress: 0},
                frame: {frameTimeMs: 0, frameIntervalMs: 1000 / 30},
            })
            const firstFramePosition = call.trackingWindowPositionForSample(sample)
            expect(firstFramePosition.y / viewport.height).toBeCloseTo(screenPosition, 2)
        }
        finally {
            mode.endReplayCameraExport()
            mode.dispose()
            await mode.waitForSceneRestore()
        }
    })

    it('updates Replay zoom when camera height changes at the same anchor and orientation', async () => {
        const {camera, mode, controller, journey} = installScene()
        const pitch = -38 * Math.PI / 180
        try {
            await mode.prepareReplayCamera()
            mode.start()
            const sample = {...controller.currentSample(), longitude: 2.0001, latitude: 48.0001}
            const target = Cartesian3.fromDegrees(sample.longitude, sample.latitude, 120)

            applyCameraView(mode, {
                anchor: sample,
                heading: 1,
                pitch,
                cameraSettings: {...journey.replay.expert.camera, altitudeMode: 'constant', altitude: 1800},
            })
            const firstRange = Cartesian3.distance(camera.positionWC, target)

            applyCameraView(mode, {
                anchor: sample,
                heading: 1,
                pitch,
                cameraSettings: {...journey.replay.expert.camera, altitudeMode: 'constant', altitude: 2600},
            })
            const secondRange = Cartesian3.distance(camera.positionWC, target)

            expect(secondRange).toBeGreaterThan(firstRange + 1000)
        }
        finally {
            mode.dispose()
            await mode.waitForSceneRestore()
        }
    })

    it('uses the latest normal view at startup and preserves it after physical Replay navigation', async () => {
        const {camera, mode} = installScene()
        try {
            await mode.prepareReplayCamera()
            camera.lookAtTransform(Transforms.eastNorthUpToFixedFrame(Cartesian3.fromDegrees(5, 45, 120)), new HeadingPitchRange(1.3, -0.7, 5000))
            const normal = readPose(camera)
            mode.start()
            const entry = readPose(camera)
            mode.seek(0.6)
            mode.refreshCamera({source: 'drawer'})
            expect(Cartesian3.distance(camera.positionWC, entry.position)).toBeGreaterThan(100)
            mode.stop({emit: false})
            await mode.waitForSceneRestore()
            expectPose(camera, normal)
            mode.refresh()
            mode.seek(0.8)
            expectPose(camera, normal)
        }
        finally {
            mode.dispose()
            await mode.waitForSceneRestore()
        }
    })

    it('starts, pauses, resumes and disposes through the public Replay controls', async () => {
        const {camera, mode, controller, journey} = installScene()
        const normal = readPose(camera)
        await mode.enterReplayPreparation({journey})
        mode.toggle()
        expect(controller.playing).toBe(true)
        mode.toggle()
        expect(controller.paused).toBe(true)
        mode.toggle()
        expect(controller.playing).toBe(true)
        mode.dispose()
        await mode.waitForSceneRestore()
        expectPose(camera, normal)
    })

    it('restores the normal physical camera on natural completion', async () => {
        const {camera, mode, advance} = installScene()
        const normal = readPose(camera)
        try {
            await mode.prepareReplayCamera()
            mode.start({duration: 1})
            advance(1000)
            await mode.waitForSceneRestore()
            expectPose(camera, normal)
        }
        finally {
            mode.dispose()
            await mode.waitForSceneRestore()
        }
    })

    it('restores the normal physical camera when a rendering error aborts startup', async () => {
        const {camera, mode, renderer, controller} = installScene()
        const normal = readPose(camera)
        try {
            await mode.prepareReplayCamera()
            renderer.update.mockImplementationOnce(() => { throw new Error('Rendering failed') })
            mode.start()
            await mode.waitForSceneRestore()
            expect(controller.playing).toBe(false)
            expectPose(camera, normal)
        }
        finally {
            mode.dispose()
            await mode.waitForSceneRestore()
        }
    })

    it('keeps the real main camera independent while an isolated export borrows its own camera', async () => {
        const {camera, mode, journey} = installScene()
        const normal = readPose(camera)
        const isolatedScene = {...globalThis.lgs.scene}
        const isolated = new Camera(isolatedScene)
        isolated.update(SceneMode.SCENE3D)
        const isolatedNormal = readPose(isolated)
        mode.setRenderTarget({viewer: {camera: isolated, scene: isolatedScene}, scene: isolatedScene})
        try {
            await mode.preparePlaybackSceneForExport({journey})
            expectPose(camera, normal)
            expect(globalThis.__.ui.cameraManager.stopRotate).not.toHaveBeenCalled()
            expect(Cartesian3.distance(isolated.positionWC, isolatedNormal.position)).toBeGreaterThan(1000)
            mode.stop({emit: false})
            await mode.waitForSceneRestore()
            expectPose(camera, normal)
            expectPose(isolated, isolatedNormal)
        }
        finally {
            mode.dispose()
            await mode.waitForSceneRestore()
        }
    })

    it('restores the exact camera reference frame after Replay moves it', async () => {
        const {camera, mode} = installScene()
        const normal = readPose(camera)
        try {
            await mode.prepareReplayCamera()
            mode.start()
            expect(Cartesian3.distance(camera.positionWC, normal.position)).toBeGreaterThan(100000)
            mode.stop({emit: false})
            await mode.waitForSceneRestore()
            expectPose(camera, normal)
            mode.refreshCamera({source: 'drawer'})
            expectPose(camera, normal)
        }
        finally {
            mode.dispose()
            await mode.waitForSceneRestore()
        }
    })
})
