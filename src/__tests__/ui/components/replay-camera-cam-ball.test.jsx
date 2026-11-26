/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-camera-cam-ball.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-29
 * Last modified: 2026-11-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {act, cleanup, fireEvent, render} from '@testing-library/react'
import {Camera, Cartesian2, Cartesian3, Ellipsoid, GeographicProjection, HeadingPitchRange, Matrix4, SceneMode, SceneTransforms} from 'cesium'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'
import {ReplayCameraCamBall} from '@Components/JourneyReplay/ReplayCameraCamBall'
import {CamBallSettings} from '@Components/Settings/application/style/CamBallSettings'
import {getMainSceneCameraPivot, setMainSceneCameraPivot} from '@Core/ui/MainSceneCameraPivot'

vi.mock('@Components/MainUI/widgets/Widget', () => ({
    Widget: ({children, containerClassName, config}) => (
        <div className={containerClassName} style={{zIndex: config.zIndex}}>{children}</div>
    ),
}))
vi.mock('@awesome.me/webawesome/dist/react', () => ({
    WaIcon: ({name, ...props}) => <span data-icon={name} {...props}/>,
    WaDivider: () => <hr/>,
    WaSwitch: ({children, checked, onChange}) => (
        <label><input type="checkbox" checked={checked} onChange={onChange}/>{children}</label>
    ),
}))
vi.mock('@Core/ui/replay/JourneyReplayRuntime', () => ({
    currentJourneyReplayCameraSettings: () => globalThis.lgs.stores.replay.camera,
    isJourneyReplayCameraActive: replay => Boolean(replay?.active || replay?.playing || replay?.paused || replay?.clipSequenceActive),
}))

/** Install deterministic animation frames and the public preparation camera API. */
const install = () => {
    const frames = new Map()
    let nextFrame = 0
    vi.stubGlobal('requestAnimationFrame', callback => { frames.set(++nextFrame, callback)
        return nextFrame })
    vi.stubGlobal('cancelAnimationFrame', id => frames.delete(id))
    const replay = proxy({camera: {altitude: 1200, pitch: -40, cameraAngle: 65}})
    const video = proxy({editing: true})
    const main = proxy({theJourney: {slug: 'journey-a'}})
    const updatePreparationCamera = vi.fn(updates => Object.assign(replay.camera, updates))
    vi.stubGlobal('lgs', {stores: {main, replay, ui: {video}}, settings: {ui: proxy({}), unitSystem: proxy({current: 0})}})
    vi.stubGlobal('__', {ui: {replay: {updatePreparationCamera}}})
    /** Deliver one explicitly timed animation frame without a wall-clock sleep. */
    const frame = async timestamp => act(async () => {
        const callbacks = [...frames.values()]
        frames.clear()
        callbacks.forEach(callback => callback(timestamp))
    })
    return {frames, frame, replay, video, main, updatePreparationCamera}
}

/** Dispatch a pointer using CSS coordinates without relying on jsdom's missing PointerEvent. */
const pointer = (target, type, x, y, pointerId = 1, ctrlKey = false, pointerType = 'mouse', shiftKey = false) => {
    const event = new Event(type, {bubbles: true, cancelable: true})
    Object.defineProperties(event, {
        pointerType: {value: pointerType},
        shiftKey: {value: shiftKey},
        button: {value: 0}, clientX: {value: x}, clientY: {value: y}, pointerId: {value: pointerId}, ctrlKey: {value: ctrlKey},
    })
    const grip = type === 'pointerdown' ? target.querySelector('.replay-camera-cam-ball-dome-hit') : null
    fireEvent(grip ?? target, event)
}

