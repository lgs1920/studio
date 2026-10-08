/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-camera-angle-guide.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-27
 * Last modified: 2026-10-08
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, describe, expect, it, vi} from 'vitest'
import {Cartesian3, Cartographic, Matrix4} from 'cesium'
import {replayAngularDelta} from '@Core/ui/replay/JourneyReplayCameraMath'
import {
    mountJourneyReplayCameraAngleGuide,
    removeJourneyReplayCameraAngleGuide,
    replayCameraSettingsFromArrowKey,
    resolveJourneyReplayCameraAngleGuide,
    updateJourneyReplayCameraAngleGuide,
} from '@Core/ui/replay/JourneyReplayCameraAngleGuide'

const journey = {
    tracks: new Map([
        ['track-1', {
            content: {
                geometry: {
                    type:        'LineString',
                    coordinates: [[2, 48, 100], [2.001, 48.001, 110]],
                },
            },
        }],
    ]),
}

describe('replay camera angle map guide', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('adjusts camera azimuth and pitch with map arrow keys', () => {
        const camera = {
            cameraAngle: 179,
            pitch: -65,
        }

        expect(replayCameraSettingsFromArrowKey(camera, 'ArrowUp')).toMatchObject({cameraAngle: 179, pitch: -64})
        expect(replayCameraSettingsFromArrowKey(camera, 'ArrowDown')).toMatchObject({cameraAngle: 179, pitch: -66})
        expect(replayCameraSettingsFromArrowKey(camera, 'ArrowRight').cameraAngle).toBe(180)
        expect(replayCameraSettingsFromArrowKey(camera, 'ArrowLeft').cameraAngle).toBe(178)
        expect(replayCameraSettingsFromArrowKey({cameraAngle: -180}, 'ArrowRight').cameraAngle).toBe(-179)
        expect(replayCameraSettingsFromArrowKey({cameraAngle: 180}, 'ArrowLeft').cameraAngle).toBe(179)
        expect(replayCameraSettingsFromArrowKey({cameraAngle: 180, pitch: -5}, 'ArrowUp').pitch).toBe(-5)
        expect(replayCameraSettingsFromArrowKey({cameraAngle: 180, pitch: -89}, 'ArrowDown').pitch).toBe(-89)
        expect(replayCameraSettingsFromArrowKey({}, 'Escape')).toBeNull()
    })

    it('anchors the guide at the first trace coordinate and applies the display angle', () => {
        const guide = resolveJourneyReplayCameraAngleGuide({
            camera: {
                headingOffset: 25,
                positionMode:  'behind',
            },
            journey,
        })

        expect(guide.anchor).toEqual({height: 100, latitude: 48, longitude: 2})
        expect(guide.cameraGroundHeight).toBe(110)
        expect(guide.coneHeight).toBe(115)
        expect(guide.mode).toBeUndefined()
        expect(guide.angleDegrees).toBe(-155)
        expect(guide.cameraHeading - guide.baseHeading).toBeCloseTo(25 * Math.PI / 180, 8)
        expect(Math.abs(guide.coneHeading - guide.cameraHeading)).toBeCloseTo(Math.PI, 8)
        expect(guide.coneHeading - guide.axisHeading).toBeCloseTo(-155 * Math.PI / 180, 8)
        const turnedGuide = resolveJourneyReplayCameraAngleGuide({
            camera: {
                headingOffset: -5,
                positionMode:  'behind',
            },
            journey,
        })
        expect(replayAngularDelta(guide.coneHeading, turnedGuide.coneHeading)).toBeCloseTo(-30 * Math.PI / 180, 8)
        const fractionalAngleGuide = resolveJourneyReplayCameraAngleGuide({
            camera: {headingOffset: 12.6, positionMode: 'behind'},
            journey,
        })
        expect(fractionalAngleGuide.angleDegrees).toBeCloseTo(-167.4, 6)
    })

    it('uses the same angle guide regardless of a legacy position mode', () => {
        const guide = resolveJourneyReplayCameraAngleGuide({
            camera: {headingOffset: 40, positionMode: 'system'},
            journey,
        })

        expect(guide.angleDegrees).toBe(180)
        expect(guide.mode).toBeUndefined()
    })

    it('uses the departure direction across the initial trace samples', () => {
        const multiPointJourney = {
            tracks: new Map([
                ['track-1', {
                    content: {
                        geometry: {
                            type:        'LineString',
                            coordinates: [[0, 0], [0.001, 0.001], [0.002, 0.002], [0.003, 0.003], [0.004, 0.004], [0.005, 0.005]],
                        },
                    },
                }],
            ]),
        }
        const guide = resolveJourneyReplayCameraAngleGuide({
            camera: {
                headingOffset: 0,
                positionMode:  'behind',
            },
            journey: multiPointJourney,
        })

        const expectedCoordinate = (300 / (6378137 * Math.sqrt(2))) * 180 / Math.PI
        expect(guide.directionPoint.height).toBe(0)
        expect(guide.directionPoint.latitude).toBeCloseTo(expectedCoordinate, 8)
        expect(guide.directionPoint.longitude).toBeCloseTo(expectedCoordinate, 8)
        expect(guide.axisHeading).toBeCloseTo(Math.PI / 4, 6)
    })

    it('measures the camera angle from the departure tangent, not the 300 metre chord', () => {
        const bentJourney = {
            tracks: new Map([['track-1', {
                content: {
                    geometry: {
                        type: 'LineString',
                        coordinates: [[0, 0], [0.001, 0], [0.001, 0.01]],
                    },
                },
            }]]),
        }
        const guide = resolveJourneyReplayCameraAngleGuide({
            camera: {headingOffset: 20, positionMode: 'behind'},
            journey: bentJourney,
        })

        expect(guide.axisHeading).toBeCloseTo(Math.PI / 2, 6)
        expect(guide.cameraHeading - guide.axisHeading).toBeCloseTo(20 * Math.PI / 180, 8)
        expect(guide.directionPoint.latitude).toBeGreaterThan(0)
        expect(guide.directionPoint.longitude).toBeCloseTo(0.001, 8)
    })

    it('shows at most 600 metres after a non-loop departure without adding a lead-in', () => {
        const coordinates = Array.from({length: 400}, (_, index) => [index * 0.0001, 0, 0])
        const guide = resolveJourneyReplayCameraAngleGuide({
            camera: {headingOffset: 0, positionMode: 'behind'},
            journey: {tracks: new Map([['track-1', {content: {geometry: {type: 'LineString', coordinates}}}]])},
        })

        expect(guide.looped).toBe(false)
        expect(guide.routeAfter).toHaveLength(1)
        expect(guide.routeAfter[0].length).toBeLessThanOrEqual(16)
        expect(guide.routeAfter[0].at(-1).longitude).toBeCloseTo((600 / 6378137) * 180 / Math.PI, 5)
        expect(guide.routeBefore).toBeUndefined()
        expect(guide.routeLoop).toBeUndefined()
    })

    it('shows only the first 600 metres after a masked loop departure', () => {
        const coordinates = Array.from({length: 402}, (_, index) => {
            if (index === 401) {
                return [0.0001, 0, 0]
            }
            return [index * 0.0001, 0, 0]
        })
        const loopJourney = {
            tracks: new Map([['track-1', {
                content: {geometry: {type: 'LineString', coordinates}},
                flags: {stop: 'hidden-stop'},
            }]]),
        }
        const guide = resolveJourneyReplayCameraAngleGuide({
            camera: {headingOffset: 0, positionMode: 'behind'},
            journey: loopJourney,
            pois: new Map([['hidden-stop', {tooClose: true}]]),
        })

        expect(guide.looped).toBe(true)
        expect(guide.routeAfter).toHaveLength(1)
        expect(guide.routeAfter[0].length).toBeLessThanOrEqual(16)
        expect(guide.routeAfter[0][0]).toEqual({height: 0, latitude: 0, longitude: 0})
        expect(guide.routeAfter[0].at(-1).longitude).toBeCloseTo((600 / 6378137) * 180 / Math.PI, 5)
        expect(guide.routeBefore).toBeUndefined()
        expect(guide.routeLoop).toBeUndefined()
    })

    it('reprojects and smoothly animates the terrain-clamped route as the Cesium view changes', () => {
        const container = document.createElement('div')
        const canvas = document.createElement('canvas')
        canvas.width = 1000
        canvas.height = 800
        container.appendChild(canvas)
        document.body.appendChild(container)
        const anchor = Cartesian3.fromDegrees(2, 48, 100)
        const projectionMatrix = Matrix4.clone(Matrix4.IDENTITY)
        const anchorCartographic = Cartographic.fromCartesian(anchor)
        const east = {
            x: -Math.sin(anchorCartographic.longitude),
            y: Math.cos(anchorCartographic.longitude),
            z: 0,
        }
        const north = {
            x: -Math.sin(anchorCartographic.latitude) * Math.cos(anchorCartographic.longitude),
            y: -Math.sin(anchorCartographic.latitude) * Math.sin(anchorCartographic.longitude),
            z: Math.cos(anchorCartographic.latitude),
        }
        /**
         * Configure an orthographic projection in the anchor's local east-north plane.
         *
         * @param {number} scale - Pixels-per-metre projection scale factor.
         * @returns {void}
         */
        const setProjectionScale = scale => {
            projectionMatrix[0] = east.x * scale
            projectionMatrix[4] = east.y * scale
            projectionMatrix[8] = east.z * scale
            projectionMatrix[1] = north.x * scale
            projectionMatrix[5] = north.y * scale
            projectionMatrix[9] = north.z * scale
            projectionMatrix[12] = -scale * ((east.x * anchor.x) + (east.y * anchor.y) + (east.z * anchor.z))
            projectionMatrix[13] = -scale * ((north.x * anchor.x) + (north.y * anchor.y) + (north.z * anchor.z))
            projectionMatrix[10] = 0.0001
            projectionMatrix[14] = 0
        }
        setProjectionScale(0.002)
        let cameraChangedListener = null
        let animationFrameId = 0
        const animationFrames = new Map()
        vi.stubGlobal('requestAnimationFrame', callback => {
            animationFrameId += 1
            animationFrames.set(animationFrameId, callback)
            return animationFrameId
        })
        vi.stubGlobal('cancelAnimationFrame', requestId => animationFrames.delete(requestId))
        const camera = {
            heading: 0,
            pitch: 0,
            roll: 0,
            viewMatrix: Matrix4.clone(Matrix4.IDENTITY),
            frustum: {projectionMatrix},
            changed: {
                addEventListener(listener) {
                    cameraChangedListener = listener
                    return () => {
                        cameraChangedListener = null
                    }
                },
            },
            moveStart: {addEventListener: vi.fn(() => vi.fn())},
            getPixelSize: () => 2,
        }
        let postRenderListener = null
        const viewer = {
            container,
            camera,
            scene: {
                canvas,
                drawingBufferWidth: 1000,
                drawingBufferHeight: 800,
                screenSpaceCameraController: {enableRotate: true},
                globe: {getHeight: () => null},
                cartesianToCanvasCoordinates(position, result) {
                    const point = Cartographic.fromCartesian(position)
                    result.x = 500 + (point.longitude - 2 * Math.PI / 180) * 100000 + camera.viewMatrix[12] * 0.1
                    result.y = 400 - (point.latitude - 48 * Math.PI / 180) * 100000
                    return result
                },
                postRender: {
                    addEventListener(listener) {
                        postRenderListener = listener
                        return () => {
                            postRenderListener = null
                        }
                    },
                },
                requestRender: vi.fn(),
            },
        }
        Object.defineProperties(container, {
            clientHeight: {configurable: true, value: 800},
            clientWidth: {configurable: true, value: 1000},
        })
        Object.defineProperties(canvas, {
            clientHeight: {configurable: true, value: 800},
            clientWidth: {configurable: true, value: 1000},
        })

        const cameraChangeListener = vi.fn()
        const guide = resolveJourneyReplayCameraAngleGuide({camera: {cameraAngle: 180}, journey})
        expect(mountJourneyReplayCameraAngleGuide(viewer, guide, {}, {
            onCameraChange: cameraChangeListener,
            screenLocked: true,
        })).toBe(true)
        postRenderListener()
        const overlay = container.querySelector('.replay-camera-angle-guide-dom')
        const routeStart = overlay.querySelector('[data-part="journey-route-start"]')
        const startX = routeStart.getAttribute('cx')
        const routePathAtInitialZoom = overlay.querySelector('[data-part="journey-route-after"]').getAttribute('d')
        const cameraIcon = overlay.querySelector('img')
        const cameraIconLeft = cameraIcon.style.left

        camera.viewMatrix[12] = 20
        cameraChangedListener()
        postRenderListener()
        expect(animationFrames.size).toBeGreaterThan(0)
        const scheduledRouteFrameId = [...animationFrames.keys()][0]
        let animationTimestamp = 0
        expect(overlay.querySelector('[data-part="journey-route-after"]').getAttribute('d'))
            .toBe(routePathAtInitialZoom)
        camera.viewMatrix[12] = 40
        cameraChangedListener()
        postRenderListener()
        expect(animationFrames.has(scheduledRouteFrameId)).toBe(true)
        for (let frame = 0; frame < 4; frame += 1) {
            const callbacks = [...animationFrames.values()]
            animationFrames.clear()
            animationTimestamp += 16
            callbacks.forEach(callback => callback(animationTimestamp))
        }
        const routePathDuringPan = overlay.querySelector('[data-part="journey-route-after"]').getAttribute('d')
        expect(routePathDuringPan).not.toBe(routePathAtInitialZoom)
        while (animationFrames.size > 0 && animationTimestamp < 1000) {
            const callbacks = [...animationFrames.values()]
            animationFrames.clear()
            animationTimestamp += 16
            callbacks.forEach(callback => callback(animationTimestamp))
        }
        const routePathAfterPan = overlay.querySelector('[data-part="journey-route-after"]').getAttribute('d')
        const pannedRouteStart = routePathAfterPan.match(/^M ([-\d.]+) ([-\d.]+)/)
        expect(pannedRouteStart).not.toBeNull()
        expect(Number(routeStart.getAttribute('cx'))).toBeCloseTo(Number(pannedRouteStart[1]), 6)
        expect(Number(routeStart.getAttribute('cy'))).toBeCloseTo(Number(pannedRouteStart[2]), 6)
        expect(routeStart.getAttribute('cx')).not.toBe(startX)
        expect(routePathAfterPan).not.toBe(routePathAtInitialZoom)

        camera.viewMatrix[12] = 0
        setProjectionScale(0.004)
        cameraChangedListener()
        postRenderListener()
        expect(animationFrames.size).toBeGreaterThan(0)
        while (animationFrames.size > 0 && animationTimestamp < 2000) {
            const callbacks = [...animationFrames.values()]
            animationFrames.clear()
            animationTimestamp += 16
            callbacks.forEach(callback => callback(animationTimestamp))
        }
        const routePathAtCloserZoom = overlay.querySelector('[data-part="journey-route-after"]').getAttribute('d')
        const initialRouteBounds = routePathAtInitialZoom.match(/^M ([-\d.]+) ([-\d.]+).* L ([-\d.]+) ([-\d.]+)$/)
        const closerRouteBounds = routePathAtCloserZoom.match(/^M ([-\d.]+) ([-\d.]+).* L ([-\d.]+) ([-\d.]+)$/)
        expect(initialRouteBounds).not.toBeNull()
        expect(closerRouteBounds).not.toBeNull()
        const initialRouteLength = Math.hypot(
            Number(initialRouteBounds[3]) - Number(initialRouteBounds[1]),
            Number(initialRouteBounds[4]) - Number(initialRouteBounds[2]),
        )
        const closerRouteLength = Math.hypot(
            Number(closerRouteBounds[3]) - Number(closerRouteBounds[1]),
            Number(closerRouteBounds[4]) - Number(closerRouteBounds[2]),
        )
        expect(closerRouteLength).toBeCloseTo(initialRouteLength * 2, 5)
        const projectedRouteStart = routePathAtCloserZoom.match(/^M ([-\d.]+) ([-\d.]+)/)
        expect(projectedRouteStart).not.toBeNull()
        expect(Number(routeStart.getAttribute('cx'))).toBeCloseTo(Number(projectedRouteStart[1]), 6)
        expect(Number(routeStart.getAttribute('cy'))).toBeCloseTo(Number(projectedRouteStart[2]), 6)
        expect(cameraIcon.style.left).not.toBe(cameraIconLeft)
        const cameraAxis = overlay.querySelector('[data-part="camera-position-axis"]')
        expect(Number(cameraAxis.getAttribute('x1'))).toBeCloseTo(Number(projectedRouteStart[1]), 6)
        expect(Number(cameraAxis.getAttribute('y1'))).toBeCloseTo(Number(projectedRouteStart[2]), 6)
        expect(overlay.querySelector('[data-part="angle-label"]').textContent).toBe('0°')

        const routePathBeforeRotation = routePathAtCloserZoom

        const rotation = Math.PI / 4
        const cosine = Math.cos(rotation)
        const sine = Math.sin(rotation)
        camera.viewMatrix[0] = cosine
        camera.viewMatrix[1] = sine
        camera.viewMatrix[4] = -sine
        camera.viewMatrix[5] = cosine
        camera.viewMatrix[12] = anchor.x - (cosine * anchor.x) + (sine * anchor.y)
        camera.viewMatrix[13] = anchor.y - (sine * anchor.x) - (cosine * anchor.y)
        camera.heading = rotation
        cameraChangedListener()
        postRenderListener()
        while (animationFrames.size > 0 && animationTimestamp < 3000) {
            const callbacks = [...animationFrames.values()]
            animationFrames.clear()
            animationTimestamp += 16
            callbacks.forEach(callback => callback(animationTimestamp))
        }

        expect(overlay.querySelector('[data-part="journey-route-after"]').getAttribute('d'))
            .not.toBe(routePathBeforeRotation)
        expect(cameraIcon.style.left).not.toBe(cameraIconLeft)
        expect(overlay.querySelector('[data-part="angle-label"]').textContent).toBe('0°')
        expect(cameraChangeListener).not.toHaveBeenCalled()
        expect(updateJourneyReplayCameraAngleGuide(viewer, resolveJourneyReplayCameraAngleGuide({
            camera: {cameraAngle: 90},
            journey,
        }))).toBe(true)
        expect(overlay.querySelector('[data-part="angle-label"]').textContent).toBe('+90°')
        setProjectionScale(0.0044)
        cameraChangedListener()
        postRenderListener()
        expect(animationFrames.size).toBeGreaterThan(0)
        removeJourneyReplayCameraAngleGuide(viewer)
        expect(animationFrames.size).toBe(0)
        container.remove()
    })

    it('resizes the preparation simulation from its arrow along the source trace', () => {
        const container = document.createElement('div')
        const canvas = document.createElement('canvas')
        canvas.width = 1000
        canvas.height = 800
        container.appendChild(canvas)
        document.body.appendChild(container)
        container.getBoundingClientRect = () => ({left: 0, top: 0, width: 1000, height: 800})
        canvas.getBoundingClientRect = () => ({left: 0, top: 0, width: 1000, height: 800})
        Object.defineProperties(container, {
            clientHeight: {configurable: true, value: 800},
            clientWidth: {configurable: true, value: 1000},
        })
        Object.defineProperties(canvas, {
            clientHeight: {configurable: true, value: 800},
            clientWidth: {configurable: true, value: 1000},
        })
        const cameraController = {enableRotate: true}
        const camera = {
            heading: 0,
            pitch: 0,
            roll: 0,
            position: Cartesian3.fromDegrees(2, 48, 10000),
            changed: {addEventListener: vi.fn(() => vi.fn())},
            moveStart: {addEventListener: vi.fn(() => vi.fn())},
            getPixelSize: () => 1,
        }
        const viewer = {
            container,
            camera,
            scene: {
                canvas,
                drawingBufferWidth: 1000,
                drawingBufferHeight: 800,
                globe: {getHeight: () => null},
                screenSpaceCameraController: cameraController,
                cartesianToCanvasCoordinates(position, result) {
                    const point = Cartographic.fromCartesian(position)
                    result.x = 500 + ((point.longitude * 180 / Math.PI) - 2) * 111319 * Math.cos(48 * Math.PI / 180) * 0.1
                    result.y = 400 - ((point.latitude * 180 / Math.PI) - 48) * 111319 * 0.1
                    return result
                },
                postRender: {addEventListener: vi.fn(() => vi.fn())},
                requestRender: vi.fn(),
            },
        }
        const resizeJourney = {
            tracks: new Map([['track-1', {
                content: {
                    geometry: {
                        type: 'LineString',
                        coordinates: [[2, 48, 100], [2.01, 48, 100], [2.02, 48, 100], [2.03, 48, 100]],
                    },
                },
            }]]),
        }
        const onCameraChange = vi.fn()
        const guide = resolveJourneyReplayCameraAngleGuide({camera: {cameraAngle: 180}, journey: resizeJourney})
        expect(guide.routeWindowMeters).toBe(600)
        expect(guide.routeMaxWindowMeters).toBe(1200)
        expect(mountJourneyReplayCameraAngleGuide(viewer, guide, {}, {
            onCameraChange,
            screenLocked: true,
        })).toBe(true)

        const overlay = container.querySelector('.replay-camera-angle-guide-dom')
        const route = overlay.querySelector('[data-part="journey-route-after"]')
        const resizeHandle = overlay.querySelector('[data-part="journey-route-resize-handle"]')
        const routeStart = route.getAttribute('d').match(/^M ([-\d.]+) ([-\d.]+)/).slice(1).map(Number)
        const routeEndFromPath = () => route.getAttribute('d').match(/ L ([-\d.]+) ([-\d.]+)$/).slice(1).map(Number)
        const initialRouteLength = Math.hypot(
            routeEndFromPath()[0] - routeStart[0],
            routeEndFromPath()[1] - routeStart[1],
        )
        expect(resizeHandle.style.display).toBe('block')
        expect(resizeHandle.getAttribute('role')).toBe('slider')
        expect(resizeHandle.getAttribute('aria-valuenow')).toBe('600')

        const pointerEvent = (type, x, y) => {
            const event = new Event(type, {bubbles: true, cancelable: true})
            Object.defineProperties(event, {
                button: {value: 0},
                clientX: {value: x},
                clientY: {value: y},
                pointerId: {value: 1},
            })
            return event
        }
        resizeHandle.dispatchEvent(pointerEvent(
            'pointerdown',
            Number(resizeHandle.getAttribute('cx')),
            Number(resizeHandle.getAttribute('cy')),
        ))
        expect(cameraController.enableRotate).toBe(false)
        window.dispatchEvent(pointerEvent('pointermove', 620, 400))
        expect(resizeHandle.getAttribute('aria-valuenow')).toBe('1200')
        const expandedRouteLength = Math.hypot(
            routeEndFromPath()[0] - routeStart[0],
            routeEndFromPath()[1] - routeStart[1],
        )
        expect(expandedRouteLength).toBeCloseTo(initialRouteLength * 2, 3)
        window.dispatchEvent(pointerEvent('pointermove', 530, 400))
        expect(resizeHandle.getAttribute('aria-valuenow')).toBe('300')
        expect(routeEndFromPath()[0]).toBeLessThan(620)
        window.dispatchEvent(pointerEvent('pointerup', 530, 400))
        expect(cameraController.enableRotate).toBe(true)
        expect(onCameraChange).not.toHaveBeenCalled()

        resizeHandle.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true, cancelable: true}))
        expect(resizeHandle.getAttribute('aria-valuenow')).toBe('325')
        resizeHandle.dispatchEvent(new KeyboardEvent('keydown', {key: 'End', bubbles: true, cancelable: true}))
        expect(resizeHandle.getAttribute('aria-valuenow')).toBe('1200')
        removeJourneyReplayCameraAngleGuide(viewer)
        container.remove()
    })

    it('follows the active replay sample and the local trace direction', () => {
        const guide = resolveJourneyReplayCameraAngleGuide({
            camera: {
                headingOffset: 15,
                positionMode:  'behind',
            },
            journey,
            sample: {
                longitude:  2.5,
                latitude:   48.5,
                altitude:   150,
                source: {
                    startPoint: {longitude: 2.49, latitude: 48.5, altitude: 145},
                    endPoint:   {longitude: 2.51, latitude: 48.5, altitude: 155},
                },
            },
        })

        expect(guide.anchor).toEqual({height: 150, latitude: 48.5, longitude: 2.5})
        expect(guide.axisHeading).toBeCloseTo(Math.PI / 2, 3)
        expect(guide.directionPoint.longitude).toBeGreaterThan(guide.anchor.longitude)
        expect(guide.angleDegrees).toBe(-165)
    })

    it('mounts a synchronized DOM cone with solid circular icons', () => {
        const container = document.createElement('div')
        const canvas = document.createElement('canvas')
        container.appendChild(canvas)
        document.body.appendChild(container)
        let metersPerPixel = 1
        let hideDeparture = false
        let moveDepartureOutsideViewport = false
        let moveRouteEndOutsideViewport = false
        let occludeDeparture = false
        let pickAtLowerSimulatedAltitude = false
        let terrainHeight = 80
        let pickHeight = null
        const projectedWorldPoints = []
        let mapPickEnabled = false
        let cameraChangedListener = null
        let cameraMoveStartListener = null
        let postRenderListener = null
        let renderRequestCount = 0
        const cameraController = {enableRotate: true}
        container.getBoundingClientRect = () => ({left: 0, top: 0, width: 1000, height: 800})
        canvas.getBoundingClientRect = () => ({left: 0, top: 0, width: 1000, height: 800})
        Object.defineProperties(container, {
            clientHeight: {configurable: true, value: 800},
            clientWidth:  {configurable: true, value: 1000},
        })
        Object.defineProperties(canvas, {
            clientHeight: {configurable: true, value: 800},
            clientWidth:  {configurable: true, value: 1000},
        })
        const viewer = {
            container,
            camera: {
                heading: 0,
                position: new Cartesian3(0, 0, 0),
                changed: {
                    addEventListener(listener) {
                        cameraChangedListener = listener
                        return () => {
                            cameraChangedListener = null
                        }
                    },
                },
                moveStart: {
                    addEventListener(listener) {
                        cameraMoveStartListener = listener
                        return () => {
                            cameraMoveStartListener = null
                        }
                    },
                },
                getPixelSize() {
                    return metersPerPixel
                },
                getPickRay(point) {
                    return point
                },
            },
            scene: {
                canvas,
                screenSpaceCameraController: cameraController,
                globe: {
                    getHeight: () => terrainHeight,
                    pick: point => {
                        if (!mapPickEnabled) {
                            return null
                        }
                        const east = point.x - 500
                        const north = 400 - point.y
                        return Cartesian3.fromDegrees(
                            2 + (east / (111319 * Math.cos(48 * Math.PI / 180))),
                            48 + (north / 111319),
                            0,
                        )
                    },
                },
                cartesianToCanvasCoordinates(position, result) {
                    if (hideDeparture) {
                        return undefined
                    }
                    if (occludeDeparture) {
                        result.x = 500
                        result.y = 400
                        return result
                    }
                    const positionCartographic = Cartographic.fromCartesian(position)
                    projectedWorldPoints.push({
                        height: positionCartographic.height,
                        latitude: positionCartographic.latitude * 180 / Math.PI,
                        longitude: positionCartographic.longitude * 180 / Math.PI,
                    })
                    result.x = 500 + ((positionCartographic.longitude * 180 / Math.PI) - 2) * 111319 * Math.cos(48 * Math.PI / 180)
                    result.y = 400 - ((positionCartographic.latitude * 180 / Math.PI) - 48) * 111319
                    if (moveRouteEndOutsideViewport && positionCartographic.longitude * 180 / Math.PI > 2.00001) {
                        result.x = 1010
                    }
                    if (moveDepartureOutsideViewport) {
                        result.x = -10
                    }
                    return result
                },
                drawingBufferHeight: 800,
                drawingBufferWidth: 1000,
                pickPositionSupported: true,
                pickPosition() {
                    if (occludeDeparture) {
                        return new Cartesian3(0, 0, 0)
                    }
                    if (pickHeight !== null) {
                        return Cartesian3.fromDegrees(2, 48, pickHeight)
                    }
                    return pickAtLowerSimulatedAltitude ? Cartesian3.fromDegrees(2, 48, 100) : null
                },
                postRender: {
                    addEventListener(listener) {
                        postRenderListener = listener
                        return () => {
                            postRenderListener = null
                        }
                    },
                },
                requestRender() {
                    renderRequestCount += 1
                },
            },
        }
        const tracedJourney = {
            tracks: new Map([['track-1', {
                content: {
                    geometry: {
                        type: 'LineString',
                        coordinates: [[2, 48, 100], [2.0004, 48.0002, 105], [2.001, 48.001, 110], [2.0015, 48.0015, 115], [2.002, 48.002, 120]],
                    },
                },
            }]]),
            activitySettings: {icon: 'bicycle'},
        }
        const guide = resolveJourneyReplayCameraAngleGuide({
            camera: {
                headingOffset: 0,
                positionMode:  'ahead',
            },
            journey: tracedJourney,
        })

        const cameraChangeListener = vi.fn()
        expect(mountJourneyReplayCameraAngleGuide(
            viewer,
            guide,
            {brandColor: '#00ffff'},
            {onCameraChange: cameraChangeListener},
        )).toBe(true)
        expect(renderRequestCount).toBeGreaterThan(0)
        const overlay = container.querySelector('.replay-camera-angle-guide-dom')
        expect(overlay).not.toBeNull()
        expect(overlay.style.pointerEvents).toBe('none')
        expect(overlay.style.zIndex).toBe('2')
        expect(overlay.querySelectorAll('path')).toHaveLength(7)
        const outerPath = overlay.querySelector('path[data-part="outer"]')
        const innerPath = overlay.querySelector('path[data-part="inner"]')
        const cameraGuideSvg = outerPath.ownerSVGElement
        expect(outerPath).not.toBeNull()
        expect(innerPath).not.toBeNull()
        expect(overlay.querySelector('text[data-part="angle-label"]')?.textContent).toBe('180°')
        expect(outerPath.getAttribute('d')).toContain(' A ')
        expect(innerPath.getAttribute('d')).toContain(' A ')
        const routeAfter = overlay.querySelector('[data-part="journey-route-after"]')
        expect(routeAfter.getAttribute('d')).toMatch(/^M /)
        expect(routeAfter.getAttribute('d')).toContain(' Q ')
        expect(routeAfter.getAttribute('marker-end')).toMatch(/^url\(#replay-camera-angle-guide-route-arrow-/)
        const routeStartMarker = overlay.querySelector('[data-part="journey-route-start"]')
        expect(routeStartMarker?.tagName.toLowerCase()).toBe('circle')
        expect(routeStartMarker.getAttribute('fill')).toBe(routeAfter.getAttribute('stroke'))
        expect(Number(routeStartMarker.getAttribute('r')) * 2).toBe(3 * Number(routeAfter.getAttribute('stroke-width')))
        const arrowMarker = overlay.querySelector('marker[orient="auto"]')
        expect(arrowMarker.getAttribute('markerWidth')).toBe('16')
        expect(arrowMarker.getAttribute('markerHeight')).toBe('12')
        expect(arrowMarker.querySelector('path').getAttribute('d')).toBe('M 0 0 L 16 6 L 0 12 z')
        const projectedAnchor = viewer.scene.cartesianToCanvasCoordinates(
            Cartesian3.fromDegrees(guide.anchor.longitude, guide.anchor.latitude, guide.coneHeight),
            {},
        )
        expect(Number(routeStartMarker.getAttribute('cx'))).toBeCloseTo(projectedAnchor.x, 6)
        expect(Number(routeStartMarker.getAttribute('cy'))).toBeCloseTo(projectedAnchor.y, 6)
        const projectedTerrainStart = projectedWorldPoints.find(point =>
            Math.abs(point.longitude - guide.routeStart.longitude) < 1e-8
            && Math.abs(point.latitude - guide.routeStart.latitude) < 1e-8,
        )
        expect(projectedTerrainStart).toBeDefined()
        expect(projectedTerrainStart.height).toBeCloseTo(terrainHeight, 6)
        const projectedDirection = viewer.scene.cartesianToCanvasCoordinates(
            Cartesian3.fromDegrees(guide.directionPoint.longitude, guide.directionPoint.latitude, guide.coneHeight),
            {},
        )
        const tangentX = projectedDirection.x - projectedAnchor.x
        const tangentY = projectedDirection.y - projectedAnchor.y
        const routeDeparture = routeAfter.getAttribute('d').match(/^M ([-\d.]+) ([-\d.]+) Q ([-\d.]+) ([-\d.]+)/)
        const routeTangentX = Number(routeDeparture[3]) - Number(routeDeparture[1])
        const routeTangentY = Number(routeDeparture[4]) - Number(routeDeparture[2])
        const coneTip = overlay.querySelector('[data-part="cone-tip-drag-target"]')
        const coneAxisX = Number(coneTip.getAttribute('cx')) - projectedAnchor.x
        const coneAxisY = Number(coneTip.getAttribute('cy')) - projectedAnchor.y
        const coneTangentCosine = ((coneAxisX * routeTangentX) + (coneAxisY * routeTangentY))
            / (Math.hypot(coneAxisX, coneAxisY) * Math.hypot(routeTangentX, routeTangentY))
        expect(coneTangentCosine).toBeGreaterThan(0.999)
        const traceActivityIcon = overlay.querySelector('[data-part="trace-activity-icon"]')
        const routeCommands = [...routeAfter.getAttribute('d').matchAll(/([MQL]) ([-\d.]+) ([-\d.]+)(?: ([-\d.]+) ([-\d.]+))?/g)]
        const projectedCurveSamples = []
        let routeCursor = null
        routeCommands.forEach(([, command, firstX, firstY, controlX, controlY]) => {
            const first = {x: Number(firstX), y: Number(firstY)}
            if (command === 'M') {
                routeCursor = first
                projectedCurveSamples.push(first)
                return
            }
            if (command === 'L') {
                for (let step = 1; step <= 40; step += 1) {
                    const ratio = step / 40
                    projectedCurveSamples.push({
                        x: routeCursor.x + ((first.x - routeCursor.x) * ratio),
                        y: routeCursor.y + ((first.y - routeCursor.y) * ratio),
                    })
                }
                routeCursor = first
                return
            }
            const control = first
            const end = {x: Number(controlX), y: Number(controlY)}
            for (let step = 1; step <= 40; step += 1) {
                const ratio = step / 40
                const inverse = 1 - ratio
                projectedCurveSamples.push({
                    x: (inverse ** 2 * routeCursor.x) + (2 * inverse * ratio * control.x) + (ratio ** 2 * end.x),
                    y: (inverse ** 2 * routeCursor.y) + (2 * inverse * ratio * control.y) + (ratio ** 2 * end.y),
                })
            }
            routeCursor = end
        })
        const activityIconCenter = {
            x: Number.parseFloat(traceActivityIcon.style.left),
            y: Number.parseFloat(traceActivityIcon.style.top),
        }
        const closestActivityCurvePoint = projectedCurveSamples.reduce((closest, point) => {
            const distance = Math.hypot(point.x - activityIconCenter.x, point.y - activityIconCenter.y)
            return distance < closest.distance ? {point, distance} : closest
        }, {point: null, distance: Infinity})
        expect(closestActivityCurvePoint.distance).toBeLessThan(0.5)
        expect(Number(traceActivityIcon.style.zIndex)).toBeGreaterThan(
            Number(overlay.querySelector('[data-part="journey-route-after"]').ownerSVGElement.style.zIndex),
        )
        const startLatitude = guide.routeStart.latitude * Math.PI / 180
        const activityLatitude = guide.activityPoint.latitude * Math.PI / 180
        const deltaLongitude = Math.atan2(
            Math.sin((guide.activityPoint.longitude - guide.routeStart.longitude) * Math.PI / 180),
            Math.cos((guide.activityPoint.longitude - guide.routeStart.longitude) * Math.PI / 180),
        )
        const activityDistance = 6378137 * Math.hypot(
            activityLatitude - startLatitude,
            deltaLongitude * Math.cos((startLatitude + activityLatitude) / 2),
        )
        expect(activityDistance).toBeGreaterThan(195)
        expect(activityDistance).toBeLessThan(205)
        terrainHeight = null
        const dragTarget = overlay.querySelector('[data-part="cone-drag-target"]')
        const cesiumPointerListeners = Object.fromEntries(
            ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].map(type => [type, vi.fn()]),
        )
        for (const [type, listener] of Object.entries(cesiumPointerListeners)) {
            container.addEventListener(type, listener)
        }
        const pointerEvent = (type, x, y, shiftKey = false) => {
            const event = new Event(type, {bubbles: true, cancelable: true})
            Object.defineProperties(event, {
                button: {value: 0},
                clientX: {value: x},
                clientY: {value: y},
                pointerId: {value: 1},
                shiftKey: {value: shiftKey},
            })
            return event
        }
        dragTarget.dispatchEvent(pointerEvent('pointerdown', projectedAnchor.x + 50, projectedAnchor.y))
        expect(cameraController.enableRotate).toBe(true)
        cameraGuideSvg.dispatchEvent(pointerEvent('pointermove', projectedAnchor.x, projectedAnchor.y + 50))
        expect(cameraChangeListener).not.toHaveBeenCalled()
        expect(overlay.querySelector('text[data-part="angle-label"]').textContent).toBe('180°')
        cameraGuideSvg.dispatchEvent(pointerEvent('pointerup', projectedAnchor.x, projectedAnchor.y + 50))
        expect(cameraController.enableRotate).toBe(true)
        expect(cameraChangeListener).not.toHaveBeenCalled()
        const cameraMarker = overlay.querySelector('img')
        const cameraMarkerX = Number.parseFloat(cameraMarker.style.left)
        const cameraMarkerY = Number.parseFloat(cameraMarker.style.top)
        const cameraMarkerAngle = Math.atan2(cameraMarkerY - projectedAnchor.y, cameraMarkerX - projectedAnchor.x)
        const cameraMarkerRadius = Math.hypot(cameraMarkerX - projectedAnchor.x, cameraMarkerY - projectedAnchor.y)
        const draggedMarkerAngle = cameraMarkerAngle + (Math.PI / 4)
        mapPickEnabled = true
        cameraMarker.dispatchEvent(pointerEvent('pointerdown', cameraMarkerX, cameraMarkerY))
        cameraGuideSvg.dispatchEvent(pointerEvent(
            'pointermove',
            projectedAnchor.x + (Math.cos(draggedMarkerAngle) * cameraMarkerRadius),
            projectedAnchor.y + (Math.sin(draggedMarkerAngle) * cameraMarkerRadius),
        ))
        expect(cameraChangeListener).not.toHaveBeenCalled()
        cameraGuideSvg.dispatchEvent(pointerEvent('pointerup', cameraMarkerX, cameraMarkerY))
        expect(cameraChangeListener).toHaveBeenCalledTimes(1)
        expect(cameraChangeListener.mock.lastCall[0].cameraAngle).toBeCloseTo(45, 2)
        expect(cameraChangeListener.mock.lastCall[0].altitude).toBeCloseTo(1200, 8)
        const tipDragTarget = overlay.querySelector('[data-part="cone-tip-drag-target"]')
        const dragTipX = Number(tipDragTarget.getAttribute('cx'))
        const dragTipY = Number(tipDragTarget.getAttribute('cy'))
        const tipDeltaX = dragTipX - projectedAnchor.x
        const tipDeltaY = dragTipY - projectedAnchor.y
        const tipRadius = Math.hypot(tipDeltaX, tipDeltaY)
        const tipDragX = projectedAnchor.x + (tipDeltaX * 1.25)
        const tipDragY = projectedAnchor.y + (tipDeltaY * 1.25)
        const cameraChangeCallsBeforeTipDrag = cameraChangeListener.mock.calls.length
        tipDragTarget.dispatchEvent(pointerEvent('pointerdown', dragTipX, dragTipY))
        cameraGuideSvg.dispatchEvent(pointerEvent('pointermove', tipDragX, tipDragY))
        expect(cameraChangeListener).toHaveBeenCalledTimes(cameraChangeCallsBeforeTipDrag)
        expect(overlay.querySelector('text[data-part="angle-label"]').textContent).toBe('+135°')
        cameraGuideSvg.dispatchEvent(pointerEvent('pointerup', tipDragX, tipDragY))
        expect(cameraChangeListener).toHaveBeenCalledTimes(cameraChangeCallsBeforeTipDrag + 1)
        expect(cameraChangeListener.mock.lastCall[0].cameraAngle).toBeCloseTo(45, 2)
        expect(cameraChangeListener.mock.lastCall[0].altitude).toBeCloseTo(1500, 8)
        expect(Math.hypot(
            Number(tipDragTarget.getAttribute('cx')) - projectedAnchor.x,
            Number(tipDragTarget.getAttribute('cy')) - projectedAnchor.y,
        )).toBeGreaterThan(tipRadius)
        mapPickEnabled = false
        expect(updateJourneyReplayCameraAngleGuide(viewer, resolveJourneyReplayCameraAngleGuide({
            camera: {headingOffset: 133, positionMode: 'ahead'},
            journey: tracedJourney,
        }))).toBe(true)
        const snappedDragAngle = 16 * Math.PI / 180
        const cameraChangeCallsBeforeShiftDrag = cameraChangeListener.mock.calls.length
        const snapStartX = Number.parseFloat(cameraMarker.style.left)
        const snapStartY = Number.parseFloat(cameraMarker.style.top)
        const snapRadius = Math.hypot(snapStartX - projectedAnchor.x, snapStartY - projectedAnchor.y)
        const snapStartAngle = Math.atan2(snapStartY - projectedAnchor.y, snapStartX - projectedAnchor.x)
        cameraMarker.dispatchEvent(pointerEvent('pointerdown', snapStartX, snapStartY))
        window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Shift', bubbles: true}))
        cameraGuideSvg.dispatchEvent(pointerEvent(
            'pointermove',
            projectedAnchor.x + (Math.cos(snapStartAngle + snappedDragAngle) * snapRadius),
            projectedAnchor.y + (Math.sin(snapStartAngle + snappedDragAngle) * snapRadius),
        ))
        expect(overlay.querySelector('text[data-part="angle-label"]').textContent).toBe('+30°')
        const cameraAngleArc = overlay.querySelector('[data-part="camera-angle-arc"]')
        const snapMarker = overlay.querySelector('[data-part="camera-angle-snap-marker"]')
        expect(cameraAngleArc.getAttribute('stroke-dasharray')).toBe('none')
        expect(cameraAngleArc.getAttribute('stroke-width')).toBe('5')
        expect(snapMarker.style.display).toBe('block')
        window.dispatchEvent(new KeyboardEvent('keyup', {key: 'Shift', bubbles: true}))
        expect(cameraAngleArc.getAttribute('stroke-dasharray')).toBe('6 5')
        expect(cameraAngleArc.getAttribute('stroke-width')).toBe('3')
        expect(snapMarker.style.display).toBe('none')
        cameraGuideSvg.dispatchEvent(pointerEvent(
            'pointerup',
            projectedAnchor.x + (Math.cos(snapStartAngle + snappedDragAngle) * snapRadius),
            projectedAnchor.y + (Math.sin(snapStartAngle + snappedDragAngle) * snapRadius),
        ))
        expect(cameraChangeListener).toHaveBeenCalledTimes(cameraChangeCallsBeforeShiftDrag + 1)
        expect(cameraChangeListener.mock.lastCall[0].cameraAngle).toBe(150)
        expect(cesiumPointerListeners.pointerdown).toHaveBeenCalledOnce()
        expect(cesiumPointerListeners.pointermove).toHaveBeenCalledOnce()
        expect(cesiumPointerListeners.pointerup).toHaveBeenCalledOnce()
        expect(cesiumPointerListeners.pointercancel).not.toHaveBeenCalled()
        for (const [type, listener] of Object.entries(cesiumPointerListeners)) {
            container.removeEventListener(type, listener)
        }
        mapPickEnabled = false
        const outerArc = outerPath.getAttribute('d').match(/A ([^ ]+) ([^ ]+)/)
        const innerArc = innerPath.getAttribute('d').match(/A ([^ ]+) ([^ ]+)/)
        expect(Number(innerArc[2])).toBeLessThan(Number(innerArc[1]))
        expect(Number(outerArc[2])).toBeCloseTo(Number(outerArc[1]), 6)
        expect(outerPath.getAttribute('fill')).toBe('none')
        expect(innerPath.getAttribute('fill')).toMatch(/^url\(#replay-camera-angle-guide-inner-gradient-/)
        const gradient = overlay.querySelector('linearGradient')
        expect(gradient).not.toBeNull()
        expect(gradient.getAttribute('gradientUnits')).toBe('userSpaceOnUse')
        const gradientStops = gradient.querySelectorAll('stop')
        expect(gradientStops).toHaveLength(2)
        expect(gradientStops[0].getAttribute('stop-opacity')).toBe('0.32')
        expect(gradientStops[1].getAttribute('stop-opacity')).toBe('0')
        expect(gradientStops[0].getAttribute('stop-color')).toBe('rgb(0,255,255)')
        const angleLabel = overlay.querySelector('text[data-part="angle-label"]')
        const cameraAxis = overlay.querySelector('[data-part="camera-position-axis"]')
        expect(angleLabel).not.toBeNull()
        expect(angleLabel.textContent).toBe('+30°')
        expect(angleLabel.getAttribute('fill')).toBe('rgb(0,255,255)')
        expect(angleLabel.getAttribute('opacity')).toBe('1')
        expect(angleLabel.getAttribute('transform')).toMatch(/^rotate\(/)
        const angleArcElement = overlay.querySelector('[data-part="camera-angle-arc"]')
        expect(angleArcElement.getAttribute('stroke-dasharray')).toBe('6 5')
        expect(cameraAxis.getAttribute('stroke')).toBe(angleArcElement.getAttribute('stroke'))
        expect(cameraAxis.getAttribute('stroke-dasharray')).toBe(angleArcElement.getAttribute('stroke-dasharray'))
        expect(cameraAxis.getAttribute('stroke-width')).toBe(angleArcElement.getAttribute('stroke-width'))
        expect(cameraAxis.getAttribute('stroke-linecap')).toBe(angleArcElement.getAttribute('stroke-linecap'))
        const arcPoints = [...angleArcElement.getAttribute('d').matchAll(/(?:M|L) ([-\d.]+) ([-\d.]+)/g)]
            .map(([, x, y]) => ({x: Number(x), y: Number(y)}))
        const cameraAxisX = Number(cameraAxis.getAttribute('x2')) - Number(cameraAxis.getAttribute('x1'))
        const cameraAxisY = Number(cameraAxis.getAttribute('y2')) - Number(cameraAxis.getAttribute('y1'))
        const arcStartX = arcPoints[0].x - Number(cameraAxis.getAttribute('x1'))
        const arcStartY = arcPoints[0].y - Number(cameraAxis.getAttribute('y1'))
        const arcEndX = arcPoints.at(-1).x - Number(cameraAxis.getAttribute('x1'))
        const arcEndY = arcPoints.at(-1).y - Number(cameraAxis.getAttribute('y1'))
        expect(Math.abs((arcStartX * cameraAxisY) - (arcStartY * cameraAxisX)))
            .toBeLessThan(0.002 * Math.hypot(arcStartX, arcStartY) * Math.hypot(cameraAxisX, cameraAxisY))
        expect((arcEndX * tangentX) + (arcEndY * tangentY)).toBeGreaterThan(0)
        const routeStart = routeAfter.getAttribute('d').match(/^M ([-\d.]+) ([-\d.]+)/).slice(1).map(Number)
        expect(routeStart[0]).toBeCloseTo(Number(cameraAxis.getAttribute('x1')), 3)
        expect(routeStart[1]).toBeCloseTo(Number(cameraAxis.getAttribute('y1')), 3)
        const labelRotation = Number(angleLabel.getAttribute('transform').match(/^rotate\(([-\d.]+)/)?.[1]) * Math.PI / 180
        const labelX = Number(angleLabel.getAttribute('x'))
        const labelY = Number(angleLabel.getAttribute('y'))
        expect(Math.abs((Math.cos(labelRotation) * cameraAxisX) + (Math.sin(labelRotation) * cameraAxisY)))
            .toBeLessThan(0.001 * Math.hypot(cameraAxisX, cameraAxisY))
        const labelOffsetX = labelX - Number(cameraAxis.getAttribute('x1'))
        const labelOffsetY = labelY - Number(cameraAxis.getAttribute('y1'))
        expect((labelOffsetX * cameraAxisX) + (labelOffsetY * cameraAxisY)).toBeGreaterThan(0)
        const labelRadius = Math.hypot(labelOffsetX, labelOffsetY)
        expect(labelRadius).toBeGreaterThan(Math.hypot(arcStartX, arcStartY))
        expect(labelRadius).toBeLessThan(Math.hypot(cameraAxisX, cameraAxisY))
        const coneVertices = outerPath.getAttribute('d').match(/^M ([-\d.]+) ([-\d.]+) L ([-\d.]+) ([-\d.]+) L ([-\d.]+) ([-\d.]+)/)
            .slice(1)
            .map(Number)
        const [baseLeftX, baseLeftY, tipX, tipY, baseRightX, baseRightY] = coneVertices
        const coneBaseWidth = Math.hypot(baseRightX - baseLeftX, baseRightY - baseLeftY)
        const coneBaseWidthScale = Number(outerPath.getAttribute('data-base-width-scale'))
        expect(coneBaseWidthScale).toBeGreaterThan(1)
        expect(Math.hypot(arcStartX, arcStartY)).toBeCloseTo(coneBaseWidth * 0.4 / coneBaseWidthScale, 3)
        const arcRadii = arcPoints.map(point => Math.hypot(
            point.x - Number(cameraAxis.getAttribute('x1')),
            point.y - Number(cameraAxis.getAttribute('y1')),
        ))
        expect(arcRadii.every(radius => Math.abs(radius - arcRadii[0]) < 0.001)).toBe(true)
        const firstRouteCurve = routeAfter.getAttribute('d').match(/^M ([-\d.]+) ([-\d.]+) Q ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)/)
            ?.slice(1)
            .map(Number)
        expect(firstRouteCurve).not.toBeNull()
        const routeCurveDistance = Array.from({length: 101}, (_, index) => {
            const ratio = index / 100
            const inverse = 1 - ratio
            const routeX = (inverse ** 2 * firstRouteCurve[0])
                + (2 * inverse * ratio * firstRouteCurve[2])
                + (ratio ** 2 * firstRouteCurve[4])
            const routeY = (inverse ** 2 * firstRouteCurve[1])
                + (2 * inverse * ratio * firstRouteCurve[3])
                + (ratio ** 2 * firstRouteCurve[5])
            return Math.hypot(arcPoints.at(-1).x - routeX, arcPoints.at(-1).y - routeY)
        }).reduce((closest, distance) => Math.min(closest, distance), Infinity)
        expect(routeCurveDistance).toBeLessThan(1)
        const pointInCone = ((baseLeftX - labelX) * (tipY - labelY) - (tipX - labelX) * (baseLeftY - labelY))
                * ((tipX - labelX) * (baseRightY - labelY) - (baseRightX - labelX) * (tipY - labelY)) >= 0
            && ((tipX - labelX) * (baseRightY - labelY) - (baseRightX - labelX) * (tipY - labelY))
                * ((baseRightX - labelX) * (baseLeftY - labelY) - (baseLeftX - labelX) * (baseRightY - labelY)) >= 0
        expect(pointInCone).toBe(true)
        const angleArcClipId = angleArcElement.getAttribute('clip-path').match(/^url\(#(.+)\)$/)?.[1]
        const angleArcClip = overlay.querySelector(`#${angleArcClipId}`)
        expect(angleArcClip?.tagName.toLowerCase()).toBe('clippath')
        const insetClipPath = angleArcClip?.querySelector('path')?.getAttribute('d')
        expect(insetClipPath).not.toBe(outerPath.getAttribute('d'))
        expect(insetClipPath).toMatch(/^M /)
        const insetVertices = [...insetClipPath.matchAll(/(?:M|L) ([-\d.]+) ([-\d.]+)/g)]
            .map(([, x, y]) => ({x: Number(x), y: Number(y)}))
        expect(insetVertices).toHaveLength(5)
        const coneEdges = [
            [{x: baseLeftX, y: baseLeftY}, {x: tipX, y: tipY}],
            [{x: tipX, y: tipY}, {x: baseRightX, y: baseRightY}],
        ]
        const distanceToEdge = (point, [start, end]) => {
            const edgeX = end.x - start.x
            const edgeY = end.y - start.y
            const ratio = Math.max(0, Math.min(1, (
                ((point.x - start.x) * edgeX) + ((point.y - start.y) * edgeY)
            ) / ((edgeX ** 2) + (edgeY ** 2))))
            return Math.hypot(
                point.x - start.x - (ratio * edgeX),
                point.y - start.y - (ratio * edgeY),
            )
        }
        for (const insetVertex of insetVertices.slice(0, 3)) {
            expect(Math.min(...coneEdges.map(edge => distanceToEdge(insetVertex, edge))))
                .toBeCloseTo(6, 3)
        }
        const simulationEndpoint = arcPoints.at(-1)
        const clipCrossProducts = insetVertices.map((start, index) => {
            const end = insetVertices[(index + 1) % insetVertices.length]
            return ((end.x - start.x) * (simulationEndpoint.y - start.y))
                - ((end.y - start.y) * (simulationEndpoint.x - start.x))
        })
        expect(clipCrossProducts.every(value => value >= 0)
            || clipCrossProducts.every(value => value <= 0)).toBe(true)
        expect(overlay.querySelector('[data-part="camera-angle-arc"]')?.getAttribute('d')).toMatch(/^M /)
        expect((overlay.querySelector('[data-part="camera-angle-arc"]')?.getAttribute('d').match(/L /g) ?? []).length).toBeGreaterThan(10)
        expect(overlay.querySelector('[data-part="camera-position-axis"]')).not.toBeNull()
        expect(overlay.querySelectorAll('path[stroke]')).toHaveLength(2)
        const lines = overlay.querySelectorAll('line')
        expect(lines).toHaveLength(3)
        expect([...lines].filter(line => line.dataset.part !== 'camera-position-axis').every(line => line.getAttribute('stroke-width') === '1')).toBe(true)
        expect([...lines].filter(line => line.dataset.part !== 'camera-position-axis')
            .every(line => line.getAttribute('stroke-linecap') === 'butt')).toBe(true)
        expect(cameraAxis.getAttribute('stroke-linecap')).toBe('round')
        expect(lines[0].getAttribute('stroke')).toBe(lines[1].getAttribute('stroke'))
        const icons = overlay.querySelectorAll('img')
        expect(icons).toHaveLength(1)
        const activityIcon = overlay.querySelector('[data-part="trace-activity-icon"]')
        expect(activityIcon?.style.borderRadius).toBe('50%')
        expect(activityIcon?.style.background).toBe('rgb(255, 255, 255)')
        expect(activityIcon?.querySelector('[data-part="trace-activity-glyph"]')?.getAttribute('name')).toBe('bicycle')
        expect(icons[0].src).toContain('video')
        expect(decodeURIComponent(icons[0].src)).toContain('fill="#ffffff"')
        expect(decodeURIComponent(icons[0].src)).toContain('stroke-width="2"')
        expect(icons[0].style.transform).toContain('rotate(')
        expect(overlay.style.visibility).toBe('visible')

        const behindGuide = resolveJourneyReplayCameraAngleGuide({
            camera: {
                headingOffset: 0,
                positionMode:  'behind',
            },
            journey,
        })
        expect(behindGuide.angleDegrees).toBe(180)

        const initialPoints = outerPath.getAttribute('d')
        viewer.camera.heading = Math.PI / 6
        cameraChangedListener()
        expect(outerPath.getAttribute('d')).toBe(initialPoints)
        metersPerPixel = 0.5
        cameraChangedListener()
        const resizedPoints = outerPath.getAttribute('d')
        expect(resizedPoints).not.toBe(initialPoints)
        metersPerPixel = 0.1
        cameraChangedListener()
        const zoomedInPoints = outerPath.getAttribute('d')
        metersPerPixel = 0.2
        cameraChangedListener()
        expect(outerPath.getAttribute('d')).toBe(zoomedInPoints)
        postRenderListener()
        hideDeparture = true
        cameraChangedListener()
        expect(overlay.style.visibility).toBe('visible')
        hideDeparture = false
        cameraChangedListener()
        expect(overlay.style.visibility).toBe('visible')
        moveDepartureOutsideViewport = true
        cameraChangedListener()
        expect(overlay.style.visibility).toBe('hidden')
        moveDepartureOutsideViewport = false
        cameraChangedListener()
        expect(overlay.style.visibility).toBe('visible')
        moveRouteEndOutsideViewport = true
        cameraChangedListener()
        expect(overlay.style.visibility).toBe('hidden')
        moveRouteEndOutsideViewport = false
        cameraChangedListener()
        expect(overlay.style.visibility).toBe('visible')
        occludeDeparture = true
        cameraMoveStartListener()
        postRenderListener()
        expect(overlay.style.visibility).toBe('hidden')
        expect(cameraGuideSvg.style.visibility).toBe('hidden')
        expect(routeAfter.ownerSVGElement.style.visibility).toBe('hidden')
        expect(overlay.querySelector('[data-part="trace-activity-icon"]')?.style.visibility).toBe('hidden')
        expect(overlay.querySelector('[data-part="journey-route-after"]').style.display).toBe('block')
        cameraChangedListener()
        expect(overlay.style.visibility).toBe('visible')
        postRenderListener()
        expect(overlay.style.visibility).toBe('hidden')
        expect(cameraGuideSvg.style.visibility).toBe('hidden')
        expect(routeAfter.ownerSVGElement.style.visibility).toBe('hidden')
        occludeDeparture = false
        cameraMoveStartListener()
        postRenderListener()
        expect(overlay.style.visibility).toBe('visible')
        expect(routeAfter.ownerSVGElement.style.visibility).toBe('visible')
        pickAtLowerSimulatedAltitude = true
        cameraMoveStartListener()
        postRenderListener()
        expect(overlay.style.visibility).toBe('visible')
        pickAtLowerSimulatedAltitude = false
        viewer.camera.position = Cartesian3.fromDegrees(2, 48, 1000)
        terrainHeight = 400
        pickHeight = 110
        cameraMoveStartListener()
        postRenderListener()
        expect(overlay.style.visibility).toBe('visible')
        terrainHeight = null
        pickHeight = null
        projectedWorldPoints.length = 0
        cameraMoveStartListener()
        postRenderListener()
        expect(overlay.style.visibility).toBe('visible')
        const ellipsoidClampedStart = projectedWorldPoints.find(point =>
            Math.abs(point.longitude - guide.routeStart.longitude) < 1e-8
            && Math.abs(point.latitude - guide.routeStart.latitude) < 1e-8,
        )
        expect(ellipsoidClampedStart).toBeDefined()
        expect(ellipsoidClampedStart.height).toBeCloseTo(0, 6)
        viewer.camera.position = new Cartesian3(0, 0, 0)
        pickHeight = null
        cameraMoveStartListener()
        postRenderListener()
        expect(overlay.style.visibility).toBe('visible')

        expect(updateJourneyReplayCameraAngleGuide(viewer, resolveJourneyReplayCameraAngleGuide({
            camera: {cameraAngle: 12},
            journey,
        }))).toBe(true)
        expect(angleLabel.textContent).toBe('+168°')
        const guidePositionBeforePlayback = outerPath.getAttribute('d')
        const routeBeforePlayback = routeAfter.getAttribute('d')
        const movingGuide = resolveJourneyReplayCameraAngleGuide({
            camera: {cameraAngle: 12},
            journey,
            sample: {
                longitude:  2.002,
                latitude:   48.002,
                altitude:   120,
                source: {
                    startPoint: {longitude: 2.001, latitude: 48.001, altitude: 110},
                    endPoint:   {longitude: 2.003, latitude: 48.003, altitude: 130},
                },
            },
        })
        expect(updateJourneyReplayCameraAngleGuide(viewer, movingGuide)).toBe(true)
        expect(container.querySelector('.replay-camera-angle-guide-dom')).toBe(overlay)
        expect(outerPath.getAttribute('d')).not.toBe(guidePositionBeforePlayback)
        expect(routeAfter.getAttribute('d')).toBe(routeBeforePlayback)
        viewer.camera.heading = movingGuide.baseHeading
        cameraChangedListener()
        expect(angleLabel.textContent).toBe('+168°')
        const conePathAtConfiguredAngle = outerPath.getAttribute('d')
        const angleArcAtConfiguredAngle = overlay.querySelector('[data-part="camera-angle-arc"]').getAttribute('d')
        const cameraPositionAtConfiguredAngle = [cameraAxis.getAttribute('x2'), cameraAxis.getAttribute('y2')]
        viewer.camera.heading = movingGuide.baseHeading + (Math.PI / 4)
        cameraChangedListener()
        expect(angleLabel.textContent).toBe('+168°')
        expect(outerPath.getAttribute('d')).toBe(conePathAtConfiguredAngle)
        expect(overlay.querySelector('[data-part="camera-angle-arc"]').getAttribute('d')).toBe(angleArcAtConfiguredAngle)
        const adjustedGuide = resolveJourneyReplayCameraAngleGuide({
            camera: {cameraAngle: 45},
            journey,
            sample: {
                longitude: 2.002,
                latitude: 48.002,
                altitude: 120,
                source: {
                    startPoint: {longitude: 2.001, latitude: 48.001, altitude: 110},
                    endPoint: {longitude: 2.003, latitude: 48.003, altitude: 130},
                },
            },
        })
        expect(updateJourneyReplayCameraAngleGuide(viewer, adjustedGuide)).toBe(true)
        expect(angleLabel.textContent).toBe('+135°')
        const coneWidthScaleAt45 = Number(outerPath.getAttribute('data-base-width-scale'))
        const wideAngleGuide = resolveJourneyReplayCameraAngleGuide({
            camera: {cameraAngle: 140},
            journey,
        })
        expect(updateJourneyReplayCameraAngleGuide(viewer, wideAngleGuide)).toBe(true)
        expect(Number(outerPath.getAttribute('data-base-width-scale'))).toBeGreaterThan(coneWidthScaleAt45)
        const wideArc = [...overlay.querySelector('[data-part="camera-angle-arc"]').getAttribute('d')
            .matchAll(/(?:M|L) ([-\d.]+) ([-\d.]+)/g)]
            .map(([, x, y]) => ({x: Number(x), y: Number(y)}))
        const wideClipId = overlay.querySelector('[data-part="camera-angle-arc"]')
            .getAttribute('clip-path').match(/^url\(#(.+)\)$/)?.[1]
        const wideClipPath = overlay.querySelector(`#${wideClipId} path`).getAttribute('d')
        const wideClipVertices = [...wideClipPath.matchAll(/(?:M|L) ([-\d.]+) ([-\d.]+)/g)]
            .map(([, x, y]) => ({x: Number(x), y: Number(y)}))
        const pointIsInWideClip = point => {
            let inside = false
            for (let index = 0, previous = wideClipVertices.length - 1; index < wideClipVertices.length; previous = index, index += 1) {
                const start = wideClipVertices[index]
                const end = wideClipVertices[previous]
                const crossesRay = (start.y > point.y) !== (end.y > point.y)
                    && point.x < ((end.x - start.x) * (point.y - start.y) / (end.y - start.y)) + start.x
                if (crossesRay) {
                    inside = !inside
                }
            }
            return inside
        }
        expect(wideArc.filter(point => !pointIsInWideClip(point))).toEqual([])
        const fractionalDisplayGuide = resolveJourneyReplayCameraAngleGuide({
            camera: {cameraAngle: 12.6},
            journey,
        })
        expect(updateJourneyReplayCameraAngleGuide(viewer, fractionalDisplayGuide)).toBe(true)
        expect(angleLabel.textContent).toBe('+167°')
        expect(overlay.querySelector('[data-part="camera-angle-arc"]').getAttribute('d')).not.toBe(angleArcAtConfiguredAngle)
        expect([cameraAxis.getAttribute('x2'), cameraAxis.getAttribute('y2')]).not.toEqual(cameraPositionAtConfiguredAngle)
        const conePathBeforeAltitudeChange = outerPath.getAttribute('d')
        const lowerCameraGuide = resolveJourneyReplayCameraAngleGuide({
            camera: {altitude: 600, cameraAngle: 12},
            journey,
            sample: {
                longitude:  2.002,
                latitude:   48.002,
                altitude:   120,
                source: {
                    startPoint: {longitude: 2.001, latitude: 48.001, altitude: 110},
                    endPoint:   {longitude: 2.003, latitude: 48.003, altitude: 130},
                },
            },
        })
        updateJourneyReplayCameraAngleGuide(viewer, lowerCameraGuide)
        expect(outerPath.getAttribute('d')).not.toBe(conePathBeforeAltitudeChange)
        occludeDeparture = true
        postRenderListener()
        expect(overlay.style.visibility).toBe('hidden')
        expect(cameraGuideSvg.style.visibility).toBe('hidden')
        canvas.dispatchEvent(new Event('pointerdown'))
        postRenderListener()
        expect(overlay.style.visibility).toBe('hidden')
        cameraMoveStartListener()
        postRenderListener()
        expect(overlay.style.visibility).toBe('hidden')

        expect(removeJourneyReplayCameraAngleGuide(viewer)).toBe(true)
        expect(container.querySelector('.replay-camera-angle-guide-dom')).toBeNull()
        container.remove()
    })
})
