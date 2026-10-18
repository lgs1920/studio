/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: track-terrain-progress-marker.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-18
 * Last modified: 2026-10-18
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {Cartesian3, Color, HeightReference} from 'cesium'
import {describe, expect, it, vi} from 'vitest'
import {createTrackTerrainAlignmentProgressMarker} from '@Utils/cesium/trackTerrainProgressMarker'

/**
 * Create a minimal Cesium viewer mock for the progress marker lifecycle.
 *
 * @returns {object} Viewer stubs for entity ownership and scene rendering.
 */
const createViewer = () => ({
    entities: {
        add:    vi.fn(options => ({...options})),
        remove: vi.fn(),
    },
    scene: {
        requestRender: vi.fn(),
    },
})

describe('track terrain progress marker', () => {
    it('clamps one visible marker to each reported route point and removes it on cleanup', () => {
        const viewer = createViewer()
        const marker = createTrackTerrainAlignmentProgressMarker({viewer})

        expect(marker.update([6.12, 45.12, 2800])).toBe(true)
        const entity = viewer.entities.add.mock.results[0].value
        expect(viewer.entities.add).toHaveBeenCalledOnce()
        expect(entity.position).toEqual(Cartesian3.fromDegrees(6.12, 45.12))
        expect(entity.point).toMatchObject({
            color:                   Color.CYAN,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            heightReference:         HeightReference.CLAMP_TO_GROUND,
            outlineColor:            Color.BLACK,
            outlineWidth:            2,
            pixelSize:               15,
        })

        marker.update([7.13, 46.14, 3100])
        expect(viewer.entities.add).toHaveBeenCalledOnce()
        expect(entity.position).toEqual(Cartesian3.fromDegrees(7.13, 46.14))

        marker.clear()
        marker.clear()
        expect(viewer.entities.remove).toHaveBeenCalledOnce()
        expect(viewer.entities.remove).toHaveBeenCalledWith(entity)
        expect(viewer.scene.requestRender).toHaveBeenCalledTimes(3)
    })

    it('ignores invalid coordinates and works without a viewer', () => {
        const viewer = createViewer()
        const marker = createTrackTerrainAlignmentProgressMarker({viewer})

        expect(marker.update([Number.NaN, 95])).toBe(false)
        expect(marker.update([-181, 45])).toBe(false)
        expect(viewer.entities.add).not.toHaveBeenCalled()
        expect(createTrackTerrainAlignmentProgressMarker({viewer: null}).update([6, 45])).toBe(false)
    })
})
