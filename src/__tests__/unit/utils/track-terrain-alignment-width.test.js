/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: track-terrain-alignment-width.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-15
 * Last modified: 2026-10-15
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { afterEach, describe, expect, it, vi } from 'vitest'
import { TrackUtils } from '@Utils/cesium/TrackUtils'

describe('Track terrain-alignment stroke width', () => {
    afterEach(() => vi.restoreAllMocks())

    it('uses half of the wider configured meter stroke and underlay', () => {
        const track = {slug: 'track#width'}
        const style = {
            widthUnit: 'meters',
            meterWidth: 4,
            underlay: {enabled: true, meterWidth: 10},
        }

        expect(TrackUtils.getTrackTerrainAlignmentHalfWidthMeters(track, style)).toBe(5)
    })

    it('converts pixel stroke width to a terrain half-width using the current map scale', () => {
        const track = {slug: 'track#pixel-width'}
        const style = {
            widthUnit: 'pixels',
            farPixelWidth: 8,
            underlay: {enabled: true, pixelWidth: 12},
        }
        vi.spyOn(TrackUtils, 'meterWidthToPixelScale').mockReturnValue(4)

        expect(TrackUtils.getTrackTerrainAlignmentHalfWidthMeters(track, style)).toBe(1.5)
    })
})