afterEach(() => {
    cleanup()
    document.querySelectorAll('.replay-pivot-test-canvas-parent').forEach(element => element.remove())
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('Replay camera CamBall', () => {
    it('shows CamBall by default and applies both UI preferences immediately', async () => {
        const {video} = install()
        video.editing = false
        lgs.camera = {pitch: -Math.PI / 4}
        const view = render(<><CamBallSettings/><ReplayCameraCamBall mainScene/></>)
        /** Read the current visual angle on the widget surface. */
        const tilt = () => view.container.querySelector('.replay-camera-cam-ball')
            ?.style.getPropertyValue('--lgs-cam-ball-view-tilt')
        const show = view.getByRole('checkbox', {name: 'Show CamBall'})
        const follow = view.getByRole('checkbox', {name: 'Follow camera pitch'})
        expect(show.checked).toBe(true)
        expect(follow.checked).toBe(false)
        expect(tilt()).toBe('0.00deg')
        await act(async () => fireEvent.click(follow))
        expect(lgs.settings.ui.camBall).toEqual({visible: true, followPitch: true})
        expect(tilt()).toBe('30.00deg')
        await act(async () => fireEvent.click(show))
        expect(lgs.settings.ui.camBall.visible).toBe(false)
        expect(tilt()).toBeUndefined()
        await act(async () => fireEvent.click(show))
        expect(tilt()).toBe('30.00deg')
        await act(async () => fireEvent.click(follow))
        expect(tilt()).toBe('0.00deg')
    })

    it.each([false, true])('uses the map tool layer below overlays in both contexts (mainScene %s)', mainScene => {
        const {video} = install()
        video.editing = !mainScene
        const view = render(<ReplayCameraCamBall mainScene={mainScene}/>)
        const layer = view.container.querySelector('.replay-camera-cam-ball-layer')
        expect(layer?.style.zIndex).toBe('var(--lgs-tools-ui-zindex)')
    })

    it('tilts the whole widget with the live pitch and limits the visual angle at both ends', () => {
        const {video} = install()
        lgs.settings.ui.camBall = {followPitch: true}
        video.editing = false
        const addEventListener = vi.fn()
        lgs.camera = {pitch: -Math.PI / 2}
        lgs.scene = {postRender: {addEventListener}}
        const view = render(<ReplayCameraCamBall mainScene/>)
        const surface = view.container.querySelector('.replay-camera-cam-ball')
        const refresh = addEventListener.mock.calls[0][0]
        const grip = view.getByRole('group', {name: 'Rotate camera with the grip ring'})
        const flatGrip = grip.getAttribute('d')
        expect(surface.style.getPropertyValue('--lgs-cam-ball-view-tilt')).toBe('0.00deg')
        expect(surface.style.getPropertyValue('--lgs-cam-ball-view-perspective')).toBe('560px')
        lgs.camera.pitch = -Math.PI / 4
        refresh()
        expect(surface.style.getPropertyValue('--lgs-cam-ball-view-tilt')).toBe('30.00deg')
        lgs.camera.pitch = 0.2
        refresh()
        expect(surface.style.getPropertyValue('--lgs-cam-ball-view-tilt')).toBe('60.00deg')
        expect(surface.style.getPropertyValue('--lgs-cam-ball-view-perspective')).toBe('240px')
        expect(grip.getAttribute('d')).not.toBe(flatGrip)
        expect(grip.closest('.replay-camera-cam-ball-visual')).toBeNull()
        lgs.camera.pitch = -2
        refresh()
        expect(surface.style.getPropertyValue('--lgs-cam-ball-view-tilt')).toBe('0.00deg')
        expect(grip.getAttribute('d')).toBe(flatGrip)
    })

    it('measures a grip turn in the dial plane when the widget is tilted in perspective', () => {
        const {replay} = install()
        lgs.settings.ui.camBall = {followPitch: true}
        lgs.camera = {pitch: -Math.PI / 12}
        const view = render(<ReplayCameraCamBall/>)
        const grip = view.getByRole('group', {name: 'Rotate camera with the grip ring'})
        const pad = view.getByRole('group', {name: /adjust pitch/})
        pad.getBoundingClientRect = () => ({left: 20, top: 30, width: 144, height: 144})
        const tilt = 50 * Math.PI / 180
        const perspective = 293
        /** Project a point on the physical ring to the browser pointer coordinates. */
        const project = angle => {
            const x = 40 * Math.cos(angle)
            const y = 144 * 0.04 + 40 * (39 / 41) * Math.sin(angle)
            const scale = perspective / (perspective - y * Math.sin(tilt))
            return [92 + x * scale, 102 + y * Math.cos(tilt) * scale]
        }
        pointer(grip, 'pointerdown', ...project(-Math.PI / 6))
        pointer(grip, 'pointermove', ...project(2 * Math.PI / 3))
        expect(replay.camera.cameraAngle).toBeCloseTo(-85)
    })

    it('stops a sustained pitch input at both limits without passing through the center point', async () => {
        const {frame, video} = install()
        video.editing = false
        const pivot = Cartesian3.fromDegrees(7.25, 46.7, 550)
        const scene = {
            mode: SceneMode.SCENE3D, canvas: {clientWidth: 800, clientHeight: 600},
            drawingBufferWidth: 800, drawingBufferHeight: 600,
            mapProjection: new GeographicProjection(), ellipsoid: Ellipsoid.WGS84,
            screenSpaceCameraController: {enableInputs: true, enableTilt: true},
            pickPositionSupported: true, pickPosition: () => pivot, requestRender: vi.fn(),
        }
        const camera = new Camera(scene)
        camera.update(SceneMode.SCENE3D)
        camera.lookAt(pivot, new HeadingPitchRange(0.7, -0.8, 17000))
        lgs.scene = scene
        lgs.camera = camera
        const view = render(<ReplayCameraCamBall mainScene/>)
        const pad = view.getByRole('group', {name: /adjust pitch/})
        pad.getBoundingClientRect = () => ({left: 0, top: 0, width: 100, height: 100})
        const normal = scene.ellipsoid.geodeticSurfaceNormal(pivot)
        pointer(pad, 'pointerdown', 50, 50)
        pointer(pad, 'pointermove', 50, 80)
        for (let step = 0; step < 46; step++) await frame(step * 100)
        const cameraUp = scene.ellipsoid.geodeticSurfaceNormal(camera.positionWC, new Cartesian3())
        expect(Cartesian3.dot(camera.directionWC, normal)).toBeCloseTo(-Math.cos(Math.PI / 180), 5)
        expect(Cartesian3.dot(camera.directionWC, cameraUp)).toBeLessThan(0)
        pointer(pad, 'pointermove', 50, 20)
        for (let step = 46; step < 100; step++) await frame(step * 100)
        scene.ellipsoid.geodeticSurfaceNormal(camera.positionWC, cameraUp)
        expect(Cartesian3.dot(camera.directionWC, cameraUp)).toBeLessThanOrEqual(-Math.sin(Math.PI / 180) + 1e-8)
        expect(Cartesian3.distance(camera.positionWC, pivot)).toBeCloseTo(17000, 5)
    })

    it.each([
        {modifier: 'Shift', ctrlKey: false, shiftKey: true},
        {modifier: 'Ctrl', ctrlKey: true, shiftKey: false},
    ])('ignores $modifier drags on the CamBall face', ({ctrlKey, shiftKey}) => {
        const {video} = install()
        video.editing = false
        const moveRight = vi.fn()
        const moveUp = vi.fn()
        const zoomIn = vi.fn()
        lgs.camera = {positionCartographic: {height: 500}, moveRight, moveUp, zoomIn}
        lgs.scene = {
            mode: SceneMode.SCENE3D,
            screenSpaceCameraController: {enableInputs: true, enableTranslate: true, enableZoom: true, enableTilt: true},
            requestRender: vi.fn(),
        }
        const view = render(<ReplayCameraCamBall mainScene/>)
        const pad = view.getByRole('group', {name: /adjust pitch/})
        pad.getBoundingClientRect = () => ({left: 0, top: 0, width: 100, height: 100})
        pointer(pad, 'pointerdown', 50, 50, 1, ctrlKey, 'mouse', shiftKey)
        pointer(pad, 'pointermove', 75, 70, 1, ctrlKey, 'mouse', shiftKey)
        pointer(pad, 'pointerup', 75, 70, 1, ctrlKey, 'mouse', shiftKey)
        expect(moveRight).not.toHaveBeenCalled()
        expect(moveUp).not.toHaveBeenCalled()
        expect(zoomIn).not.toHaveBeenCalled()
    })

    it('uses a circular drag from the grip ring to rotate without changing pitch or altitude', () => {
        const {updatePreparationCamera} = install()
        const view = render(<ReplayCameraCamBall/>)
        const pad = view.getByRole('group', {name: /adjust pitch/})
        const rim = pad.querySelector('.replay-camera-cam-ball-grip-hit')
        pad.getBoundingClientRect = () => ({left: 0, top: 0, width: 100, height: 100})
        pointer(rim, 'pointerdown', 76, 54, 1, false, 'touch')
        pointer(rim, 'pointermove', 50, 79, 1, false, 'touch')
        pointer(rim, 'pointerup', 50, 79, 1, false, 'touch')
        expect(updatePreparationCamera).toHaveBeenCalledOnce()
        expect(updatePreparationCamera.mock.calls[0][0]).toEqual({cameraAngle: -25})
    })

    it.each([
        {axis: 'pitch', startX: 54, startY: 83, inwardX: 54, inwardY: 81, direction: 'raise'},
        {axis: 'pitch', startX: 54, startY: 25, inwardX: 54, inwardY: 27, direction: 'lower'},
        {axis: 'zoom', startX: 21, startY: 54, inwardX: 23, inwardY: 54, direction: 'in'},
        {axis: 'zoom', startX: 79, startY: 54, inwardX: 77, inwardY: 54, direction: 'out'},
    ])('keeps a grip-ring rotation locked through inward movement for $axis ($direction)', async ({
        startX, startY, inwardX, inwardY,
    }) => {
        const {frame, replay, updatePreparationCamera} = install()
        const view = render(<ReplayCameraCamBall/>)
        const pad = view.getByRole('group', {name: /adjust pitch/})
        const rim = view.getByRole('group', {name: 'Rotate camera with the grip ring'})
        pad.getBoundingClientRect = () => ({left: 0, top: 0, width: 100, height: 100})
        const startingPose = {...replay.camera}

        pointer(rim, 'pointerdown', startX, startY)
        pointer(pad, 'pointermove', inwardX, inwardY)
        await frame(0)
        pointer(pad, 'pointermove', 50, 50)
        await frame(100)
        pointer(pad, 'pointerup', 50, 50)

        expect(replay.camera.altitude).toBe(startingPose.altitude)
        expect(replay.camera.pitch).toBe(startingPose.pitch)
        const rotationOnlyUpdates = updatePreparationCamera.mock.calls.every(
            ([updates]) => Object.keys(updates).every(key => key === 'cameraAngle'),
        )
        expect(rotationOnlyUpdates).toBe(true)
    })

    it('leaves the outer crown display-only when clicked or dragged', () => {
        const {frames, updatePreparationCamera} = install()
        const view = render(<ReplayCameraCamBall/>)
        const crown = view.container.querySelector('.replay-camera-cam-ball-crown-band')
        pointer(crown, 'pointerdown', 84, 54)
        pointer(crown, 'pointermove', 50, 86)
        pointer(crown, 'pointerup', 50, 86)
        fireEvent.doubleClick(crown)
        expect(updatePreparationCamera).not.toHaveBeenCalled()
        expect(frames.size).toBe(0)
    })

    it.each([
        {gesture: 'double click', pitch: -0.65, depthPick: false},
        {gesture: 'double tap', pitch: -0.65, depthPick: false},
        {gesture: 'double click', pitch: -Math.PI / 2, depthPick: true},
    ])('keeps the viewport center fixed during camera gestures and $gesture reset (pitch $pitch)', async ({gesture, pitch, depthPick}) => {
        const {frame, video} = install()
        video.editing = false
        const scene = {
            mode: SceneMode.SCENE3D, frameState: {mode: SceneMode.SCENE3D},
            canvas: {clientWidth: 801, clientHeight: 603},
            drawingBufferWidth: 801, drawingBufferHeight: 603,
            mapProjection: new GeographicProjection(), ellipsoid: Ellipsoid.WGS84,
            screenSpaceCameraController: {enableInputs: true, enableRotate: true, enableTilt: true},
            requestRender: vi.fn(),
        }
        const pivot = Cartesian3.fromDegrees(7.25, 46.7, depthPick ? 550 : 0)
        const camera = new Camera(scene)
        scene.camera = camera
        camera.update(SceneMode.SCENE3D)
        camera.lookAt(pivot, new HeadingPitchRange(0.58, pitch, 17000))
        camera.lookAtTransform(Matrix4.IDENTITY)
        if (depthPick) {
            camera.twistLeft(2.8)
            scene.pickPositionSupported = true
            scene.pickPosition = vi.fn(() => {
                // Simulate depth readback from a neighboring pixel.
                const offset = Cartesian3.multiplyByScalar(camera.rightWC, 2, new Cartesian3())
                return Cartesian3.add(pivot, offset, offset)
            })
        }
        lgs.scene = scene
        lgs.camera = camera
        const view = render(<ReplayCameraCamBall mainScene/>)
        const rim = view.getByRole('group', {name: 'Rotate camera with the grip ring'})
        const pad = view.getByRole('group', {name: /adjust pitch/})
        pad.getBoundingClientRect = () => ({left: 0, top: 0, width: 100, height: 100})
        const center = new Cartesian2(400.5, 301.5)
        const startRange = Cartesian3.distance(camera.positionWC, pivot)

        /** Check the original world point, not the location of a subsequent pick. */
        const expectStationaryPivot = () => {
            const projected = SceneTransforms.worldToWindowCoordinates(scene, pivot)
            expect(Cartesian2.distance(projected, center)).toBeLessThan(0.001)
            expect(Math.abs(Cartesian3.distance(camera.positionWC, pivot) - startRange)).toBeLessThan(0.001)
        }

        expectStationaryPivot()
        if (!depthPick) {
            const initialPitch = camera.pitch
            pointer(pad, 'pointerdown', 50, 50)
            pointer(pad, 'pointermove', 50, 30)
            await frame(40)
            expectStationaryPivot()
            await frame(80)
            expectStationaryPivot()
            pointer(pad, 'pointerup', 50, 30)
            expect(camera.pitch).toBeGreaterThan(initialPitch)
            expect(scene.requestRender).toHaveBeenCalledTimes(2)
            scene.requestRender.mockClear()
        }
        pointer(rim, 'pointerdown', 76, 54)
        pointer(rim, 'pointermove', 50, 79)
        expectStationaryPivot()
        pointer(rim, 'pointermove', 24, 54)
        expectStationaryPivot()
        pointer(rim, 'pointerup', 24, 54)
        expect(scene.requestRender).toHaveBeenCalledTimes(2)
        if (gesture === 'double click') {
            fireEvent.doubleClick(pad.querySelector('.replay-camera-cam-ball-dome-hit'))
        }
        else {
            for (const id of [2, 3]) {
                pointer(pad, 'pointerdown', 50, 50, id, false, 'touch')
                pointer(pad, 'pointerup', 50, 50, id, false, 'touch')
            }
        }
        expect(scene.requestRender).toHaveBeenCalledTimes(3)
        if (depthPick) expect(scene.pickPosition).toHaveBeenCalledTimes(2)
        expectStationaryPivot()
        expect(Math.min(camera.heading, 2 * Math.PI - camera.heading)).toBeLessThan(0.00001)
        const north = Cartesian3.fromDegrees(7.25, 46.701, depthPick ? 550 : 0)
        const projectedNorth = SceneTransforms.worldToWindowCoordinates(scene, north)
        expect(projectedNorth.x).toBeCloseTo(center.x, 3)
        expect(projectedNorth.y).toBeLessThan(center.y)
    })

    it('restores geographic north while keeping Replay pitch and altitude on double click or double tap', () => {
        const {replay, updatePreparationCamera} = install()
        lgs.camera = {heading: Math.PI}
        const view = render(<ReplayCameraCamBall/>)
        const pad = view.getByRole('group', {name: /adjust pitch/})
        const dome = pad.querySelector('.replay-camera-cam-ball-dome-hit')
        fireEvent.doubleClick(dome)
        expect(replay.camera).toEqual({altitude: 1200, pitch: -40, cameraAngle: -115})

        replay.camera.cameraAngle = 40
        lgs.camera.heading = Math.PI / 2
        updatePreparationCamera.mockClear()
        for (const id of [1, 2]) {
            pointer(pad, 'pointerdown', 50, 50, id, false, 'touch')
            pointer(pad, 'pointerup', 50, 50, id, false, 'touch')
            expect(updatePreparationCamera).toHaveBeenCalledTimes(id - 1)
        }
        fireEvent.doubleClick(dome)
        expect(updatePreparationCamera).toHaveBeenCalledOnce()
        expect(replay.camera).toEqual({altitude: 1200, pitch: -40, cameraAngle: -50})
    })

    it('clears keyboard focus when the user grabs the dome without blocking the drag', async () => {
        const {frame, updatePreparationCamera} = install()
        const view = render(<ReplayCameraCamBall/>)
        const pad = view.getByRole('group', {name: /adjust pitch/})
        pad.getBoundingClientRect = () => ({width: 100, height: 100})
        pad.focus()
        expect(document.activeElement).toBe(pad)
        pointer(pad, 'pointerdown', 50, 50)
        expect(document.activeElement).not.toBe(pad)
        pointer(pad, 'pointermove', 66, 50)
        await frame(40)
        expect(updatePreparationCamera).toHaveBeenCalledOnce()
    })

    it('rotates from the grip ring across the angle seam and stops on release', () => {
        const {replay, frames, updatePreparationCamera} = install()
        replay.camera.cameraAngle = -179
        const view = render(<ReplayCameraCamBall/>)
        const rim = view.getByRole('group', {name: 'Rotate camera with the grip ring'})
        const pad = rim.closest('.replay-camera-cam-ball-pad')
        pad.getBoundingClientRect = () => ({left: 0, top: 0, width: 100, height: 100})
        const marks = pad.querySelector('svg path')

        pointer(rim, 'pointerdown', 24, 55)
        pointer(rim, 'pointermove', 24, 55)
        expect(updatePreparationCamera).not.toHaveBeenCalled()
        pointer(rim, 'pointermove', 24, 53)
        expect(replay.camera.cameraAngle).toBeCloseTo(176.37, 1)
        expect(replay.camera.altitude).toBe(1200)
        const orientation = marks.getAttribute('transform')
        expect(orientation).toMatch(/^rotate\(4\./)
        pointer(rim, 'pointerup', 24, 53)
        pointer(rim, 'pointermove', 50, 15)
        expect(updatePreparationCamera).toHaveBeenCalledOnce()
        expect(marks.getAttribute('transform')).toBe(orientation)
        expect(frames.size).toBe(0)
    })

    it('points the crown chevron toward geographic north as the map turns', () => {
        const {video} = install()
        video.editing = false
        const remove = vi.fn()
        const addEventListener = vi.fn(() => remove)
        lgs.camera = {heading: Math.PI / 2}
        lgs.scene = {postRender: {addEventListener}}
        const view = render(<ReplayCameraCamBall mainScene/>)
        const marks = view.container.querySelector('svg path')
        const north = view.container.querySelector('.replay-camera-cam-ball-north-mark')
        expect(marks.getAttribute('transform')).toBe('rotate(-90)')
        expect(north.getAttribute('transform')).toBe('rotate(-90)')
        lgs.camera.heading = 3 * Math.PI / 2
        addEventListener.mock.calls[0][0]()
        expect(marks.getAttribute('transform')).toBe('rotate(90)')
        expect(north.getAttribute('transform')).toBe('rotate(90)')
        view.unmount()
        expect(remove).toHaveBeenCalledOnce()
    })

    it('uses one geographic pivot and preserves the main camera range during crown rotation', () => {
        const {video, updatePreparationCamera} = install()
        video.editing = false
        const pivot = Cartesian3.fromDegrees(0, 0)
        const positionWC = Cartesian3.add(pivot, new Cartesian3(100, 0, -100), new Cartesian3())
        const directionWC = Cartesian3.normalize(new Cartesian3(-1, 0, 1), new Cartesian3())
        const upWC = new Cartesian3(0, 1, 0)
        lgs.camera = {
            positionWC, directionWC, upWC,
            position: positionWC, direction: directionWC, up: upWC, right: new Cartesian3(),
            inverseTransform: Matrix4.IDENTITY,
            getPickRay: vi.fn(),
        }
        lgs.scene = {
            mode: SceneMode.SCENE3D, canvas: {clientWidth: 800, clientHeight: 600},
            ellipsoid: Ellipsoid.WGS84, pickPositionSupported: true, pickPosition: vi.fn(() => pivot),
            screenSpaceCameraController: {enableInputs: true, enableRotate: true},
            requestRender: vi.fn(),
        }
        const view = render(<ReplayCameraCamBall mainScene/>)
        const rim = view.getByRole('group', {name: 'Rotate camera with the grip ring'})
        rim.closest('.replay-camera-cam-ball-pad').getBoundingClientRect = () => ({left: 0, top: 0, width: 100, height: 100})
        pointer(rim, 'pointerdown', 76, 54)
        pointer(rim, 'pointermove', 50, 79)
        expect(lgs.camera.positionWC.y).toBeCloseTo(100)
        pointer(rim, 'pointermove', 24, 54)
        expect(lgs.scene.pickPosition).toHaveBeenCalledOnce()
        expect(lgs.scene.requestRender).toHaveBeenCalledTimes(2)
        expect(Cartesian3.distance(lgs.camera.positionWC, pivot)).toBeCloseTo(Math.sqrt(20000))
        const towardPivot = Cartesian3.subtract(pivot, lgs.camera.positionWC, new Cartesian3())
        Cartesian3.normalize(towardPivot, towardPivot)
        expect(Cartesian3.dot(towardPivot, lgs.camera.directionWC)).toBeCloseTo(1)
        expect(updatePreparationCamera).not.toHaveBeenCalled()
    })

    it('uses the map-selected pivot for CamBall pitch without owning the map reticle', async () => {
        const {frame, video} = install()
        video.editing = false
        const canvas = document.createElement('canvas')
        Object.defineProperties(canvas, {
            clientWidth: {value: 800},
            clientHeight: {value: 600},
        })
        const canvasParent = document.createElement('div')
        canvasParent.className = 'replay-pivot-test-canvas-parent'
        Object.defineProperties(canvasParent, {
            clientWidth: {value: 800},
            clientHeight: {value: 600},
        })
        canvasParent.append(canvas)
        document.body.append(canvasParent)
        canvasParent.getBoundingClientRect = () => ({left: 20, top: 30, right: 420, bottom: 330, width: 400, height: 300})
        canvas.getBoundingClientRect = () => ({left: 20, top: 30, right: 420, bottom: 330, width: 400, height: 300})
        const initialPivot = Cartesian3.fromDegrees(7.25, 46.7)
        const scene = {
            mode: SceneMode.SCENE3D, frameState: {mode: SceneMode.SCENE3D},
            canvas, drawingBufferWidth: 800, drawingBufferHeight: 600,
            mapProjection: new GeographicProjection(), ellipsoid: Ellipsoid.WGS84,
            screenSpaceCameraController: {enableInputs: true, enableRotate: true, enableTilt: true},
            pickPositionSupported: true, requestRender: vi.fn(),
        }
        const camera = new Camera(scene)
        scene.camera = camera
        camera.update(SceneMode.SCENE3D)
        camera.lookAt(initialPivot, new HeadingPitchRange(0.7, -0.8, 17000))
        camera.lookAtTransform(Matrix4.IDENTITY)
        scene.pickPosition = vi.fn(position => camera.pickEllipsoid(position, Ellipsoid.WGS84))
        scene.postRender = {addEventListener: vi.fn(() => vi.fn())}
        const selectedPivot = Cartesian3.fromDegrees(7.3, 46.75, 500)
        setMainSceneCameraPivot(scene, camera, selectedPivot)
        lgs.scene = scene
        lgs.camera = camera
        const view = render(<ReplayCameraCamBall mainScene/>)
        const pad = view.getByRole('group', {name: /adjust pitch/})
        pad.getBoundingClientRect = () => ({left: 0, top: 0, width: 100, height: 100})
        expect(getMainSceneCameraPivot(scene, camera)).toEqual(selectedPivot)
        const selectedRange = Cartesian3.distance(camera.positionWC, selectedPivot)
        const initialRange = Cartesian3.distance(camera.positionWC, initialPivot)
        pointer(pad, 'pointerdown', 50, 50)
        pointer(pad, 'pointermove', 50, 30)
        await frame(40)
        expect(Cartesian3.distance(camera.positionWC, selectedPivot)).toBeCloseTo(selectedRange, 5)
        expect(Cartesian3.distance(camera.positionWC, initialPivot)).not.toBeCloseTo(initialRange, 2)
        pointer(pad, 'pointerup', 50, 30)

        view.unmount()
        canvasParent.remove()
    })

    it('controls the main scene without a journey and relinquishes input during Replay preparation', async () => {
        const {main, video, updatePreparationCamera} = install()
        main.theJourney = null
        video.editing = false
        lgs.camera = {positionCartographic: {height: 500}, zoomIn: vi.fn()}
        lgs.scene = {
            mode: SceneMode.SCENE3D,
            screenSpaceCameraController: {
                enableInputs: true, enableZoom: true,
                minimumZoomDistance: 1, maximumZoomDistance: Infinity,
            },
            requestRender: vi.fn(),
        }
        const view = render(<ReplayCameraCamBall mainScene/>)
        const pad = view.getByRole('group', {name: /adjust pitch/})
        fireEvent.keyDown(pad, {key: 'ArrowRight'})
        expect(lgs.camera.zoomIn.mock.calls[0][0]).toBeGreaterThan(0)
        expect(lgs.scene.requestRender).toHaveBeenCalledOnce()
        expect(updatePreparationCamera).not.toHaveBeenCalled()
        await act(async () => { video.editing = true })
        expect(view.queryByRole('group', {name: /adjust pitch/})).toBeNull()
    })

    it('stops the startup orbit on the first dome gesture and applies that gesture to the map', async () => {
        const {frame, video, updatePreparationCamera} = install()
        video.editing = false
        const rotate = {running: true}
        lgs.stores.ui.mainUI = {rotate}
        __.ui.cameraManager = {
            stopRotate: vi.fn(async () => { rotate.running = false }),
        }
        lgs.camera = {positionCartographic: {height: 500}, zoomIn: vi.fn()}
        lgs.scene = {
            mode: SceneMode.SCENE3D,
            screenSpaceCameraController: {
                enableInputs: true, enableZoom: true, minimumZoomDistance: 1, maximumZoomDistance: Infinity,
            },
            requestRender: vi.fn(),
        }
        const view = render(<ReplayCameraCamBall mainScene/>)
        const pad = view.getByRole('group', {name: /adjust pitch/})
        pad.getBoundingClientRect = () => ({width: 100, height: 100})

        fireEvent.pointerDown(pad, {button: 0})
        expect(__.ui.cameraManager.stopRotate).not.toHaveBeenCalled()
        pointer(pad, 'pointerdown', 50, 50)
        pointer(pad, 'pointermove', 65, 50)
        await frame(40)

        expect(__.ui.cameraManager.stopRotate).toHaveBeenCalledOnce()
        expect(lgs.camera.zoomIn.mock.calls[0][0]).toBeGreaterThan(0)
        expect(updatePreparationCamera).not.toHaveBeenCalled()
    })

    it('leaves the area outside the dome and crown available for widget dragging', () => {
        const {frames, updatePreparationCamera} = install()
        const view = render(<ReplayCameraCamBall/>)
        const pad = view.getByLabelText('Drag up or down to adjust pitch, and left or right to zoom')
        const sphere = view.container.querySelector('.replay-camera-cam-ball')
        const hostDrag = vi.fn()
        sphere.addEventListener('pointerdown', hostDrag)
        try {
            fireEvent(pad, new Event('pointerdown', {bubbles: true, cancelable: true}))
            expect(hostDrag).toHaveBeenCalledOnce()
            expect(pad.closest('.lgs-widget-no-drag')).toBeNull()
            expect(pad.querySelector('.replay-camera-cam-ball-dome-hit').classList.contains('lgs-widget-no-drag')).toBe(true)
            expect(frames.size).toBe(0)
            expect(updatePreparationCamera).not.toHaveBeenCalled()
        }
        finally { sphere.removeEventListener('pointerdown', hostDrag) }
    })

    it.each(['horizontal', 'vertical'])('locks Ctrl dragging to its initial %s axis and unlocks without a jump', async axis => {
        const {frame, replay} = install()
        const view = render(<ReplayCameraCamBall/>)
        const pad = view.getByLabelText('Drag up or down to adjust pitch, and left or right to zoom')
        pad.getBoundingClientRect = () => ({left: 0, top: 0, width: 100, height: 100})
        pointer(pad, 'pointerdown', 50, 50, 1, true)
        const horizontal = axis === 'horizontal'
        pointer(pad, 'pointermove', horizontal ? 70 : 53, horizontal ? 53 : 70, 1, true)
        await frame(40)
        if (horizontal) {
            expect(replay.camera.altitude).toBeLessThan(1200)
            expect(replay.camera.pitch).toBe(-40)
        }
        else {
            expect(replay.camera.pitch).toBeLessThan(-40)
            expect(replay.camera.altitude).toBe(1200)
        }
        pointer(pad, 'pointermove', horizontal ? 80 : 53, horizontal ? 53 : 80, 1, true)
        await frame(80)
        const crossAxisIcon = horizontal ? '.action-top, .action-bottom' : '.action-left, .action-right'
        expect(pad.querySelector(crossAxisIcon)).toBeNull()
        expect(horizontal ? replay.camera.pitch : replay.camera.altitude).toBe(horizontal ? -40 : 1200)
        const pose = {...replay.camera}
        pointer(pad, 'pointermove', horizontal ? 80 : 53, horizontal ? 53 : 80, 1, false)
        expect(replay.camera).toEqual(pose)
        pointer(pad, 'pointermove', 80, 80, 1, false)
        await frame(160)
        expect(horizontal ? replay.camera.pitch : replay.camera.altitude).not.toBe(horizontal ? pose.pitch : pose.altitude)
    })

    it('keeps the dome display while starting each new drag from its own origin', async () => {
        const {frame, replay} = install()
        const view = render(<ReplayCameraCamBall/>)
        const pad = view.getByLabelText('Drag up or down to adjust pitch, and left or right to zoom')
        pad.getBoundingClientRect = () => ({left: 0, top: 0, width: 100, height: 100})
        expect(view.container.querySelector('[data-icon]')).toBeNull()
        pointer(pad, 'pointerdown', 54, 50)
        pointer(pad, 'pointermove', 90, 50)
        expect(view.container.querySelector('[data-icon="magnifying-glass-plus"]')).not.toBeNull()
        expect(view.container.querySelector('[data-icon="arrow-rotate-right"]')).toBeNull()
        await frame(0)
        pointer(pad, 'pointerup', 90, 50)
        expect(view.container.querySelector('[data-icon]')).toBeNull()

        const releasedAltitude = replay.camera.altitude
        pointer(pad, 'pointerdown', 90, 50)
        pointer(pad, 'pointerup', 90, 50)
        expect(replay.camera.altitude).toBe(releasedAltitude)

        pointer(pad, 'pointerdown', 90, 50)
        pointer(pad, 'pointermove', 80, 50)
        await frame(40)
        expect(replay.camera.altitude).toBeGreaterThan(releasedAltitude)
        pointer(pad, 'pointerup', 80, 50)
    })

    it('starts a fresh pitch drag after a zoom drag', async () => {
        const {frame, replay} = install()
        const view = render(<ReplayCameraCamBall/>)
        const pad = view.getByLabelText('Drag up or down to adjust pitch, and left or right to zoom')
        pad.getBoundingClientRect = () => ({left: 0, top: 0, width: 100, height: 100})

        pointer(pad, 'pointerdown', 50, 50)
        pointer(pad, 'pointermove', 90, 50)
        await frame(0)
        pointer(pad, 'pointerup', 90, 50)
        const zoomedAltitude = replay.camera.altitude

        pointer(pad, 'pointerdown', 90, 50)
        pointer(pad, 'pointermove', 90, 40)
        await frame(40)

        expect(replay.camera.altitude).toBe(zoomedAltitude)
        expect(replay.camera.pitch).toBeGreaterThan(-40)
        expect(view.container.querySelector('.action-top')).not.toBeNull()
        pointer(pad, 'pointerup', 90, 40)
    })

    it.each([
        {axis: 'pitch', first: [50, 30], reverse: [[50, 31]]},
        {axis: 'zoom', first: [70, 50], reverse: [[69, 50]]},
    ])('reverses a held $axis drag on the next movement', async ({axis, first, reverse}) => {
        const {frame, replay} = install()
        const view = render(<ReplayCameraCamBall/>)
        const pad = view.getByLabelText('Drag up or down to adjust pitch, and left or right to zoom')
        pad.getBoundingClientRect = () => ({left: 0, top: 0, width: 100, height: 100})
        const readValue = () => axis === 'pitch' ? replay.camera.pitch : replay.camera.altitude

        pointer(pad, 'pointerdown', 50, 50)
        pointer(pad, 'pointermove', ...first)
        await frame(0)
        await frame(100)
        const valueBeforeReverse = readValue()
        for (const position of reverse) pointer(pad, 'pointermove', ...position)
        await frame(200)

        if (axis === 'pitch') expect(readValue()).toBeLessThan(valueBeforeReverse)
        else expect(readValue()).toBeGreaterThan(valueBeforeReverse)
        pointer(pad, 'pointerup', ...reverse[reverse.length - 1])
    })

    it.each([
        {from: 'pitch', first: [50, 70], next: [60, 70], to: 'zoom'},
        {from: 'zoom', first: [70, 50], next: [70, 60], to: 'pitch'},
    ])('switches a held $from drag to $to without retaining the previous axis', async ({from, first, next}) => {
        const {frame, replay} = install()
        const view = render(<ReplayCameraCamBall/>)
        const pad = view.getByLabelText('Drag up or down to adjust pitch, and left or right to zoom')
        pad.getBoundingClientRect = () => ({left: 0, top: 0, width: 100, height: 100})

        pointer(pad, 'pointerdown', 50, 50)
        pointer(pad, 'pointermove', ...first)
        await frame(0)
        await frame(40)
        const beforeSwitch = {...replay.camera}

        pointer(pad, 'pointermove', ...next)
        await frame(80)

        if (from === 'pitch') {
            expect(replay.camera.pitch).toBe(beforeSwitch.pitch)
            expect(replay.camera.altitude).toBeLessThan(beforeSwitch.altitude)
            expect(pad.querySelector('.action-right')).not.toBeNull()
            expect(pad.querySelector('.action-top, .action-bottom')).toBeNull()
        }
        else {
            expect(replay.camera.altitude).toBe(beforeSwitch.altitude)
            expect(replay.camera.pitch).toBeLessThan(beforeSwitch.pitch)
            expect(pad.querySelector('.action-top, .action-bottom')).not.toBeNull()
            expect(pad.querySelector('.action-left, .action-right')).toBeNull()
        }

        pointer(pad, 'pointerup', ...next)
    })

    it('switches from zoom to pitch at 45 degrees, consumes pointer input, and stops on release', async () => {
        const {frame, frames, replay, updatePreparationCamera} = install()
        const view = render(<ReplayCameraCamBall/>)
        const pad = view.getByLabelText('Drag up or down to adjust pitch, and left or right to zoom')
        pad.getBoundingClientRect = () => ({left: 0, top: 0, width: 116, height: 116})
        const bubbled = vi.fn()
        document.addEventListener('pointerdown', bubbled)
        try {
            pointer(pad, 'pointerdown', 50, 50)
            expect(bubbled).not.toHaveBeenCalled()
            await frame(0)
            expect(updatePreparationCamera).not.toHaveBeenCalled()
            pointer(pad, 'pointermove', 65, 35)
            await frame(40)
            expect(updatePreparationCamera).toHaveBeenCalledOnce()
            expect(replay.camera.altitude).toBeLessThan(1200)
            expect(replay.camera.pitch).toBe(-40)
            expect(replay.camera.cameraAngle).toBe(65)
            const pose = {...replay.camera}
            await frame(80)
            expect(replay.camera.altitude).toBeLessThan(pose.altitude)
            expect(replay.camera.pitch).toBe(pose.pitch)
            const heldPose = {...replay.camera}
            pointer(pad, 'pointermove', 64, 35)
            await frame(120)
            expect(replay.camera.altitude).toBe(heldPose.altitude)
            expect(replay.camera.pitch).toBeGreaterThan(heldPose.pitch)
            pointer(pad, 'pointerup', 64, 35)
            expect(frames.size).toBe(0)
            const releasedPose = {...replay.camera}
            const releasedCallCount = updatePreparationCamera.mock.calls.length
            await frame(2000)
            expect(replay.camera).toEqual(releasedPose)
            expect(updatePreparationCamera).toHaveBeenCalledTimes(releasedCallCount)
            expect(view.container.querySelector('[data-icon]')).toBeNull()
        }
        finally { document.removeEventListener('pointerdown', bubbled) }
    })

    it.each([
        {dx: 16, dy: 15, zoom: -1, tilt: 0},
        {dx: -16, dy: -15, zoom: 1, tilt: 0},
        {dx: 15, dy: 16, zoom: 0, tilt: -1},
        {dx: -15, dy: -16, zoom: 0, tilt: 1},
    ])('applies only the dominant axis for movement ($dx, $dy)', ({dx, dy, zoom, tilt}) => {
        const {replay} = install()
        const view = render(<ReplayCameraCamBall/>)
        const pad = view.getByRole('group', {name: /adjust pitch/})
        pad.getBoundingClientRect = () => ({width: 100, height: 100})
        pointer(pad, 'pointerdown', 50, 50)
        pointer(pad, 'pointermove', 50 + dx, 50 + dy)
        pointer(pad, 'pointerup', 50 + dx, 50 + dy)
        expect(Math.sign(replay.camera.altitude - 1200)).toBe(zoom)
        expect(Math.sign(replay.camera.pitch + 40)).toBe(tilt)
    })

    it('stops a held adjustment when the pointer returns to its starting point', async () => {
        const {frames, frame, replay} = install()
        const view = render(<ReplayCameraCamBall/>)
        const pad = view.getByLabelText('Drag up or down to adjust pitch, and left or right to zoom')
        pad.getBoundingClientRect = () => ({left: 0, top: 0, width: 100, height: 100})
        pointer(pad, 'pointerdown', 50, 50)
        pointer(pad, 'pointermove', 70, 30)
        await frame(0)
        await frame(40)
        pointer(pad, 'pointermove', 50, 50)
        const centeredPose = {...replay.camera}
        expect(frames.size).toBe(0)
        await frame(80)
        expect(replay.camera).toEqual(centeredPose)
        expect(view.container.querySelector('[data-icon]')).toBeNull()
    })

    it('stops a drag when the pointer leaves the circular CamBall surface', async () => {
        const {frames, frame, replay} = install()
        const view = render(<ReplayCameraCamBall/>)
        const pad = view.getByLabelText('Drag up or down to adjust pitch, and left or right to zoom')
        pad.getBoundingClientRect = () => ({left: 0, top: 0, width: 100, height: 100})

        pointer(pad, 'pointerdown', 50, 50)
        pointer(pad, 'pointermove', 70, 50)
        await frame(0)
        const poseBeforeExit = {...replay.camera}
        expect(frames.size).toBe(1)

        // The point remains inside the square bounds but is outside the ball's circle.
        pointer(pad, 'pointermove', 90, 90)
        expect(frames.size).toBe(0)
        await frame(40)
        expect(replay.camera).toEqual(poseBeforeExit)
        pointer(pad, 'pointerup', 90, 90)
    })

    it('keeps the held adjustment rate independent of animation frame frequency', async () => {
        const poses = []
        for (const fps of [30, 60]) {
            const {frame, replay} = install()
            const view = render(<ReplayCameraCamBall/>)
            const pad = view.getByLabelText('Drag up or down to adjust pitch, and left or right to zoom')
            pad.getBoundingClientRect = () => ({left: 0, top: 0, width: 100, height: 100})
            pointer(pad, 'pointerdown', 50, 50)
            pointer(pad, 'pointermove', 70, 30)
            await frame(0)
            for (let index = 1; index <= fps; index++) await frame(index * 1000 / fps)
            pointer(pad, 'pointerup', 70, 30)
            poses.push({...replay.camera})
            view.unmount()
        }
        expect(poses[0].altitude).toBeCloseTo(poses[1].altitude, 8)
        expect(poses[0].pitch).toBeCloseTo(poses[1].pitch, 8)
        expect(poses.map(pose => pose.cameraAngle)).toEqual([65, 65])
    })

    it('offers focus-scoped keyboard axes with bounded values and no visible buttons or text', async () => {
        const {replay} = install()
        const view = render(<ReplayCameraCamBall/>)
        const pad = view.getByLabelText('Drag up or down to adjust pitch, and left or right to zoom')
        expect(view.container.textContent).toBe('')
        expect(view.container.querySelector('button, wa-button, small, strong')).toBeNull()
        await act(async () => fireEvent.keyDown(pad, {key: 'ArrowDown'}))
        expect(replay.camera.altitude).toBe(1200)
        expect(replay.camera.pitch).toBeLessThan(-40)
        const loweredPitch = replay.camera.pitch
        await act(async () => fireEvent.keyDown(pad, {key: 'ArrowUp'}))
        expect(replay.camera.pitch).toBeGreaterThan(loweredPitch)
        const pitch = replay.camera.pitch
        await act(async () => fireEvent.keyDown(pad, {key: 'ArrowLeft'}))
        expect(replay.camera.altitude).toBeGreaterThan(1200)
        expect(replay.camera.pitch).toBe(pitch)
        await act(async () => { replay.camera.altitude = 100000
            replay.camera.pitch = -89 })
        await act(async () => fireEvent.keyDown(pad, {key: 'ArrowDown'}))
        await act(async () => fireEvent.keyDown(pad, {key: 'ArrowLeft'}))
        expect(replay.camera.altitude).toBe(100000)
        expect(replay.camera.pitch).toBe(-89)
        await act(async () => { replay.camera.altitude = 10 })
        await act(async () => { replay.camera.pitch = -5 })
        await act(async () => fireEvent.keyDown(pad, {key: 'ArrowUp'}))
        expect(replay.camera.altitude).toBe(10)
        expect(replay.camera.pitch).toBe(-5)
    })

    it.each([
        {key: 'ArrowRight', x: 70, y: 50, field: 'altitude'},
        {key: 'ArrowUp', x: 50, y: 30, field: 'pitch'},
    ])('uses finer Ctrl adjustments for $field with pointer and keyboard', async ({key, x, y, field}) => {
        const {frame, replay} = install()
        const view = render(<ReplayCameraCamBall/>)
        const pad = view.getByRole('group', {name: /adjust pitch/})
        pad.getBoundingClientRect = () => ({width: 100, height: 100})
        /** Compare zoom in log space because zoom is distance-relative. */
        const readValue = () => field === 'altitude' ? Math.log(replay.camera.altitude) : replay.camera.pitch
        const startingValue = readValue()
        fireEvent.keyDown(pad, {key})
        const normalStep = Math.abs(readValue() - startingValue)
        const beforeFineKey = readValue()
        fireEvent.keyDown(pad, {key, ctrlKey: true})
        expect(Math.abs(readValue() - beforeFineKey) / normalStep).toBeCloseTo(0.35)
        fireEvent.keyUp(pad, {key})

        pointer(pad, 'pointerdown', 50, 50)
        pointer(pad, 'pointermove', x, y)
        await frame(0)
        const beforeNormal = readValue()
        await frame(40)
        const normalDrag = Math.abs(readValue() - beforeNormal)
        fireEvent.keyDown(window, {key: 'Control', ctrlKey: true})
        const beforeFine = readValue()
        await frame(80)
        expect(Math.abs(readValue() - beforeFine) / normalDrag).toBeCloseTo(0.35)
        fireEvent.keyUp(window, {key: 'Control'})
        const beforeRelease = readValue()
        await frame(120)
        expect(Math.abs(readValue() - beforeRelease)).toBeCloseTo(normalDrag)
    })

    it('flushes a short drag on release without leaving a queued camera update', async () => {
        const {frames, frame, replay, updatePreparationCamera} = install()
        const view = render(<ReplayCameraCamBall/>)
        const pad = view.getByLabelText('Drag up or down to adjust pitch, and left or right to zoom')
        pad.getBoundingClientRect = () => ({left: 0, top: 0, width: 100, height: 100})
        pointer(pad, 'pointerdown', 50, 50)
        pointer(pad, 'pointermove', 70, 30)
        expect(updatePreparationCamera).not.toHaveBeenCalled()
        pointer(pad, 'pointerup', 70, 30)
        expect(updatePreparationCamera).toHaveBeenCalledOnce()
        expect(frames.size).toBe(0)
        const altitude = replay.camera.altitude
        await frame(5000)
        expect(replay.camera.altitude).toBe(altitude)
        expect(updatePreparationCamera).toHaveBeenCalledOnce()
    })

    it.each(['preRecording', 'exporting', 'snapshot', 'finalizing'])('hides and cancels queued input when %s starts', async field => {
        const {video, frames, frame, updatePreparationCamera} = install()
        const view = render(<ReplayCameraCamBall/>)
        const pad = view.getByLabelText('Drag up or down to adjust pitch, and left or right to zoom')
        pad.getBoundingClientRect = () => ({left: 0, top: 0, width: 116, height: 116})
        pointer(pad, 'pointerdown', 85, 30)
        pointer(pad, 'pointermove', 90, 25)
        await act(async () => { video[field] = true })
        await frame(100)
        expect(view.queryByLabelText('Drag up or down to adjust pitch, and left or right to zoom')).toBeNull()
        expect(frames.size).toBe(0)
        expect(updatePreparationCamera).not.toHaveBeenCalled()
    })

    it('stops on pointer cancellation, blur, journey replacement, and unmount', async () => {
        const {frames, main} = install()
        const view = render(<ReplayCameraCamBall/>)
        const pad = view.getByLabelText('Drag up or down to adjust pitch, and left or right to zoom')
        pad.getBoundingClientRect = () => ({left: 0, top: 0, width: 116, height: 116})
        pointer(pad, 'pointerdown', 85, 30)
        pointer(pad, 'pointermove', 90, 25)
        pointer(pad, 'pointercancel', 85, 30)
        expect(frames.size).toBe(0)
        pointer(pad, 'pointerdown', 85, 30)
        pointer(pad, 'pointermove', 90, 25)
        fireEvent(window, new Event('blur'))
        expect(frames.size).toBe(0)
        pointer(pad, 'pointerdown', 85, 30)
        pointer(pad, 'pointermove', 90, 25)
        await act(async () => { main.theJourney = {slug: 'journey-b'} })
        expect(frames.size).toBe(0)
        pointer(pad, 'pointerdown', 85, 30)
        pointer(pad, 'pointermove', 90, 25)
        view.unmount()
        expect(frames.size).toBe(0)
    })

    it.each(['active', 'playing', 'paused', 'clipSequenceActive'])('blocks CamBall input during Replay %s', async field => {
        const {replay, frames, updatePreparationCamera} = install()
        const view = render(<ReplayCameraCamBall/>)
        await act(async () => { replay[field] = true })
        expect(view.queryByLabelText('Drag up or down to adjust pitch, and left or right to zoom')).toBeNull()
        expect(frames.size).toBe(0)
        expect(updatePreparationCamera).not.toHaveBeenCalled()
    })
})
