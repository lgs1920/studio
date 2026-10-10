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
 * Last modified: 2026-10-10
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
import {resolveJourneyReplayCameraAngleGuide} from '@Core/ui/replay/JourneyReplayCameraAngleGuide'
import {defaultJourneyReplaySettings} from '@Core/ui/replay/JourneyReplayProgressionStyle'
import {makeJourney, makeTrack} from '../../unit/replay/replay-phase1-fixtures'

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

/** Install a real Cesium camera with only the rendering surface stubbed. */
const installScene = ({userMode = 'expert', terrainHeight = 120, pitch = -38, altitude = 1600, cameraAngle = 65} = {}) => {
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
        settings.simple = {...settings.simple, camera: {...settings.camera}}
        journey.replay = {simple: {camera: {...settings.camera}}}
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
            replay: proxy({camera: settings.camera, progress: 0, userMode, simplePreparationActive: userMode === 'basic'}),
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
    it.each([
        ['basic', 'playback'], ['basic', 'export'],
        ['expert', 'playback'], ['expert', 'export'],
    ])('uses a preparation mouse tilt as the %s %s pitch without copying map height or heading', async (userMode, entry) => {
        const {camera, mode, journey, settings} = installScene({userMode, pitch: -5, altitude: 2630, cameraAngle: 65})
        vi.useFakeTimers()
        try {
            await mode.enterReplayPreparation({journey})
            const canvas = lgs.viewer.canvas
            canvas.dispatchEvent(new MouseEvent('pointerdown', {bubbles: true}))
            camera.setView({orientation: {heading: 1.7, pitch: -Math.PI / 4, roll: 0}})
            // Release is the public input boundary. Do not depend on the camera's
            // changed threshold or wait for the delayed live-sync frame.
            canvas.dispatchEvent(new MouseEvent('pointerup', {bubbles: true}))
            expect(lgs.stores.replay.camera).toMatchObject({pitch: -45, altitude: 2630, cameraAngle: 65})
            expect(userMode === 'basic' ? settings.simple.camera.pitch : settings.camera.pitch).toBe(-45)
            const normal = readPose(camera)
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
            expect(Math.asin(direction.z)).toBeCloseTo(-Math.PI / 4, 8)
            mode.stop()
            await mode.waitForSceneRestore()
            expectPose(camera, normal)
        }
        finally {
            mode.dispose()
            await mode.waitForSceneRestore()
            vi.useRealTimers()
        }
    })

    it('ignores automatic preparation moves and mouse gestures that do not change pitch', async () => {
        const {camera, mode, journey} = installScene({userMode: 'basic', pitch: -5, altitude: 2630, cameraAngle: 65})
        vi.useFakeTimers()
        try {
            await mode.enterReplayPreparation({journey})
            camera.setView({orientation: {heading: 1, pitch: -Math.PI / 3, roll: 0}})
            camera.changed.raiseEvent()
            expect(lgs.stores.replay.camera.pitch).toBe(-5)
            const canvas = lgs.viewer.canvas
            canvas.dispatchEvent(new MouseEvent('pointerdown', {bubbles: true}))
            camera.setView({orientation: {heading: 1.7, pitch: -Math.PI / 3, roll: 0}})
            camera.changed.raiseEvent()
            canvas.dispatchEvent(new MouseEvent('pointerup', {bubbles: true}))
            expect(lgs.stores.replay.camera).toMatchObject({pitch: -5, altitude: 2630, cameraAngle: 65})
            vi.advanceTimersByTime(120)
            expect(lgs.stores.replay.camera.pitch).toBe(-5)
            lgs.stores.ui.video.editing = false
            canvas.dispatchEvent(new MouseEvent('pointerdown', {bubbles: true}))
            camera.setView({orientation: {heading: 1.7, pitch: -Math.PI / 4, roll: 0}})
            camera.changed.raiseEvent()
            canvas.dispatchEvent(new MouseEvent('pointerup', {bubbles: true}))
            expect(lgs.stores.replay.camera.pitch).toBe(-5)
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
            const guide = resolveJourneyReplayCameraAngleGuide({journey, camera: settings.simple.camera})
            expect(Math.atan2(direction.x, direction.y)).toBeCloseTo(Math.atan2(Math.sin(guide.cameraHeading), Math.cos(guide.cameraHeading)), 4)
            expect(Math.asin(direction.z)).toBeCloseTo(-Math.PI / 4, 8)
            expect(Cartesian3.distance(camera.positionWC, target)).toBeLessThan(10)
            expect(lgs.stores.replay.camera).toMatchObject({pitch: -45, altitude: 539, cameraAngle: -112})
            if (entry === 'playback') {
                await mode.seek(0.5)
                const sample = lgs.stores.replay.sample
                const trackedTarget = Cartesian3.fromDegrees(sample.longitude, sample.latitude, 1180)
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

    it.each(['basic', 'expert'])('stops the orbit and frames the departure North during %s preparation from a distant map view', async userMode => {
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
            const departure = Cartesian3.fromDegrees(2, 48, 120)
            const departureFrame = Matrix4.inverseTransformation(Transforms.eastNorthUpToFixedFrame(departure), new Matrix4())
            const preparedDirection = Matrix4.multiplyByPointAsVector(departureFrame, camera.directionWC, new Cartesian3())
            const preparedPosition = Matrix4.multiplyByPoint(departureFrame, camera.positionWC, new Cartesian3())
            expect(Math.atan2(preparedDirection.x, preparedDirection.y)).toBeCloseTo(0, 8)
            expect(Math.asin(preparedDirection.z)).toBeCloseTo(-23 * Math.PI / 180, 8)
            expect(preparedPosition.z).toBeCloseTo(2630 - 120, 5)
            const towardDeparture = Cartesian3.normalize(Cartesian3.subtract(departure, camera.positionWC, new Cartesian3()), new Cartesian3())
            expect(Cartesian3.distance(towardDeparture, camera.directionWC)).toBeLessThan(1e-10)
            expect(lgs.stores.replay.camera).toMatchObject({altitude: 2630, pitch: -23})
            const preparedNormal = readPose(camera)
            mode.start()
            const target = Cartesian3.fromDegrees(2, 48, 120)
            const local = Matrix4.inverseTransformation(Transforms.eastNorthUpToFixedFrame(target), new Matrix4())
            const direction = Matrix4.multiplyByPointAsVector(local, camera.directionWC, new Cartesian3())
            expect(Math.asin(direction.z)).toBeCloseTo(-23 * Math.PI / 180, 8)
            expect(settings.camera.pitch).toBe(-23)
            mode.stop()
            await mode.waitForSceneRestore()
            expectPose(camera, preparedNormal)
        }
        finally {
            finishRotation()
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

    it.each(['basic', 'expert'])('applies the prepared cone angle, pitch and height to the physical first %s Replay view', async userMode => {
        const {camera, mode, settings, journey} = installScene({userMode})
        try {
            await mode.prepareReplayCamera()
            const guide = resolveJourneyReplayCameraAngleGuide({journey, camera: settings.camera})
            mode.start()
            const target = Cartesian3.fromDegrees(guide.anchor.longitude, guide.anchor.latitude, 120)
            const local = Matrix4.inverseTransformation(Transforms.eastNorthUpToFixedFrame(target), new Matrix4())
            const direction = Matrix4.multiplyByPointAsVector(local, camera.directionWC, new Cartesian3())
            const position = Matrix4.multiplyByPoint(local, camera.positionWC, new Cartesian3())
            expect(Math.atan2(direction.x, direction.y)).toBeCloseTo(Math.atan2(Math.sin(guide.cameraHeading), Math.cos(guide.cameraHeading)), 4)
            expect(Math.asin(direction.z)).toBeCloseTo(settings.camera.pitch * Math.PI / 180, 8)
            expect(position.z).toBeCloseTo(settings.camera.altitude - 120, 5)
        }
        finally {
            mode.dispose()
            await mode.waitForSceneRestore()
        }
    })

    it.each([-5, -38, -65, -89])('keeps prepared pitch %s during Simple playback despite an Expert trace-only setting', async pitch => {
        const {camera, mode, controller, settings} = installScene({userMode: 'basic', pitch})
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
            expect(Math.asin(direction.z)).toBeCloseTo(settings.simple.camera.pitch * Math.PI / 180, 8)
            expect(position.z).toBeCloseTo(settings.simple.camera.altitude - 120, 5)
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
            settings.simple.camera = {...settings.simple.camera, ...prepared}
            journey.replay.simple.camera = {...journey.replay.simple.camera, ...prepared}
            lgs.stores.replay.camera = {...lgs.stores.replay.camera, ...prepared}
            await mode.prepareReplayCamera()
            mode.beginReplayCameraExport()
            await mode.restorePlaybackScene({force: true})
            lgs.stores.ui.video.editing = false
            lgs.stores.ui.video.exporting = true
            await mode.preparePlaybackSceneForExport({journey, progress: 0})
            const guide = resolveJourneyReplayCameraAngleGuide({journey, camera: settings.simple.camera})
            for (const progress of [0, 0.1, 0.5, 1]) {
                await mode.renderReplayExportFrame({phase: {kind: 'replay', progress}, frame: {frameTimeMs: progress * controller.duration * 1000, frameIntervalMs: 1000 / 30}})
                const sample = controller.currentSample()
                const target = Cartesian3.fromDegrees(sample.longitude, sample.latitude, terrainHeight)
                const local = Matrix4.inverseTransformation(Transforms.eastNorthUpToFixedFrame(target), new Matrix4())
                const direction = Matrix4.multiplyByPointAsVector(local, camera.directionWC, new Cartesian3())
                const position = Matrix4.multiplyByPoint(local, camera.positionWC, new Cartesian3())
                if (progress === 0) {
                    expect(Math.atan2(direction.x, direction.y)).toBeCloseTo(Math.atan2(Math.sin(guide.cameraHeading), Math.cos(guide.cameraHeading)), 4)
                }
                expect(Math.asin(direction.z), `pitch at ${progress}`).toBeCloseTo(-23 * Math.PI / 180, 8)
                expect(position.z, `height at ${progress}`).toBeCloseTo(3515 - terrainHeight, 5)
                expect(settings.simple.camera).toMatchObject({pitch: -23, altitude: 3515, cameraAngle: -113})
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

    it('keeps newer Simple edits through delayed cleanup and applies them to the real recording camera', async () => {
        const {camera, mode, journey, settings} = installScene({userMode: 'basic', altitude: 539, pitch: -5})
        const normal = readPose(camera)
        try {
            mode.start()
            const restoring = mode.restorePlaybackScene({force: true})
            const prepared = {...settings.simple.camera, altitude: 2630, pitch: -23}
            lgs.stores.replay.camera = prepared
            settings.simple.camera = prepared
            journey.replay.simple.camera = prepared
            await restoring
            expect(lgs.stores.replay.camera).toMatchObject({altitude: 2630, pitch: -23})
            expectPose(camera, normal)
            await mode.prepareReplayCamera()
            mode.beginReplayCameraExport()
            lgs.stores.replay.simplePreparationActive = false
            lgs.stores.ui.video.editing = false
            lgs.stores.ui.video.exporting = true
            await mode.preparePlaybackSceneForExport({journey, progress: 0})
            const target = Cartesian3.fromDegrees(2, 48, 120)
            const local = Matrix4.inverseTransformation(Transforms.eastNorthUpToFixedFrame(target), new Matrix4())
            const direction = Matrix4.multiplyByPointAsVector(local, camera.directionWC, new Cartesian3())
            expect(Math.asin(direction.z)).toBeCloseTo(-23 * Math.PI / 180, 8)
            expect(settings.simple.camera).toMatchObject({altitude: 2630, pitch: -23})
        }
        finally {
            await mode.restorePlaybackScene({force: true})
            mode.endReplayCameraExport()
            expectPose(camera, normal)
            mode.dispose()
            await mode.waitForSceneRestore()
        }
    })

    it('records the prepared Simple camera instead of the older journey defaults', async () => {
        const {camera, mode, journey, settings} = installScene({userMode: 'basic', altitude: 539, pitch: -5})
        const normal = readPose(camera)
        try {
            lgs.stores.replay.camera = {...lgs.stores.replay.camera, altitude: 2630, pitch: -23}
            await mode.prepareReplayCamera()
            mode.beginReplayCameraExport()
            await mode.restorePlaybackScene({force: true})
            lgs.stores.replay.simplePreparationActive = false
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
            expect(settings.simple.camera).toMatchObject({altitude: 2630, pitch: -23})
        }
        finally {
            await mode.restorePlaybackScene({force: true})
            mode.endReplayCameraExport()
            expectPose(camera, normal)
            mode.dispose()
            await mode.waitForSceneRestore()
        }
    })

    it('keeps Simple camera aim on the rendered terrain marker when GPX altitude differs', async () => {
        const {camera, mode, controller, settings, journey} = installScene({userMode: 'basic', terrainHeight: 900})
        settings.simple.camera.canFixHiddenMarker = false
        journey.replay.simple.camera.canFixHiddenMarker = false
        lgs.stores.replay.camera.canFixHiddenMarker = false
        try {
            await mode.prepareReplayCamera()
            mode.start()
            // Exercise the live command used by Navigation after its startup placement.
            const sample = {...controller.currentSample(), longitude: 2.0001, latitude: 48.0001}
            applyCameraView(mode, {anchor: sample, heading: 1, pitch: -38 * Math.PI / 180, cameraSettings: settings.simple.camera})
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
        const {camera, mode, controller} = installScene()
        const normal = readPose(camera)
        await mode.prepareReplayCamera()
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
