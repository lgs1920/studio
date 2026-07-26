import { describe, expect, it } from 'vitest'
import {
    normalizeReportTraceTrackDrawings,
    normalizeReportTraceTrackInfo,
} from '@Utils/ExportAsReport/mapRender'

describe('report flat map rendering', () => {
    it('normalizes the trace to the report color regardless of the track color', () => {
        const trackDrawings = normalizeReportTraceTrackDrawings([{
            color: '#ff0000',
            segments: [[
                {longitude: 5.0, latitude: 45.0},
                {longitude: 5.1, latitude: 45.1},
            ]],
        }])

        expect(trackDrawings).toHaveLength(1)
        expect(trackDrawings[0].color).toEqual([68, 68, 68])
    })

    it('can normalize the HTML 2D trace to black', () => {
        const trackDrawings = normalizeReportTraceTrackDrawings([{
            color: '#ff0000',
            segments: [[
                {longitude: 5.0, latitude: 45.0},
                {longitude: 5.1, latitude: 45.1},
            ]],
        }], '#000000')

        expect(trackDrawings[0].color).toBe('#000000')
    })

    it('keeps projected track info usable while forcing the report trace color', () => {
        const path = Object.assign([
            {x: 1, y: 2},
            {x: 3, y: 4},
        ], {color: '#ff0000'})

        const trackInfo = normalizeReportTraceTrackInfo({
            bounds: {minX: 0, maxX: 10, minY: 0, maxY: 10},
            paths:  [path],
            angle:  0,
        })

        expect(trackInfo.paths).toHaveLength(1)
        expect(Array.isArray(trackInfo.paths[0])).toBe(true)
        expect(trackInfo.paths[0].color).toEqual([68, 68, 68])
        expect(trackInfo.paths[0][0]).toEqual({x: 1, y: 2})
    })
})
