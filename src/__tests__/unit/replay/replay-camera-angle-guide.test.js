import {describe, expect, it} from 'vitest'
import {Cartesian3} from 'cesium'
import {
    mountJourneyReplayCameraAngleGuide,
    removeJourneyReplayCameraAngleGuide,
    resolveJourneyReplayCameraAngleGuide,
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

    it('mounts a synchronized DOM cone with solid circular icons', () => {
        const container = document.createElement('div')
        const canvas = document.createElement('canvas')
        container.appendChild(canvas)
        document.body.appendChild(container)
        let metersPerPixel = 1
        let hideDeparture = false
        let moveDepartureOutsideViewport = false
        let occludeDeparture = false
        let cameraChangedListener = null
        let postRenderListener = null
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
                getPixelSize() {
                    return metersPerPixel
                },
            },
            scene: {
                canvas,
                cartesianToCanvasCoordinates(position, result) {
                    if (hideDeparture) {
                        return undefined
                    }
                    result.x = 500 + (position.x % 1000) / 10
                    result.y = 400 + (position.y % 1000) / 10
                    if (moveDepartureOutsideViewport) {
                        result.x = -10
                    }
                    return result
                },
                drawingBufferHeight: 800,
                drawingBufferWidth: 1000,
                pickPositionSupported: true,
                pickPosition() {
                    return occludeDeparture ? new Cartesian3(0, 0, 0) : null
                },
                postRender: {
                    addEventListener(listener) {
                        postRenderListener = listener
                        return () => {
                            postRenderListener = null
                        }
                    },
                },
                requestRender() {},
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

        expect(mountJourneyReplayCameraAngleGuide(viewer, guide, {
            aheadColor:   '#ff6a00',
            headingColor: '#00ffff',
        })).toBe(true)
        const overlay = container.querySelector('.replay-camera-angle-guide-dom')
        expect(overlay).not.toBeNull()
        expect(overlay.style.pointerEvents).toBe('none')
        expect(overlay.style.zIndex).toBe('2')
        expect(overlay.querySelectorAll('path')).toHaveLength(2)
        const outerPath = overlay.querySelector('path[data-part="outer"]')
        const innerPath = overlay.querySelector('path[data-part="inner"]')
        expect(outerPath).not.toBeNull()
        expect(innerPath).not.toBeNull()
        expect(outerPath.getAttribute('d')).toContain(' A ')
        expect(innerPath.getAttribute('d')).toContain(' A ')
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
        expect(gradientStops[0].getAttribute('stop-opacity')).toBe('0.8')
        expect(gradientStops[1].getAttribute('stop-opacity')).toBe('0')
        expect(overlay.querySelectorAll('path[stroke]')).toHaveLength(0)
        const lines = overlay.querySelectorAll('line')
        expect(lines).toHaveLength(3)
        expect([...lines].every(line => line.getAttribute('stroke-width') === '1')).toBe(true)
        expect([...lines].every(line => line.getAttribute('stroke-linecap') === 'butt')).toBe(true)
        const icons = overlay.querySelectorAll('img')
        expect(icons).toHaveLength(1)
        expect(icons[0].src).toContain('drone')
        expect(decodeURIComponent(icons[0].src)).toContain('fill="#ffffff"')
        expect(decodeURIComponent(icons[0].src)).toContain('stroke-width="2"')
        expect(icons[0].style.transform).toContain('rotate(')
        expect(overlay.style.visibility).toBe('visible')

        const initialPoints = outerPath.getAttribute('d')
        viewer.camera.heading = Math.PI / 6
        cameraChangedListener()
        expect(outerPath.getAttribute('d')).not.toBe(initialPoints)
        metersPerPixel = 0.5
        cameraChangedListener()
        const resizedPoints = outerPath.getAttribute('d')
        expect(resizedPoints).not.toBe(initialPoints)
        postRenderListener()
        hideDeparture = true
        cameraChangedListener()
        expect(overlay.style.visibility).toBe('hidden')
        hideDeparture = false
        cameraChangedListener()
        expect(overlay.style.visibility).toBe('visible')
        moveDepartureOutsideViewport = true
        cameraChangedListener()
        expect(overlay.style.visibility).toBe('hidden')
        moveDepartureOutsideViewport = false
        cameraChangedListener()
        expect(overlay.style.visibility).toBe('visible')
        occludeDeparture = true
        postRenderListener()
        expect(overlay.style.visibility).toBe('hidden')
        occludeDeparture = false
        postRenderListener()
        expect(overlay.style.visibility).toBe('visible')

        expect(removeJourneyReplayCameraAngleGuide(viewer)).toBe(true)
        expect(container.querySelector('.replay-camera-angle-guide-dom')).toBeNull()
        container.remove()
    })
})
