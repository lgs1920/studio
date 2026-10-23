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
import {Cartesian3, Color, CustomDataSource, HeightReference} from 'cesium'
import {TrackUtils} from '@Utils/cesium/TrackUtils'

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
        expect(startCap.point.heightReference.getValue()).toBe(HeightReference.CLAMP_TO_GROUND)
        expect(startCap.point.disableDepthTestDistance.getValue()).toBe(0)
        expect(startCap.point.pixelSize.getValue()).toBe(5)
        expect(startCap.point.outlineWidth.getValue()).toBe(5)
        expect(startCap.point.color.getValue()).toEqual(Color.RED)
        expect(startCap.point.outlineColor.getValue()).toEqual(Color.BLACK)

        pixelsPerMeter = 8
        source.__lgsTrackWidthUpdate()
        expect(startCap.point.pixelSize.getValue()).toBe(8)
        expect(startCap.point.outlineWidth.getValue()).toBe(8)

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
