/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: track-utils-underlay-caps.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-23
 * Last modified: 2026-10-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, describe, expect, it, vi} from 'vitest'
import {Cartesian2, Cartesian3, CustomDataSource, HeightReference, HorizontalOrigin, VerticalOrigin} from 'cesium'
import {TrackUtils} from '@Utils/cesium/TrackUtils'
import {getPolylineEndCapRotation} from '@Utils/cesium/TrackEndCapUtils'

describe('TrackUtils underlay endpoint caps', () => {
    let source = null

    afterEach(() => {
        if (source) {
            TrackUtils.removeTrackWidthUpdater(source)
            source = null
        }
        vi.restoreAllMocks()
        globalThis.lgs = undefined
        globalThis.__ = undefined
    })

    it('points each semicircle away from the trace with its diameter perpendicular to the segment', () => {
        const scene = {
            cartesianToCanvasCoordinates: position => new Cartesian2(position.x, position.y),
        }
        const positions = [{x: 0, y: 0}, {x: 10, y: 10}]

        expect(getPolylineEndCapRotation(scene, positions, 'start')).toBeCloseTo(3 * Math.PI / 4)
        expect(getPolylineEndCapRotation(scene, positions, 'end')).toBeCloseTo(-Math.PI / 4)
    })

    it('closes both ends with ground-clamped caps that follow the rendered line widths', () => {
        source = new CustomDataSource('track-underlay-caps')
        const firstPosition = Cartesian3.fromDegrees(2, 48)
        const lastPosition = Cartesian3.fromDegrees(2.01, 48.01)
        source.entities.add({
            id: 'track-line',
            polyline: {
                positions: [firstPosition, Cartesian3.fromDegrees(2.005, 48.005), lastPosition],
            },
        })
        globalThis.lgs = {
            scene: {
                requestRender: vi.fn(),
                cartesianToCanvasCoordinates: vi.fn(position => new Cartesian2(position.x, position.y)),
            },
            viewer: {
                scene: {
                    canvas: {
                        addEventListener: vi.fn(),
                        removeEventListener: vi.fn(),
                    },
                },
            },
            camera: {
                changed: {addEventListener: vi.fn(() => vi.fn())},
                moveEnd: {addEventListener: vi.fn(() => vi.fn())},
            },
        }
        globalThis.__ = {
            canvasEvents: {
                removeAllListenersByEntity: vi.fn(),
            },
        }
        let pixelsPerMeter = 5
        vi.spyOn(TrackUtils, 'meterWidthToPixelScale').mockImplementation(() => pixelsPerMeter)
        const getTrackDistanceScaleInfo = vi.spyOn(TrackUtils, 'getTrackDistanceScaleInfo').mockReturnValue({
            shouldShowLocatorMarker: false,
            shouldShowFarLine: false,
        })

        const track = {
            slug: 'track-underlay-caps',
            renderStyle: {
                color: '#ff0000',
                widthUnit: 'meters',
                meterWidth: 1,
                farPixelWidth: 4,
                meterPixelThreshold: 2,
                underlay: {
                    enabled: true,
                    color: '#000000',
                    meterWidth: 3,
                    pixelWidth: 10,
                },
            },
        }

        TrackUtils.applyTrackRenderStyle(source, track)

        const startCap = source.entities.getById('track-line#lgs-track-style#underlay-cap#start')
        const endCap = source.entities.getById('track-line#lgs-track-style#underlay-cap#end')
        expect(startCap).toBeTruthy()
        expect(endCap).toBeTruthy()
        expect(startCap.position.getValue()).toEqual(firstPosition)
        expect(endCap.position.getValue()).toEqual(lastPosition)
        expect(startCap.billboard.heightReference.getValue()).toBe(HeightReference.CLAMP_TO_GROUND)
        expect(startCap.billboard.disableDepthTestDistance.getValue()).toBe(0)
        expect(startCap.billboard.horizontalOrigin.getValue()).toBe(HorizontalOrigin.LEFT)
        expect(startCap.billboard.verticalOrigin.getValue()).toBe(VerticalOrigin.CENTER)
        expect(startCap.billboard.width.getValue()).toBe(7.5)
        expect(startCap.billboard.height.getValue()).toBe(15)
        const capImage = decodeURIComponent(startCap.billboard.image.getValue())
        expect(capImage).toContain('A 64 64 0 0 1 0 128 Z')
        expect(capImage).toContain('fill="rgb(255,0,0)"')
        expect(capImage).toContain('fill="rgb(0,0,0)"')
        expect(capImage).not.toContain('<circle')
        expect(Number.isFinite(startCap.billboard.rotation.getValue())).toBe(true)

        pixelsPerMeter = 8
        source.__lgsTrackWidthUpdate()
        expect(startCap.billboard.width.getValue()).toBe(12)
        expect(startCap.billboard.height.getValue()).toBe(24)

        getTrackDistanceScaleInfo.mockReturnValue({
            shouldShowLocatorMarker: false,
            shouldShowFarLine: true,
        })
        source.__lgsTrackWidthUpdate()
        expect(startCap.show).toBe(false)

        getTrackDistanceScaleInfo.mockReturnValue({
            shouldShowLocatorMarker: false,
            shouldShowFarLine: false,
        })
        source.__lgsTrackWidthUpdate()
        expect(startCap.show).toBe(true)
    })
})
