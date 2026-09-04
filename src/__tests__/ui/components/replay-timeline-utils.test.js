/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-timeline-utils.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-29
 * Last modified: 2026-09-04
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, it} from 'vitest'
import {
    decorateReplayTimelineEditorData,
    REPLAY_TIMELINE_UI,
    REPLAY_TIMELINE_ZOOM,
    REPLAY_TIMELINE_TIME_UNITS,
    clampReplayTimelineZoom,
    resolveReplayTimelineHeight,
    resolveReplayTimelineLayoutHeight,
    resolveReplayTimelineLegendTransform,
    resolveReplayTimelineMinimumDimensions,
    resolveReplayTimelineMinimumWidth,
    resolveReplayTimelineRowHeight,
    resolveReplayTimelineScaleCount,
    resolveReplayTimelineScale,
    stepReplayTimelineZoom,
} from '@Components/MainUI/video/replayTimelineUtils'

describe('replayTimelineUtils', () => {
    it('keeps timeline layout values and row decoration in one adapter', () => {
        const editorData = decorateReplayTimelineEditorData([
            {id: 'widget', classNames: ['widget-row']},
            {id: 'replay'},
        ])

        expect(REPLAY_TIMELINE_UI.legendMinWidth).toBe(50)
        expect(REPLAY_TIMELINE_UI.legendWidth).toBe(150)
        expect(REPLAY_TIMELINE_UI.legendMaxWidth).toBe(250)
        expect(REPLAY_TIMELINE_UI.minWidth).toBe(352)
        expect(REPLAY_TIMELINE_UI.minHeight).toBe(156)
        expect(REPLAY_TIMELINE_UI.minimumVisibleDurationSeconds).toBe(5)
        expect(REPLAY_TIMELINE_UI.minimumVisibleTrackCount).toBe(1)
        expect(REPLAY_TIMELINE_UI.maximumVisibleTrackCount).toBe(3)
        expect(REPLAY_TIMELINE_UI.rowHeight).toBe(24)
        expect(REPLAY_TIMELINE_UI.scaleWidth).toBe(40)
        expect(REPLAY_TIMELINE_UI.horizontalScrollbarHeight).toBe(8)
        expect(REPLAY_TIMELINE_UI.scrubThrottleMillis).toBe(50)
        expect(REPLAY_TIMELINE_UI.horizontalScrollDurationRatio).toBe(0.2)
        expect(resolveReplayTimelineHeight(1)).toBe(156)
        expect(resolveReplayTimelineHeight(2)).toBe(180)
        expect(resolveReplayTimelineHeight(3)).toBe(204)
        expect(resolveReplayTimelineHeight(5)).toBe(204)
        expect(resolveReplayTimelineLayoutHeight(2)).toBe(98)
        expect(resolveReplayTimelineMinimumWidth()).toBe(352)
        expect(resolveReplayTimelineMinimumDimensions(3)).toEqual({width: 352, height: 204, layoutHeight: 122})
        expect(REPLAY_TIMELINE_UI.scaleIntervalMillis).toBe(200)
        expect(editorData[0].classNames).toEqual(['widget-row', 'replay-timeline-row-index-0'])
        expect(editorData[1].classNames).toEqual(['replay-timeline-row-index-1'])
        expect(resolveReplayTimelineLegendTransform(48)).toBe('translateY(-48px)')
        expect(resolveReplayTimelineLegendTransform(-10)).toBe('translateY(-0px)')
        expect(resolveReplayTimelineRowHeight({height: 114, rowCount: 3})).toBe(24)
        expect(resolveReplayTimelineRowHeight({height: 114, rowCount: 2})).toBe(32)
        expect(resolveReplayTimelineRowHeight({height: 500, rowCount: 3})).toBe(150)
        expect(resolveReplayTimelineScaleCount({durationSeconds: 4, majorSeconds: 1, width: 600})).toBe(15)
        expect(resolveReplayTimelineScaleCount({durationSeconds: 60, majorSeconds: 10, width: 0})).toBe(6)
        expect(resolveReplayTimelineScaleCount({
            durationSeconds: 4,
            majorSeconds:  1,
            durationPaddingRatio: 0.2,
        })).toBe(5)
    })

    it('resolves the requested major and minor time units from the zoom level', () => {
        expect(REPLAY_TIMELINE_TIME_UNITS.map(unit => [unit.majorSeconds, unit.minorMillis])).toEqual([
            [0.5, 100],
            [1, 200],
            [10, 1000],
            [30, 5000],
            [60, 10000],
            [300, 30000],
        ])
        expect(resolveReplayTimelineScale(0).id).toBe('second')
        expect(resolveReplayTimelineScale(-50).id).toBe('half-second')
        expect(resolveReplayTimelineScale(200).id).toBe('ten-seconds')
        expect(resolveReplayTimelineScale(320).id).toBe('thirty-seconds')
        expect(resolveReplayTimelineScale(400).id).toBe('minute')
        expect(resolveReplayTimelineScale(500).id).toBe('five-minutes')
    })

    it('clamps zoom and advances it by twenty percent', () => {
        expect(clampReplayTimelineZoom(-100)).toBe(REPLAY_TIMELINE_ZOOM.minPercent)
        expect(clampReplayTimelineZoom(900)).toBe(REPLAY_TIMELINE_ZOOM.maxPercent)
        expect(stepReplayTimelineZoom(0, 1)).toBe(20)
        expect(stepReplayTimelineZoom(0, -1)).toBe(-20)
        expect(stepReplayTimelineZoom(-40, -1)).toBe(-50)
        expect(stepReplayTimelineZoom(500, 1)).toBe(500)
    })

})
