import {describe, expect, it} from 'vitest'
import {
    decorateReplayTimelineEditorData,
    REPLAY_TIMELINE_UI,
    resolveReplayTimelineHeight,
    resolveReplayTimelineLegendTransform,
} from '@Components/MainUI/video/replayTimelineUtils'

describe('replayTimelineUtils', () => {
    it('keeps timeline layout values and row decoration in one adapter', () => {
        const editorData = decorateReplayTimelineEditorData([
            {id: 'widget', classNames: ['widget-row']},
            {id: 'replay'},
        ])

        expect(REPLAY_TIMELINE_UI.legendWidth).toBe(136)
        expect(REPLAY_TIMELINE_UI.scaleWidth).toBe(40)
        expect(resolveReplayTimelineHeight(2)).toBe(90)
        expect(REPLAY_TIMELINE_UI.scaleIntervalMillis).toBe(200)
        expect(editorData[0].classNames).toEqual(['widget-row', 'replay-timeline-row-index-0'])
        expect(editorData[1].classNames).toEqual(['replay-timeline-row-index-1'])
        expect(resolveReplayTimelineLegendTransform(48)).toBe('translateY(-48px)')
        expect(resolveReplayTimelineLegendTransform(-10)).toBe('translateY(-0px)')
    })
})
