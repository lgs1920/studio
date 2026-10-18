/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-timeline-persistence.test.js
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

import {Journey} from '@Core/Journey'
import {
    normalizeJourneyReplayVideoTimeline,
    resolveReplayTimelineClips,
    resolveReplayTimelineWidgetIds,
    resolveReplayTimelineWidgetManifest,
    restoreReplayTimelineTracks,
} from '@Core/ui/replay/ReplayTimelinePersistence'
import {describe, expect, it} from 'vitest'

const projection = {
    signature: 'source-with-new-widget',
    durationMillis: 4000,
    direction: 1,
    fps: 30,
    source: {
        clipSignature: 'clip-source',
        replayDurationMillis: 4000,
        frameCount: 120,
        frameIntervalMs: 1000 / 30,
    },
}

const savedTimeline = {
    version: 1,
    journeySlug: 'journey-a',
    sourceSignature: 'source-before-widget-addition',
    source: {...projection.source},
    direction: 1,
    fps: 30,
    timeline: {
        durationMillis: 4000,
        rangeStartMillis: 0,
        rangeEndMillis: 4000,
        currentTimeMillis: 1750,
    },
    widgetManifest: ['text-widget#title', 'logo-widget'],
    tracks: [
        {
            id: 'text-widget#title',
            kind: 'text-widget',
            widgetId: 'text-widget#title',
            visible: false,
            clips: [{id: 'title-clip', start: 0, end: 4, visible: true}],
        },
        {
            id: 'replay',
            kind: 'replay',
            visible: true,
            clips: [{id: 'replay-clip', start: 0, end: 4, visible: true}],
        },
    ],
}

describe('Replay timeline persistence', () => {
    it('normalizes a detached Journey timeline snapshot and retains its widget manifest', () => {
        const normalized = normalizeJourneyReplayVideoTimeline(savedTimeline)

        expect(normalized).toMatchObject({
            version: 1,
            journeySlug: 'journey-a',
            sourceSignature: 'source-before-widget-addition',
            timeline: {currentTimeMillis: 1750},
            widgetManifest: ['text-widget#title', 'logo-widget'],
        })
        expect(normalized.tracks).not.toBe(savedTimeline.tracks)
        expect(resolveReplayTimelineWidgetIds(normalized.tracks)).toEqual(['text-widget#title'])
    })

    it('preserves the timeline when a Journey is deserialized', () => {
        const journey = Journey.deserialize({
            object: {
                replay: {
                    start: [],
                    stop: [],
                    videoTimeline: savedTimeline,
                },
            },
            reset: true,
        })

        expect(journey.replay.videoTimeline).toMatchObject({
            journeySlug: 'journey-a',
            sourceSignature: 'source-before-widget-addition',
            widgetManifest: ['text-widget#title', 'logo-widget'],
        })
        expect(journey.replay.videoTimeline.tracks).toEqual(savedTimeline.tracks)
    })

    it('keeps saved row order and appends newly registered widgets when the Replay source is unchanged', () => {
        const baseTracks = [
            {id: 'new-widget#1', kind: 'new-widget', widgetId: 'new-widget#1', clips: []},
            {id: 'text-widget#title', kind: 'text-widget', widgetId: 'text-widget#title', clips: []},
            {id: 'logo-widget', kind: 'logo-widget', widgetId: 'logo-widget', clips: []},
            {id: 'replay', kind: 'replay', clips: []},
        ]

        const restored = restoreReplayTimelineTracks({
            baseTracks,
            savedTimeline,
            projection,
        })

        expect(restored.map(track => track.id)).toEqual([
            'text-widget#title',
            'new-widget#1',
            'replay',
        ])
        expect(restored[0].visible).toBe(false)
    })

    it('builds a unique manifest from grouped timeline rows and earlier widget IDs', () => {
        expect(resolveReplayTimelineWidgetManifest([
            {id: 'group-title', type: 'widget-group', widgetIds: ['text-widget#title', 'date-widget#date']},
        ], ['logo-widget'])).toEqual([
            'logo-widget',
            'text-widget#title',
            'date-widget#date',
        ])
    })

    it('converts edited Replay phase events back to ordered clip durations', () => {
        const clips = {
            catalog: {
                intro: {id: 'intro', slots: ['pre-replay'], defaults: {duration: 2}},
                outro: {id: 'outro', slots: ['post-replay'], defaults: {duration: 1}},
            },
            start: [{id: 'intro-instance', clipId: 'intro', slot: 'pre-replay', enabled: true, params: {duration: 2}}],
            stop: [{id: 'outro-instance', clipId: 'outro', slot: 'post-replay', enabled: true, params: {duration: 1}}],
        }
        const tracks = [{
            id: 'replay',
            kind: 'replay',
            clips: [
                {
                    id: 'post-replay-outro-instance',
                    kind: 'post-replay',
                    start: 8,
                    end: 9.5,
                    enabled: false,
                    metadata: {clip: clips.stop[0]},
                },
                {
                    id: 'pre-replay-intro-instance',
                    kind: 'pre-replay',
                    start: 0,
                    end: 3.25,
                    metadata: {clip: clips.start[0]},
                },
            ],
        }]

        expect(resolveReplayTimelineClips({tracks, clips})).toEqual({
            catalog: clips.catalog,
            start: [{...clips.start[0], params: {duration: 3.25}}],
            stop: [{...clips.stop[0], enabled: false, params: {duration: 1.5}}],
        })
    })

    it('returns empty clip slots when all configured phase events have been removed', () => {
        const clips = {
            catalog: {intro: {id: 'intro', slots: ['pre-replay'], defaults: {duration: 2}}},
            start: [{id: 'intro-instance', clipId: 'intro', slot: 'pre-replay', params: {duration: 2}}],
            stop: [],
        }

        expect(resolveReplayTimelineClips({
            clips,
            tracks: [{id: 'replay', kind: 'replay', clips: [{id: 'replay', kind: 'replay', start: 0, end: 4}]}],
        })).toEqual({catalog: clips.catalog, start: [], stop: []})
    })
})
