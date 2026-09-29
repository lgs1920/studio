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
 * Last modified: 2026-09-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, it, vi} from 'vitest'
import {Cartesian3, Cartographic} from 'cesium'
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
    it('adjusts replay heading and displayed camera angle with map arrow keys', () => {
        const camera = {
            heading:       179,
            headingOffset: 0,
            positionMode:  'behind',
        }

        expect(replayCameraSettingsFromArrowKey(camera, 'ArrowUp').heading).toBe(180)
        expect(replayCameraSettingsFromArrowKey(camera, 'ArrowUp').headingOffset).toBe(0)
        expect(replayCameraSettingsFromArrowKey(camera, 'ArrowDown').heading).toBe(178)
        expect(replayCameraSettingsFromArrowKey(camera, 'ArrowDown').headingOffset).toBe(0)
        expect(replayCameraSettingsFromArrowKey(camera, 'ArrowRight').headingOffset).toBe(-1)
        expect(replayCameraSettingsFromArrowKey(camera, 'ArrowLeft').headingOffset).toBe(1)
        expect(replayCameraSettingsFromArrowKey({positionMode: 'system'}, 'ArrowRight')).toBeNull()
        expect(replayCameraSettingsFromArrowKey({heading: 180}, 'ArrowUp').heading).toBe(-180)
        expect(replayCameraSettingsFromArrowKey({heading: -180}, 'ArrowDown').heading).toBe(180)
        expect(replayCameraSettingsFromArrowKey({heading: 179, positionMode: 'system'}, 'ArrowDown').heading).toBe(178)
        expect(replayCameraSettingsFromArrowKey({headingOffset: -180, positionMode: 'behind'}, 'ArrowRight').headingOffset).toBe(180)
        expect(replayCameraSettingsFromArrowKey({headingOffset: 180, positionMode: 'behind'}, 'ArrowLeft').headingOffset).toBe(-180)
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
        expect(guide.mode).toBe('Behind')
        expect(guide.angleDegrees).toBe(-25)
        expect(guide.cameraHeading - guide.baseHeading).toBeCloseTo(25 * Math.PI / 180, 8)
        expect(guide.coneHeading - guide.cameraHeading).toBeCloseTo(Math.PI, 8)
        expect(guide.coneHeading - guide.axisHeading).toBeCloseTo(Math.PI + (25 * Math.PI / 180), 8)
        const turnedGuide = resolveJourneyReplayCameraAngleGuide({
            camera: {
                headingOffset: -5,
                positionMode:  'behind',
            },
            journey,
        })
        expect(turnedGuide.coneHeading - guide.coneHeading).toBeCloseTo(-30 * Math.PI / 180, 8)
        const fractionalAngleGuide = resolveJourneyReplayCameraAngleGuide({
            camera: {headingOffset: 12.6, positionMode: 'behind'},
            journey,
        })
        expect(fractionalAngleGuide.angleDegrees).toBe(-13)
    })

    it('does not create an angle guide for the fixed camera', () => {
        expect(resolveJourneyReplayCameraAngleGuide({
            camera: {headingOffset: 40, positionMode: 'system'},
            journey,
        })).toBeNull()
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
        expect(guide.angleDegrees).toBe(-15)
    })

    it('mounts a synchronized DOM cone with solid circular icons', () => {
        const container = document.createElement('div')
        const canvas = document.createElement('canvas')
        container.appendChild(canvas)
        document.body.appendChild(container)
        let metersPerPixel = 1
        let hideDeparture = false
        let moveDepartureOutsideViewport = false
        let occludeDeparture = false
        let pickAtLowerSimulatedAltitude = false
        let terrainHeight = null
        let pickHeight = null
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
                    result.x = 500 + ((positionCartographic.longitude * 180 / Math.PI) - 2) * 111319 * Math.cos(48 * Math.PI / 180)
                    result.y = 400 - ((positionCartographic.latitude * 180 / Math.PI) - 48) * 111319
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
        const guide = resolveJourneyReplayCameraAngleGuide({
            camera: {
                headingOffset: 0,
                positionMode:  'ahead',
            },
            journey: {
                ...journey,
                activitySettings: {icon: 'bicycle'},
            },
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
        expect(overlay.querySelectorAll('path')).toHaveLength(5)
        const outerPath = overlay.querySelector('path[data-part="outer"]')
        const innerPath = overlay.querySelector('path[data-part="inner"]')
        expect(outerPath).not.toBeNull()
        expect(innerPath).not.toBeNull()
        expect(overlay.querySelector('text[data-part="angle-label"]')?.textContent).toBe('0°')
        expect(outerPath.getAttribute('d')).toContain(' A ')
        expect(innerPath.getAttribute('d')).toContain(' A ')
        const traceArrowHead = overlay.querySelector('[data-part="trace-direction-arrow-head"]')
        const traceArrow = overlay.querySelector('[data-part="trace-direction-arrow"]')
        expect(traceArrowHead.getAttribute('d')).toMatch(/^M /)
        expect(traceArrowHead.getAttribute('d').match(/L /g)).toHaveLength(2)
        expect(traceArrowHead.getAttribute('fill')).not.toBe('none')
        expect(traceArrowHead.getAttribute('stroke-linejoin')).toBe('round')
        expect(traceArrowHead.getAttribute('stroke-linecap')).toBe('round')
        expect(traceArrowHead.getAttribute('stroke')).toBe(traceArrow.getAttribute('stroke'))
        expect(traceArrowHead.getAttribute('fill')).toBe(traceArrow.getAttribute('stroke'))
        expect(traceArrow.getAttribute('stroke-width')).toBe('3')
        const projectedAnchor = viewer.scene.cartesianToCanvasCoordinates(
            Cartesian3.fromDegrees(guide.anchor.longitude, guide.anchor.latitude, guide.coneHeight),
            {},
        )
        const projectedDirection = viewer.scene.cartesianToCanvasCoordinates(
            Cartesian3.fromDegrees(guide.directionPoint.longitude, guide.directionPoint.latitude, guide.coneHeight),
            {},
        )
        const tangentX = projectedDirection.x - projectedAnchor.x
        const tangentY = projectedDirection.y - projectedAnchor.y
        const arrowX = Number(traceArrow.getAttribute('x2')) - Number(traceArrow.getAttribute('x1'))
        const arrowY = Number(traceArrow.getAttribute('y2')) - Number(traceArrow.getAttribute('y1'))
        const tangentArrowCross = (tangentX * arrowY) - (tangentY * arrowX)
        const tangentArrowScale = Math.hypot(tangentX, tangentY) * Math.hypot(arrowX, arrowY)
        expect(Math.abs(tangentArrowCross / tangentArrowScale)).toBeLessThan(0.002)
        expect(traceArrow.getAttribute('stroke-dasharray')).toBe('6 5')
        expect(traceArrow.getAttribute('stroke')).toBe(overlay.querySelector('[data-part="camera-angle-arc"]').getAttribute('stroke'))
        const arrowTip = traceArrowHead.getAttribute('d').match(/^M ([-\d.]+) ([-\d.]+)/).slice(1).map(Number)
        const arrowStart = [Number(traceArrow.getAttribute('x1')), Number(traceArrow.getAttribute('y1'))]
        const fullArrowLength = Math.hypot(arrowTip[0] - arrowStart[0], arrowTip[1] - arrowStart[1])
        expect(fullArrowLength).toBeGreaterThan(180)
        expect(Math.hypot(
            ((arrowTip[0] + arrowStart[0]) / 2) - projectedAnchor.x,
            ((arrowTip[1] + arrowStart[1]) / 2) - projectedAnchor.y,
        )).toBeLessThan(2)
        const traceActivityIcon = overlay.querySelector('[data-part="trace-activity-icon"]')
        expect(Math.hypot(
            Number.parseFloat(traceActivityIcon.style.left) - projectedAnchor.x,
            Number.parseFloat(traceActivityIcon.style.top) - projectedAnchor.y,
        )).toBeGreaterThan(100)
        const dragTarget = overlay.querySelector('[data-part="cone-drag-target"]')
        const cesiumPointerListeners = Object.fromEntries(
            ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].map(type => [type, vi.fn()]),
        )
        for (const [type, listener] of Object.entries(cesiumPointerListeners)) {
            container.addEventListener(type, listener)
        }
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
        dragTarget.dispatchEvent(pointerEvent('pointerdown', projectedAnchor.x + 50, projectedAnchor.y))
        expect(cameraController.enableRotate).toBe(false)
        overlay.querySelector('svg').dispatchEvent(pointerEvent('pointermove', projectedAnchor.x, projectedAnchor.y + 50))
        expect(cameraChangeListener).not.toHaveBeenCalled()
        expect(overlay.querySelector('text[data-part="angle-label"]').textContent).toBe('-90°')
        overlay.querySelector('svg').dispatchEvent(pointerEvent('pointerup', projectedAnchor.x, projectedAnchor.y + 50))
        expect(cameraController.enableRotate).toBe(true)
        expect(cameraChangeListener).toHaveBeenLastCalledWith({altitude: 1200, headingOffset: 90})
        dragTarget.dispatchEvent(pointerEvent('pointerdown', projectedAnchor.x + 50, projectedAnchor.y))
        overlay.querySelector('svg').dispatchEvent(pointerEvent('pointermove', projectedAnchor.x + 25, projectedAnchor.y))
        expect(cameraChangeListener).toHaveBeenCalledTimes(1)
        overlay.querySelector('svg').dispatchEvent(pointerEvent('pointerup', projectedAnchor.x + 25, projectedAnchor.y))
        expect(cameraChangeListener).toHaveBeenLastCalledWith({altitude: 600, headingOffset: 90})
        const cameraMarker = overlay.querySelector('img')
        const cameraMarkerX = Number.parseFloat(cameraMarker.style.left)
        const cameraMarkerY = Number.parseFloat(cameraMarker.style.top)
        const cameraMarkerAngle = Math.atan2(cameraMarkerY - projectedAnchor.y, cameraMarkerX - projectedAnchor.x)
        const cameraMarkerRadius = Math.hypot(cameraMarkerX - projectedAnchor.x, cameraMarkerY - projectedAnchor.y)
        const draggedMarkerAngle = cameraMarkerAngle + (Math.PI / 4)
        mapPickEnabled = true
        cameraMarker.dispatchEvent(pointerEvent('pointerdown', cameraMarkerX, cameraMarkerY))
        overlay.querySelector('svg').dispatchEvent(pointerEvent(
            'pointermove',
            projectedAnchor.x + (Math.cos(draggedMarkerAngle) * cameraMarkerRadius * 1.5),
            projectedAnchor.y + (Math.sin(draggedMarkerAngle) * cameraMarkerRadius * 1.5),
        ))
        expect(cameraChangeListener).toHaveBeenCalledTimes(2)
        expect(overlay.querySelector('text[data-part="angle-label"]').textContent).toBe('-135°')
        overlay.querySelector('svg').dispatchEvent(pointerEvent('pointerup', cameraMarkerX, cameraMarkerY))
        expect(cameraChangeListener.mock.lastCall[0].headingOffset).toBeCloseTo(135, 2)
        expect(cameraChangeListener.mock.lastCall[0].altitude).toBeCloseTo(600, 8)
        expect(Object.values(cesiumPointerListeners).every(listener => listener.mock.calls.length === 0)).toBe(true)
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
        expect(gradientStops[0].getAttribute('stop-color')).toBe('rgb(0,184,184)')
        const angleLabel = overlay.querySelector('text[data-part="angle-label"]')
        const cameraAxis = overlay.querySelector('[data-part="camera-position-axis"]')
        expect(angleLabel).not.toBeNull()
        expect(angleLabel.textContent).toBe('-135°')
        expect(angleLabel.getAttribute('fill')).toBe('rgb(0,184,184)')
        expect(angleLabel.getAttribute('opacity')).toBe('1')
        expect(angleLabel.getAttribute('transform')).toMatch(/^rotate\(/)
        const angleArcElement = overlay.querySelector('[data-part="camera-angle-arc"]')
        expect(angleArcElement.getAttribute('stroke-dasharray')).toBe('6 5')
        expect(cameraAxis.getAttribute('stroke')).toBe(angleArcElement.getAttribute('stroke'))
        const arcPoints = [...angleArcElement.getAttribute('d').matchAll(/(?:M|L) ([-\d.]+) ([-\d.]+)/g)]
            .map(([, x, y]) => ({x: Number(x), y: Number(y)}))
        const cameraAxisX = Number(cameraAxis.getAttribute('x2')) - Number(cameraAxis.getAttribute('x1'))
        const cameraAxisY = Number(cameraAxis.getAttribute('y2')) - Number(cameraAxis.getAttribute('y1'))
        const arcStartX = arcPoints[0].x - Number(cameraAxis.getAttribute('x1'))
        const arcStartY = arcPoints[0].y - Number(cameraAxis.getAttribute('y1'))
        const arcEndX = arcPoints.at(-1).x - Number(cameraAxis.getAttribute('x1'))
        const arcEndY = arcPoints.at(-1).y - Number(cameraAxis.getAttribute('y1'))
        expect((arcStartX * tangentX) + (arcStartY * tangentY)).toBeGreaterThan(0)
        expect((arcEndX * cameraAxisX) + (arcEndY * cameraAxisY)).toBeGreaterThan(0)
        expect(Math.abs((arcEndX * cameraAxisY) - (arcEndY * cameraAxisX)))
            .toBeLessThan(0.002 * Math.hypot(arcEndX, arcEndY) * Math.hypot(cameraAxisX, cameraAxisY))
        const labelRotation = Number(angleLabel.getAttribute('transform').match(/^rotate\(([-\d.]+)/)?.[1]) * Math.PI / 180
        expect(Math.abs((Math.cos(labelRotation) * cameraAxisX) + (Math.sin(labelRotation) * cameraAxisY)))
            .toBeLessThan(0.001 * Math.hypot(cameraAxisX, cameraAxisY))
        const coneVertices = outerPath.getAttribute('d').match(/^M ([-\d.]+) ([-\d.]+) L ([-\d.]+) ([-\d.]+) L ([-\d.]+) ([-\d.]+)/)
            .slice(1)
            .map(Number)
        const [baseLeftX, baseLeftY, tipX, tipY, baseRightX, baseRightY] = coneVertices
        const labelX = Number(angleLabel.getAttribute('x'))
        const labelY = Number(angleLabel.getAttribute('y'))
        const pointInCone = ((baseLeftX - labelX) * (tipY - labelY) - (tipX - labelX) * (baseLeftY - labelY))
                * ((tipX - labelX) * (baseRightY - labelY) - (baseRightX - labelX) * (tipY - labelY)) >= 0
            && ((tipX - labelX) * (baseRightY - labelY) - (baseRightX - labelX) * (tipY - labelY))
                * ((baseRightX - labelX) * (baseLeftY - labelY) - (baseLeftX - labelX) * (baseRightY - labelY)) >= 0
        expect(pointInCone).toBe(true)
        expect(overlay.querySelector('[data-part="camera-angle-arc"]')?.getAttribute('d')).toMatch(/^M /)
        expect((overlay.querySelector('[data-part="camera-angle-arc"]')?.getAttribute('d').match(/L /g) ?? []).length).toBeGreaterThan(10)
        expect(overlay.querySelector('[data-part="camera-position-axis"]')).not.toBeNull()
        expect(overlay.querySelectorAll('path[stroke]')).toHaveLength(2)
        expect(overlay.querySelector('path[data-part="trace-direction-arrow-head"][stroke]')).toBe(traceArrowHead)
        const lines = overlay.querySelectorAll('line')
        expect(lines).toHaveLength(5)
        expect([...lines].filter(line => line !== traceArrow && line.dataset.part !== 'camera-position-axis').every(line => line.getAttribute('stroke-width') === '1')).toBe(true)
        expect([...lines].filter(line => line !== traceArrow).every(line => line.getAttribute('stroke-linecap') === 'butt')).toBe(true)
        expect(traceArrow.getAttribute('stroke-linecap')).toBe('round')
        expect(lines[0].getAttribute('stroke')).toBe(gradientStops[0].getAttribute('stop-color'))
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
        expect(behindGuide.mode).toBe('Behind')

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
        expect(overlay.style.visibility).toBe('visible')
        moveDepartureOutsideViewport = false
        cameraChangedListener()
        expect(overlay.style.visibility).toBe('visible')
        occludeDeparture = true
        cameraMoveStartListener()
        postRenderListener()
        expect(overlay.style.visibility).toBe('hidden')
        cameraChangedListener()
        expect(overlay.style.visibility).toBe('visible')
        postRenderListener()
        expect(overlay.style.visibility).toBe('hidden')
        occludeDeparture = false
        cameraMoveStartListener()
        postRenderListener()
        expect(overlay.style.visibility).toBe('visible')
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
        cameraMoveStartListener()
        postRenderListener()
        expect(overlay.style.visibility).toBe('visible')
        viewer.camera.position = new Cartesian3(0, 0, 0)
        pickHeight = null
        cameraMoveStartListener()
        postRenderListener()
        expect(overlay.style.visibility).toBe('visible')

        expect(updateJourneyReplayCameraAngleGuide(viewer, resolveJourneyReplayCameraAngleGuide({
            camera: {headingOffset: 12, positionMode: 'ahead'},
            journey,
        }))).toBe(true)
        expect(angleLabel.textContent).toBe('-12°')
        const guidePositionBeforePlayback = outerPath.getAttribute('d')
        const arrowTipBeforePlayback = traceArrow.getAttribute('x2')
        const movingGuide = resolveJourneyReplayCameraAngleGuide({
            camera: {headingOffset: 12, positionMode: 'ahead'},
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
        expect(traceArrow.getAttribute('x2')).not.toBe(arrowTipBeforePlayback)
        viewer.camera.heading = movingGuide.baseHeading
        cameraChangedListener()
        expect(angleLabel.textContent).toBe('-12°')
        const conePathAtConfiguredAngle = outerPath.getAttribute('d')
        const angleArcAtConfiguredAngle = overlay.querySelector('[data-part="camera-angle-arc"]').getAttribute('d')
        const cameraPositionAtConfiguredAngle = [cameraAxis.getAttribute('x2'), cameraAxis.getAttribute('y2')]
        viewer.camera.heading = movingGuide.baseHeading + (Math.PI / 4)
        cameraChangedListener()
        expect(angleLabel.textContent).toBe('-12°')
        expect(outerPath.getAttribute('d')).toBe(conePathAtConfiguredAngle)
        expect(overlay.querySelector('[data-part="camera-angle-arc"]').getAttribute('d')).toBe(angleArcAtConfiguredAngle)
        const adjustedGuide = resolveJourneyReplayCameraAngleGuide({
            camera: {headingOffset: 45, positionMode: 'ahead'},
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
        expect(angleLabel.textContent).toBe('-45°')
        const fractionalDisplayGuide = resolveJourneyReplayCameraAngleGuide({
            camera: {headingOffset: 12.6, positionMode: 'ahead'},
            journey,
        })
        expect(updateJourneyReplayCameraAngleGuide(viewer, fractionalDisplayGuide)).toBe(true)
        expect(angleLabel.textContent).toBe('-13°')
        expect(overlay.querySelector('[data-part="camera-angle-arc"]').getAttribute('d')).not.toBe(angleArcAtConfiguredAngle)
        expect([cameraAxis.getAttribute('x2'), cameraAxis.getAttribute('y2')]).not.toEqual(cameraPositionAtConfiguredAngle)
        const conePathBeforeAltitudeChange = outerPath.getAttribute('d')
        const lowerCameraGuide = resolveJourneyReplayCameraAngleGuide({
            camera: {altitude: 600, headingOffset: 12, positionMode: 'ahead'},
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
