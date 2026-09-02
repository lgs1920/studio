/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-preparation-timeline.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-29
 * Last modified: 2026-09-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    buildReplayPreparationTimeline,
    REPLAY_PREPARATION_ACTION_DYNAMIC_STATS,
    REPLAY_PREPARATION_ACTION_JOURNEY_STATS,
} from '@Core/ui/replay/ReplayPreparationTimeline'
import {buildReplayVideoTimeline} from '@Core/ui/replay/ReplayVideoTimeline'
import {describe, expect, it} from 'vitest'

const clips = {
    catalog: {
        intro: {id: 'intro', slots: ['start'], icon: 'plane-departure', defaults: {duration: 2}},
        outro: {id: 'outro', slots: ['stop'], icon: 'plane-arrival', defaults: {duration: 1}},
    },
    start: [{clipId: 'intro'}],
    stop: [{clipId: 'outro'}],
}

describe('ReplayPreparationTimeline', () => {
    it('projects a replay without clips into one track per active timeline source', () => {
        const projection = buildReplayPreparationTimeline({
            replayDurationMillis: 4000,
            fps: 10,
            clips: {catalog: {}, start: [], stop: []},
        })

        expect(projection.tracks.map(track => track.id)).toEqual([
            'replay',
            REPLAY_PREPARATION_ACTION_DYNAMIC_STATS,
            REPLAY_PREPARATION_ACTION_JOURNEY_STATS,
        ])
        expect(projection.tracks[0].actions.map(action => action.kind)).toEqual(['replay'])
        expect(projection.tracks[0].actions[0]).toEqual(expect.objectContaining({
            startMillis: 0,
            endMillis: 4000,
            start: 0,
            end: 4,
            colorClasses: ['wa-neutral', 'wa-neutral-blue'],
        }))
        expect(projection.editorData[0].classNames)
            .toEqual(expect.arrayContaining(['wa-neutral', 'wa-neutral-blue']))
        expect(projection.durationMillis).toBe(4000)
        expect(projection.playhead.endMillis).toBe(4000)
    })

    it('keeps start, replay, and stop phases contiguous', () => {
        const projection = buildReplayPreparationTimeline({
            replayDurationMillis: 4000,
            fps: 10,
            clips,
        })

        expect(projection.tracks[0].actions.map(action => [action.kind, action.startMillis, action.endMillis])).toEqual([
            ['pre-replay', 0, 2000],
            ['replay', 2000, 6000],
            ['post-replay', 6000, 7000],
        ])
        expect(projection.totalDurationMillis).toBe(7000)
        expect(projection.tracks[0].actions.map(action => action.colorClasses)).toEqual([
            ['wa-neutral', 'wa-neutral-purple'],
            ['wa-neutral', 'wa-neutral-blue'],
            ['wa-neutral', 'wa-neutral-orange'],
        ])
    })

    it('projects clip icons into actions without projecting track icons', () => {
        const projection = buildReplayPreparationTimeline({
            replayDurationMillis: 4000,
            fps: 10,
            clips,
        })

        expect(projection.tracks.every(track => !Object.hasOwn(track, 'icon'))).toBe(true)
        expect(projection.tracks[0].actions.map(action => action.icon)).toEqual([
            'plane-departure',
            'route',
            'plane-arrival',
        ])
    })

    it('projects terminal widget visibility from the canonical frame phase', () => {
        const projection = buildReplayPreparationTimeline({
            replayDurationMillis: 4000,
            fps: 10,
            clips,
        })
        const dynamicActions = projection.tracks.find(track => track.id === REPLAY_PREPARATION_ACTION_DYNAMIC_STATS).actions
        const journeyActions = projection.tracks.find(track => track.id === REPLAY_PREPARATION_ACTION_JOURNEY_STATS).actions

        expect(dynamicActions.map(action => action.kind)).toEqual([REPLAY_PREPARATION_ACTION_DYNAMIC_STATS])
        expect(journeyActions.map(action => action.kind)).toEqual([REPLAY_PREPARATION_ACTION_JOURNEY_STATS])
        expect(dynamicActions[0].startMillis).toBe(2000)
        expect(dynamicActions[0].endMillis).toBe(5800)
        expect(journeyActions[0].startMillis).toBe(5800)
        expect(journeyActions[0].endMillis).toBe(7000)
    })

    it('rebuilds a stable projection when replay duration changes', () => {
        const first = buildReplayPreparationTimeline({replayDurationMillis: 4000, fps: 10, clips})
        const second = buildReplayPreparationTimeline({replayDurationMillis: 5000, fps: 10, clips})

        expect(second.signature).not.toBe(first.signature)
        expect(second.tracks[0].actions[1].endMillis).toBe(7000)
        expect(second.durationMillis).toBe(8000)
    })

    it('refreshes a cached video timeline when the clip signature changes', () => {
        const cachedTimeline = buildReplayVideoTimeline({
            replayDurationMillis: 4000,
            fps: 10,
            clips: {catalog: {}, start: [], stop: []},
        })
        const projection = buildReplayPreparationTimeline({
            videoTimeline: cachedTimeline,
            replayDurationMillis: 4000,
            fps: 10,
            clips,
        })

        expect(projection.tracks[0].actions.map(action => action.kind)).toEqual(['pre-replay', 'replay', 'post-replay'])
        expect(projection.durationMillis).toBe(7000)
    })

    it('keeps widget tracks separate and follows the supplied bottom-to-top stack order', () => {
        const projection = buildReplayPreparationTimeline({
            replayDurationMillis: 4000,
            fps: 10,
            widgetOrder: [
                {id: 'journey-stats-widget', label: 'Journey Stats'},
                {id: 'text-widget#title', label: 'Title'},
                {id: 'dynamic-stats-widget', label: 'Dynamic Stats'},
            ],
        })

        expect(projection.tracks.map(track => track.id)).toEqual([
            'replay',
            'journey-stats-widget',
            'text-widget#title',
            'dynamic-stats-widget',
        ])
        expect(projection.editorData.map(row => row.id)).toEqual([
            'replay',
            'journey-stats-widget',
            'text-widget#title',
            'dynamic-stats-widget',
        ])
        expect(projection.tracks.find(track => track.id === 'text-widget#title').actions).toEqual([
            expect.objectContaining({
                kind: 'text-widget',
                widgetId: 'text-widget#title',
                label: 'Title',
                startMillis: 0,
                endMillis: 4000,
                colorClasses: ['wa-neutral', 'wa-neutral-blue'],
            }),
        ])
    })

    it('projects widgets sharing widgetGroup into one track with all widget clips', () => {
        const projection = buildReplayPreparationTimeline({
            replayDurationMillis: 4000,
            fps: 10,
            widgetOrder: [
                {id: 'text-widget#one', label: 'First', widgetGroup: 'group#one'},
                {id: 'text-widget#two', label: 'Second', widgetGroup: 'group#one'},
            ],
        })

        expect(projection.tracks.map(track => track.id)).toEqual(['replay', 'group#one'])
        expect(projection.tracks[1]).toMatchObject({
            kind: 'widget-group',
            widgetGroup: 'group#one',
        })
        expect(projection.tracks[1].actions.map(action => action.widgetId)).toEqual([
            'text-widget#one',
            'text-widget#two',
        ])
    })

    it('keeps clip action identity stable when instances have no persisted id', () => {
        const first = buildReplayPreparationTimeline({replayDurationMillis: 4000, fps: 10, clips})
        const second = buildReplayPreparationTimeline({replayDurationMillis: 4000, fps: 10, clips})

        expect(second.signature).toBe(first.signature)
        expect(second.tracks[0].actions[0].id).toBe('pre-replay-intro')
        expect(second.tracks[0].actions[0].label).toBe('intro')
    })
})
