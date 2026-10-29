/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-preparation-cone-crop.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-15
 * Last modified: 2026-10-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, describe, expect, it, vi} from 'vitest'
import {Camera, Cartesian3, Ellipsoid, Event, GeographicProjection, HeadingPitchRange, SceneMode} from 'cesium'
import {VIDEO_CROP_ZONE} from '@Core/constants'
import {
    mountJourneyReplayCameraAngleGuide,
    removeJourneyReplayCameraAngleGuide,
    resolveJourneyReplayCameraAngleGuide,
    updateJourneyReplayCameraAngleGuide,
} from '@Core/ui/replay/JourneyReplayCameraAngleGuide'

const cleanups = []

afterEach(() => {
    cleanups.splice(0).forEach(cleanup => cleanup())
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

/** Install the production guide over a real Cesium Camera with a CSS-sized crop. */
const installPreparationGuide = ({supplyCrop = true, altitude = 1200} = {}) => {
    const container = document.createElement('div')
    const canvas = document.createElement('canvas')
    const crop = document.createElement('div')
    crop.id = VIDEO_CROP_ZONE
    container.append(canvas, crop)
    document.body.append(container)
    const surface = {left: 120, top: 80, width: 1000, height: 800, right: 1120, bottom: 880}
    let cropBounds = {left: 200, top: 160, width: 840, height: 640, right: 1040, bottom: 800}
    container.getBoundingClientRect = () => surface
    canvas.getBoundingClientRect = () => surface
    crop.getBoundingClientRect = () => cropBounds
    Object.defineProperties(canvas, {
        clientWidth: {value: 1000},
        clientHeight: {value: 800},
    })
    canvas.width = 2000
    canvas.height = 1600
    const scene = {
        mode: SceneMode.SCENE3D,
        canvas,
        mapProjection: new GeographicProjection(Ellipsoid.WGS84),
        ellipsoid: Ellipsoid.WGS84,
        drawingBufferWidth: 2000,
        drawingBufferHeight: 1600,
        pixelRatio: 2,
        globe: {getHeight: () => 120},
        postRender: new Event(),
        requestRender: vi.fn(),
        screenSpaceCameraController: {enableRotate: true},
    }
    const camera = new Camera(scene)
    scene.camera = camera
    camera.update(SceneMode.SCENE3D)
    camera.frustum.aspectRatio = 1.25
    const departure = Cartesian3.fromDegrees(2, 48, 120)
    const viewer = {container, scene, camera, canvas}
    const journey = {tracks: new Map([['track', {
        content: {geometry: {type: 'LineString', coordinates: [[2, 48, 120], [2.0002, 48.0002, 120]]}},
    }]])}
    const guide = resolveJourneyReplayCameraAngleGuide({journey, camera: {altitude, cameraAngle: 55}})
    const onCameraChange = vi.fn()

    /** Change map zoom without changing the prepared Replay configuration. */
    const setMapView = (range, pitch = -1.2, heading = 0) => {
        camera.lookAt(departure, new HeadingPitchRange(heading, pitch, range))
        camera.changed.raiseEvent()
        scene.postRender.raiseEvent(scene)
    }
    setMapView(8000)
    expect(mountJourneyReplayCameraAngleGuide(viewer, guide, {}, {
        screenLocked: true,
        cropElement: supplyCrop ? crop : null,
        onCameraChange,
    })).toBe(true)
    const overlay = container.querySelector('.replay-camera-angle-guide-dom')
    overlay.getBoundingClientRect = () => surface
    updateJourneyReplayCameraAngleGuide(viewer, guide)
    cleanups.push(() => {
        removeJourneyReplayCameraAngleGuide(viewer)
        container.remove()
    })

    /** Read the actual SVG and icon coordinates produced by the mounted guide. */
    const readGuide = () => {
        const axis = overlay.querySelector('[data-part="camera-position-axis"]')
        const tip = overlay.querySelector('[data-part="cone-tip-drag-target"]')
        const coordinates = overlay.querySelector('[data-part="outer"]').getAttribute('d')
            .match(/^M ([\d.e+-]+) ([\d.e+-]+) L ([\d.e+-]+) ([\d.e+-]+) L ([\d.e+-]+) ([\d.e+-]+)/)
        const anchor = {x: Number(axis.getAttribute('x1')), y: Number(axis.getAttribute('y1'))}
        const tipPoint = {x: Number(tip.getAttribute('cx')), y: Number(tip.getAttribute('cy'))}
        const left = {x: Number(coordinates[1]), y: Number(coordinates[2])}
        const right = {x: Number(coordinates[5]), y: Number(coordinates[6])}
        const baseRadius = Math.hypot(right.x - left.x, right.y - left.y) / 2
        const baseCenter = {x: (left.x + right.x) / 2, y: (left.y + right.y) / 2}
        return {
            anchor,
            length: Math.hypot(tipPoint.x - anchor.x, tipPoint.y - anchor.y),
            points: [
                left, tipPoint, right,
                {x: baseCenter.x - baseRadius, y: baseCenter.y},
                {x: baseCenter.x + baseRadius, y: baseCenter.y},
                {x: baseCenter.x, y: baseCenter.y - baseRadius},
                {x: baseCenter.x, y: baseCenter.y + baseRadius},
                {x: Number(axis.getAttribute('x2')), y: Number(axis.getAttribute('y2'))},
            ],
        }
    }

    /** Assert containment against the current crop in overlay-local CSS pixels. */
    const expectInsideCrop = () => {
        expect(overlay.style.visibility).toBe('visible')
        readGuide().points.forEach(point => {
            expect(point.x).toBeGreaterThanOrEqual(cropBounds.left - surface.left - 0.01)
            expect(point.x).toBeLessThanOrEqual(cropBounds.right - surface.left + 0.01)
            expect(point.y).toBeGreaterThanOrEqual(cropBounds.top - surface.top - 0.01)
            expect(point.y).toBeLessThanOrEqual(cropBounds.bottom - surface.top + 0.01)
        })
    }

    /** Apply a new crop rectangle through the public guide update boundary. */
    const setCrop = (left, top, width, height) => {
        cropBounds = {left, top, width, height, right: left + width, bottom: top + height}
        updateJourneyReplayCameraAngleGuide(viewer, guide)
    }

    return {viewer, journey, guide, crop, overlay, camera, onCameraChange, setMapView, setCrop, readGuide, expectInsideCrop}
}

describe('Replay preparation cone crop with a real Cesium camera', () => {
    it('aligns the full cone and its rounded base with the camera icon as pitch and heading change', () => {
        const fixture = installPreparationGuide()
        for (const [pitch, heading] of [[-1.3, 0], [-0.4, 0.7], [-0.8, -1.2]]) {
            fixture.setMapView(8000, pitch, heading)
            const {anchor, length, points} = fixture.readGuide()
            const icon = fixture.overlay.querySelector('img')
            const [a, b, c, d] = icon.style.transform.match(/matrix\(([^)]+)\)/)[1].split(',').map(Number)
            const baseHalfWidth = Math.hypot(points[2].x - points[0].x, points[2].y - points[0].y) / 2
            const outer = fixture.overlay.querySelector('[data-part="outer"]')
            const widthScale = Number(outer.getAttribute('data-base-width-scale'))
            expect(length / baseHalfWidth * 0.32 * widthScale).toBeCloseTo(Math.hypot(a, b) / Math.hypot(c, d), 3)
            const tip = points[1]
            const cross = (tip.x - anchor.x) * b - (tip.y - anchor.y) * a
            expect(Math.abs(cross) / length).toBeLessThan(0.00001)
            expect(outer.getAttribute('d').match(/ C /g)).toHaveLength(2)
            const arc = fixture.overlay.querySelector('[data-part="camera-angle-arc"]')
            const arcPoints = [...arc.getAttribute('d').matchAll(/[ML] ([\d.e+-]+) ([\d.e+-]+)/g)]
            expect(arcPoints.length).toBeGreaterThan(10)
            const determinant = a * d - b * c
            const radii = arcPoints.map(point => {
                const x = Number(point[1]) - anchor.x
                const y = Number(point[2]) - anchor.y
                return Math.hypot((d * x - c * y) / determinant, (-b * x + a * y) / determinant)
            })
            expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(0.01)
            fixture.expectInsideCrop()
        }
        expect(fixture.onCameraChange).not.toHaveBeenCalled()
    })

    it.each([0.2, 3])('preserves Replay height while dragging the camera angle at %sx its initial radius', radiusFactor => {
        const fixture = installPreparationGuide({altitude: 3454})
        updateJourneyReplayCameraAngleGuide(fixture.viewer, fixture.guide, {previewCesiumCamera: true})
        const cameraIcon = fixture.overlay.querySelector('img')
        const {anchor} = fixture.readGuide()
        const start = {x: Number.parseFloat(cameraIcon.style.left), y: Number.parseFloat(cameraIcon.style.top)}
        const radius = Math.hypot(start.x - anchor.x, start.y - anchor.y)
        const angle = Math.atan2(start.y - anchor.y, start.x - anchor.x) + Math.PI / 4
        const surface = fixture.overlay.getBoundingClientRect()

        /** Dispatch a pointer at overlay coordinates through the public guide gesture. */
        const dispatchPointer = (target, type, x, y) => {
            const event = new window.Event(type, {bubbles: true, cancelable: true})
            Object.defineProperties(event, {
                button: {value: 0},
                clientX: {value: surface.left + x},
                clientY: {value: surface.top + y},
                pointerId: {value: 1},
            })
            target.dispatchEvent(event)
        }

        dispatchPointer(cameraIcon, 'pointerdown', start.x, start.y)
        const moved = {
            x: anchor.x + Math.cos(angle) * radius * radiusFactor,
            y: anchor.y + Math.sin(angle) * radius * radiusFactor,
        }
        dispatchPointer(window, 'pointermove', moved.x, moved.y)
        expect(fixture.onCameraChange).toHaveBeenCalledOnce()
        expect(fixture.onCameraChange.mock.lastCall[0].cameraAngle).not.toBe(fixture.guide.angleDegrees)
        expect(fixture.onCameraChange.mock.lastCall[0].altitude).toBe(3454)
        dispatchPointer(window, 'pointerup', moved.x, moved.y)
        expect(fixture.onCameraChange.mock.lastCall[0].altitude).toBe(3454)
        expect(fixture.viewer.scene.screenSpaceCameraController.enableRotate).toBe(true)
    })

    it('keeps its display geometry unchanged when the prepared Replay height changes', () => {
        const fixture = installPreparationGuide()
        const initialGuide = fixture.readGuide()
        const cameraPosition = Cartesian3.clone(fixture.camera.positionWC)
        const cameraDirection = Cartesian3.clone(fixture.camera.directionWC)
        const cameraUp = Cartesian3.clone(fixture.camera.upWC)

        for (const altitude of [10, 539, 3454, 100000]) {
            const guide = resolveJourneyReplayCameraAngleGuide({
                journey: fixture.journey,
                camera: {altitude, cameraAngle: 55},
            })
            updateJourneyReplayCameraAngleGuide(fixture.viewer, guide)
            fixture.expectInsideCrop()
            expect(fixture.readGuide()).toEqual(initialGuide)
            expect(Cartesian3.distance(fixture.camera.positionWC, cameraPosition)).toBeLessThan(1e-7)
            expect(Cartesian3.distance(fixture.camera.directionWC, cameraDirection)).toBeLessThan(1e-12)
            expect(Cartesian3.distance(fixture.camera.upWC, cameraUp)).toBeLessThan(1e-12)
        }
        expect(fixture.onCameraChange).not.toHaveBeenCalled()
    })

    it('keeps the projected CSS size stable to subpixel precision when only the Cesium zoom changes', () => {
        const fixture = installPreparationGuide()
        const initialLength = fixture.readGuide().length
        expect(initialLength).toBeGreaterThan(64)
        for (const range of [25000, 4000, 16000, 8000]) {
            fixture.setMapView(range)
            fixture.expectInsideCrop()
            // The elevated terrain anchor introduces subpixel perspective parallax across zoom levels.
            expect(Math.abs(fixture.readGuide().length - initialLength)).toBeLessThan(0.1)
        }
        fixture.setMapView(25000)
        removeJourneyReplayCameraAngleGuide(fixture.viewer)
        mountJourneyReplayCameraAngleGuide(fixture.viewer, fixture.guide, {}, {
            cropElement: fixture.crop, screenLocked: true, onCameraChange: fixture.onCameraChange,
        })
        const remountedOverlay = fixture.viewer.container.querySelector('.replay-camera-angle-guide-dom')
        remountedOverlay.getBoundingClientRect = () => fixture.viewer.container.getBoundingClientRect()
        updateJourneyReplayCameraAngleGuide(fixture.viewer, fixture.guide)
        const remountedAxis = remountedOverlay.querySelector('[data-part="camera-position-axis"]')
        const remountedTip = remountedOverlay.querySelector('[data-part="cone-tip-drag-target"]')
        expect(Math.abs(Math.hypot(
            Number(remountedTip.getAttribute('cx')) - Number(remountedAxis.getAttribute('x1')),
            Number(remountedTip.getAttribute('cy')) - Number(remountedAxis.getAttribute('y1')),
        ) - initialLength)).toBeLessThan(0.1)
        expect(fixture.onCameraChange).not.toHaveBeenCalled()
    })

    it('keeps a usable cone inside a crop that no longer contains the projected departure', () => {
        const fixture = installPreparationGuide({altitude: 3454})
        fixture.setCrop(830, 510, 280, 250)
        for (const heading of [0, 0.6, -1.2, 2.8]) {
            fixture.setMapView(8000, -0.6, heading)
            fixture.expectInsideCrop()
            expect(fixture.readGuide().length).toBeGreaterThan(40)
        }
        expect(fixture.onCameraChange).not.toHaveBeenCalled()
    })

    it('uses the mounted crop before React supplies its element callback', () => {
        const fixture = installPreparationGuide({supplyCrop: false, altitude: 6000})
        fixture.setCrop(830, 510, 280, 250)
        fixture.expectInsideCrop()
    })

    it('rebinds containment after the crop element has been replaced', () => {
        const fixture = installPreparationGuide()
        const replacement = document.createElement('div')
        replacement.id = VIDEO_CROP_ZONE
        replacement.getBoundingClientRect = () => ({left: 830, top: 510, width: 280, height: 250, right: 1110, bottom: 760})
        fixture.crop.replaceWith(replacement)
        fixture.setCrop(830, 510, 280, 250)
        fixture.expectInsideCrop()
    })
})
