/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: camera-target-pivot.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-24
 * Last modified: 2026-11-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {act, cleanup, fireEvent, render} from '@testing-library/react'
import {Camera, Cartesian3, Ellipsoid, GeographicProjection, HeadingPitchRange, Matrix4, SceneMode} from 'cesium'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'
import {CameraTarget} from '@Components/MainUI/CameraTarget'
import {getMainSceneCameraPivot} from '@Core/ui/MainSceneCameraPivot'

vi.mock('@awesome.me/webawesome/dist/react', () => ({
    WaIcon: ({name, ...props}) => <span data-icon={name} {...props}/>,
}))

const pointer = (target, type, x, y, {pointerId = 1, shiftKey = false} = {}) => {
    const event = new Event(type, {bubbles: true, cancelable: true})
    Object.defineProperties(event, {
        pointerId: {value: pointerId},
        pointerType: {value: 'mouse'},
        button: {value: 0},
        shiftKey: {value: shiftKey},
        clientX: {value: x},
        clientY: {value: y},
    })
    fireEvent(target, event)
}

afterEach(() => {
    cleanup()
    document.body.replaceChildren()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('Cesium camera pivot marker', () => {
    it('moves the map pivot by Shift-dragging the center reticle, independently of the CamBall', async () => {
        const canvas = document.createElement('canvas')
        Object.defineProperties(canvas, {
            clientWidth: {value: 800},
            clientHeight: {value: 600},
        })
        const mapSurface = document.createElement('div')
        Object.defineProperties(mapSurface, {
            clientWidth: {value: 800},
            clientHeight: {value: 600},
        })
        mapSurface.append(canvas)
        document.body.append(mapSurface)
        mapSurface.getBoundingClientRect = () => ({left: 100, top: 50, right: 900, bottom: 650, width: 800, height: 600})
        canvas.getBoundingClientRect = () => ({left: 100, top: 50, right: 900, bottom: 650, width: 800, height: 600})

        const mainUI = document.createElement('div')
        Object.defineProperties(mainUI, {
            clientWidth: {value: 1000},
            clientHeight: {value: 800},
        })
        mainUI.getBoundingClientRect = () => ({left: 0, top: 0, right: 1000, bottom: 800, width: 1000, height: 800})
        document.body.append(mainUI)

        const scene = {
            mode: SceneMode.SCENE3D,
            frameState: {mode: SceneMode.SCENE3D},
            canvas,
            drawingBufferWidth: 800,
            drawingBufferHeight: 600,
            mapProjection: new GeographicProjection(),
            ellipsoid: Ellipsoid.WGS84,
            screenSpaceCameraController: {enableInputs: true},
            pickPositionSupported: true,
            requestRender: vi.fn(),
        }
        const camera = new Camera(scene)
        scene.camera = camera
        camera.update(SceneMode.SCENE3D)
        camera.lookAt(Cartesian3.fromDegrees(7.25, 46.7), new HeadingPitchRange(0.7, -0.8, 17000))
        camera.lookAtTransform(Matrix4.IDENTITY)
        const selectedPosition = Cartesian3.fromDegrees(7.3, 46.75, 500)
        scene.pickPosition = vi.fn(() => selectedPosition)
        let refreshMarker
        scene.postRender = {addEventListener: vi.fn(callback => {
            refreshMarker = callback
            return vi.fn()
        })}
        vi.stubGlobal('lgs', {
            scene,
            camera,
            stores: {ui: {video: {}, mainUI: {}, replay: {}}},
            settings: {ui: proxy({camera: {targetIcon: {show: true, size: '3rem', color: 'white', background: 'transparent'}}})},
        })

        const view = render(<CameraTarget/>, {container: mainUI})
        const marker = view.container.querySelector('#camera-target')
        Object.defineProperties(marker, {
            offsetWidth: {value: 48},
            offsetHeight: {value: 48},
        })
        marker.getBoundingClientRect = () => ({left: 476, top: 326, right: 524, bottom: 374, width: 48, height: 48})
        await act(async () => refreshMarker?.())

        const mapPointerDown = vi.fn()
        canvas.addEventListener('pointerdown', mapPointerDown)
        pointer(canvas, 'pointerdown', 530, 350, {pointerId: 7, shiftKey: true})
        expect(marker.classList.contains('is-pivot-grabbed')).toBe(true)
        expect(marker.classList.contains('is-pivot-dragging')).toBe(false)
        expect(mapPointerDown).not.toHaveBeenCalled()

        pointer(canvas, 'pointermove', 560, 380, {pointerId: 7, shiftKey: true})
        expect(marker.classList.contains('is-pivot-grabbed')).toBe(false)
        expect(marker.classList.contains('is-pivot-dragging')).toBe(true)
        pointer(canvas, 'pointerup', 560, 380, {pointerId: 7, shiftKey: true})

        expect(scene.pickPosition).toHaveBeenCalledOnce()
        expect(scene.pickPosition.mock.calls[0][0].x).toBeCloseTo(430)
        expect(scene.pickPosition.mock.calls[0][0].y).toBeCloseTo(330)
        expect(Cartesian3.equals(getMainSceneCameraPivot(scene, camera), selectedPosition)).toBe(true)
        expect(marker.classList.contains('is-pivot-dragging')).toBe(false)
        expect(scene.requestRender).toHaveBeenCalledOnce()
        canvas.removeEventListener('pointerdown', mapPointerDown)
    })
})
