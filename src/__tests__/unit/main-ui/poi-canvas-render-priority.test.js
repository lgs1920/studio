/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poi-canvas-render-priority.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-01
 * Last modified: 2026-11-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {Cartesian3} from 'cesium'
import {afterEach, describe, expect, it} from 'vitest'
import {proxyMap} from 'valtio/utils'
import {getPOICanvasRenderPriority} from '@Components/MainUI/MapPOI/poiCanvasRenderPriority'

afterEach(() => {
    delete globalThis.lgs
})

describe('POI canvas render priority', () => {
    it('ranks visible POIs by camera distance and leaves offscreen items eligible', () => {
        const nearPosition = Cartesian3.fromDegrees(2, 48, 1000)
        const offscreenPosition = Cartesian3.fromDegrees(4, 48, 1000)
        globalThis.lgs = {
            stores: {main: {components: {pois: {list: proxyMap([
                ['near', {id: 'near', longitude: 2, latitude: 48, height: 1000}],
                ['far', {id: 'far', longitude: 3, latitude: 48, height: 1000}],
                ['offscreen', {id: 'offscreen', longitude: 4, latitude: 48, height: 1000}],
            ])}}}},
            scene: {
                canvas: {clientWidth: 100, clientHeight: 100},
                cartesianToCanvasCoordinates: position => Cartesian3.distance(position, offscreenPosition) < 1
                    ? {x: 110, y: 50}
                    : {x: 50, y: 50},
            },
            camera: {positionWC: nearPosition},
        }

        expect(getPOICanvasRenderPriority('near')).toBeGreaterThan(getPOICanvasRenderPriority('far'))
        expect(getPOICanvasRenderPriority('offscreen')).toBe(0)
    })
})
