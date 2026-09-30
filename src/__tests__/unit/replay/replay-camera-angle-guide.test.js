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
 * Last modified: 2026-09-30
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
                tracks: new Map([['track-1', {
                    content: {
                        geometry: {
                            type: 'LineString',
                            coordinates: [[2, 48, 100], [2.0005, 48.0005, 105], [2.001, 48.001, 110]],
                        },
                    },
                }]]),
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
        expect(overlay.querySelectorAll('path')).toHaveLength(7)
        const outerPath = overlay.querySelector('path[data-part="outer"]')
        const innerPath = overlay.querySelector('path[data-part="inner"]')
        const cameraGuideSvg = outerPath.ownerSVGElement
        expect(outerPath).not.toBeNull()
        expect(innerPath).not.toBeNull()
        expect(overlay.querySelector('text[data-part="angle-label"]')?.textContent).toBe('0°')
        expect(outerPath.getAttribute('d')).toContain(' A ')
        expect(innerPath.getAttribute('d')).toContain(' A ')
        const routeAfter = overlay.querySelector('[data-part="journey-route-after"]')
        expect(routeAfter.getAttribute('d')).toMatch(/^M /)
        expect(routeAfter.getAttribute('d')).toContain(' Q ')
        expect(routeAfter.getAttribute('marker-end')).toMatch(/^url\(#replay-camera-angle-guide-route-arrow-/)
        const arrowMarker = overlay.querySelector('marker[orient="auto"]')
        expect(arrowMarker.getAttribute('markerWidth')).toBe('16')
        expect(arrowMarker.getAttribute('markerHeight')).toBe('12')
        expect(arrowMarker.querySelector('path').getAttribute('d')).toBe('M 0 0 L 16 6 L 0 12 z')
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
        const traceActivityIcon = overlay.querySelector('[data-part="trace-activity-icon"]')
        const iconStartGap = Math.hypot(
            Number.parseFloat(traceActivityIcon.style.left) - projectedAnchor.x,
            Number.parseFloat(traceActivityIcon.style.top) - projectedAnchor.y,
        ) - 14
        expect(iconStartGap).toBeCloseTo(4, 4)
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
        cameraGuideSvg.dispatchEvent(pointerEvent('pointermove', projectedAnchor.x, projectedAnchor.y + 50))
        expect(cameraChangeListener).not.toHaveBeenCalled()
        expect(overlay.querySelector('text[data-part="angle-label"]').textContent).toBe('-90°')
        cameraGuideSvg.dispatchEvent(pointerEvent('pointerup', projectedAnchor.x, projectedAnchor.y + 50))
        expect(cameraController.enableRotate).toBe(true)
        expect(cameraChangeListener.mock.lastCall[0].headingOffset).toBe(90)
        expect(cameraChangeListener.mock.lastCall[0].altitude).toBeCloseTo(1200, 8)
        dragTarget.dispatchEvent(pointerEvent('pointerdown', projectedAnchor.x + 50, projectedAnchor.y))
        cameraGuideSvg.dispatchEvent(pointerEvent('pointermove', projectedAnchor.x + 25, projectedAnchor.y))
        expect(cameraChangeListener).toHaveBeenCalledTimes(1)
        cameraGuideSvg.dispatchEvent(pointerEvent('pointerup', projectedAnchor.x + 25, projectedAnchor.y))
        expect(cameraChangeListener.mock.lastCall[0].headingOffset).toBe(90)
        expect(cameraChangeListener.mock.lastCall[0].altitude).toBeCloseTo(600, 8)
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
            projectedAnchor.x + (Math.cos(draggedMarkerAngle) * cameraMarkerRadius * 1.5),
            projectedAnchor.y + (Math.sin(draggedMarkerAngle) * cameraMarkerRadius * 1.5),
        ))
        expect(cameraChangeListener).toHaveBeenCalledTimes(2)
        expect(overlay.querySelector('text[data-part="angle-label"]').textContent).toBe('-135°')
        cameraGuideSvg.dispatchEvent(pointerEvent('pointerup', cameraMarkerX, cameraMarkerY))
        expect(cameraChangeListener.mock.lastCall[0].headingOffset).toBeCloseTo(135, 2)
        expect(cameraChangeListener.mock.lastCall[0].altitude).toBeCloseTo(900, 8)
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
        expect(overlay.querySelector('text[data-part="angle-label"]').textContent).toBe('-135°')
        cameraGuideSvg.dispatchEvent(pointerEvent('pointerup', tipDragX, tipDragY))
        expect(cameraChangeListener).toHaveBeenCalledTimes(cameraChangeCallsBeforeTipDrag + 1)
        expect(cameraChangeListener.mock.lastCall[0].headingOffset).toBeCloseTo(135, 2)
        expect(cameraChangeListener.mock.lastCall[0].altitude).toBeCloseTo(1125, 8)
        expect(Math.hypot(
            Number(tipDragTarget.getAttribute('cx')) - projectedAnchor.x,
            Number(tipDragTarget.getAttribute('cy')) - projectedAnchor.y,
        )).toBeGreaterThan(tipRadius)
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
        expect(Math.hypot(labelOffsetX, labelOffsetY)).toBeLessThan(Math.hypot(arcStartX, arcStartY))
        const coneVertices = outerPath.getAttribute('d').match(/^M ([-\d.]+) ([-\d.]+) L ([-\d.]+) ([-\d.]+) L ([-\d.]+) ([-\d.]+)/)
            .slice(1)
            .map(Number)
        const [baseLeftX, baseLeftY, tipX, tipY, baseRightX, baseRightY] = coneVertices
        const coneBaseWidth = Math.hypot(baseRightX - baseLeftX, baseRightY - baseLeftY)
        expect(Math.hypot(arcStartX, arcStartY)).toBeCloseTo(coneBaseWidth * 0.4, 3)
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
        expect(lines).toHaveLength(4)
        expect([...lines].filter(line => line.dataset.part !== 'camera-position-axis').every(line => line.getAttribute('stroke-width') === '1')).toBe(true)
        expect([...lines].filter(line => line.dataset.part !== 'camera-position-axis')
            .every(line => line.getAttribute('stroke-linecap') === 'butt')).toBe(true)
        expect(cameraAxis.getAttribute('stroke-linecap')).toBe('round')
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
        expect(overlay.style.visibility).toBe('visible')
        expect(cameraGuideSvg.style.visibility).toBe('hidden')
        expect(overlay.querySelector('[data-part="journey-route-after"]').style.display).toBe('block')
        cameraChangedListener()
        expect(overlay.style.visibility).toBe('visible')
        postRenderListener()
        expect(overlay.style.visibility).toBe('visible')
        expect(cameraGuideSvg.style.visibility).toBe('hidden')
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
        const routeBeforePlayback = routeAfter.getAttribute('d')
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
        expect(routeAfter.getAttribute('d')).toBe(routeBeforePlayback)
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
        expect(overlay.style.visibility).toBe('visible')
        expect(cameraGuideSvg.style.visibility).toBe('hidden')
        canvas.dispatchEvent(new Event('pointerdown'))
        postRenderListener()
        expect(overlay.style.visibility).toBe('visible')
        cameraMoveStartListener()
        postRenderListener()
        expect(overlay.style.visibility).toBe('visible')

        expect(removeJourneyReplayCameraAngleGuide(viewer)).toBe(true)
        expect(container.querySelector('.replay-camera-angle-guide-dom')).toBeNull()
        container.remove()
    })
})
