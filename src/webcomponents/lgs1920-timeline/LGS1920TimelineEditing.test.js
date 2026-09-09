/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LGS1920TimelineEditing.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-06
 * Last modified: 2026-09-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, it, vi} from 'vitest'
import {createTimelineClipEditor, resolveClipExtension, rippleResizedClips, snapClipToTargets} from './LGS1920TimelineEditing'

/**
 * Create a deterministic controller fixture with mutable presentation state.
 * @param {Object} config - Timeline overrides.
 * @returns {Object} Controller and state readers.
 */
const setup = (config = {}) => {
    let rows = [
        {id: 'source', actions: [{id: 'clip', kind: 'video', start: 1, end: 4}]},
        {id: 'target', actions: []},
    ]
    let duration = 10_000
    let rangeEnd = config.rangeEndMillis ?? 10_000
    const setRangeEndMillis = vi.fn(value => { rangeEnd = value })
    const editor = createTimelineClipEditor({
        getRows: () => rows,
        getTimelineConfig: () => config,
        getProjectionDurationMillis: () => 10_000,
        getMajorRulerUnit: () => ({seconds: 1, pixels: 40, minorSeconds: 0.2, minorPixels: 8}),
        getCurrentTimeMillis: () => 6_250,
        getTimeAtClientX: value => value,
        getTrackAtClientY: value => rows[value] ?? null,
        getRangeEndFollowsDuration: () => false,
        getRangeEndMillis: () => rangeEnd,
        setRangeEndMillis,
        setRows: value => { rows = value },
        setInteractionDurationMillis: value => { duration = value },
        emit: () => ({defaultPrevented: false}),
        render: () => {},
    })
    return {editor, getRows: () => rows, getDuration: () => duration, setRangeEndMillis}
}

describe('timeline editing transactions', () => {
    it('caps clip extension at the current timeline duration', () => {
        expect(resolveClipExtension({
            clip: {id: 'clip', start: 7, end: 8},
            otherClips: [],
            durationSeconds: 10,
        })).toEqual({start: 0, end: 10})
    })

    it('calculates an extension without mutating the range before approval', () => {
        const {editor, getRows, setRangeEndMillis} = setup()
        const result = editor.place({baseRows: getRows(), clip: {id: 'new', start: 9, end: 12}, targetTrackId: 'target'})
        expect(result).toMatchObject({durationMillis: 12_000, rangeEndMillis: 12_000})
        expect(setRangeEndMillis).not.toHaveBeenCalled()
        expect(getRows()[1].actions).toEqual([])
    })

    it('keeps a deliberately shortened playback range when extending content', () => {
        const {editor, getRows} = setup({rangeEndMillis: 8_000})
        expect(editor.place({baseRows: getRows(), clip: {id: 'new', start: 9, end: 12}, targetTrackId: 'target'}))
            .toMatchObject({durationMillis: 12_000, rangeEndMillis: 8_000})
    })

    it.each(['prevent', 'allow', 'ripple'])('honors fixed duration for %s collisions', collisionPolicy => {
        const {editor, getRows} = setup({durationPolicy: 'fixed', collisionPolicy})
        expect(editor.place({baseRows: getRows(), clip: {id: 'new', start: 9, end: 12}, targetTrackId: 'target'})).toBeNull()
    })

    it.each(['prevent', 'allow', 'ripple'])('enforces minimum duration with %s collisions', collisionPolicy => {
        const {editor, getRows} = setup({collisionPolicy, fps: 30})
        expect(editor.place({baseRows: getRows(), clip: {id: 'new', start: 1, end: 1.01}, targetTrackId: 'target'})).toBeNull()
    })

    it('rejects an overlapping placement even when a permissive policy is requested', () => {
        const {editor, getRows} = setup({collisionPolicy: 'allow'})
        const rows = getRows()
        rows[1].actions = [{id: 'existing', start: 2, end: 5}]
        expect(editor.place({baseRows: rows, clip: {id: 'new', start: 4, end: 6}, targetTrackId: 'target'})).toBeNull()
    })

    it.each([NaN, Infinity, -1])('rejects malformed start time %s', start => {
        const {editor, getRows} = setup()
        expect(editor.place({baseRows: getRows(), clip: {id: 'new', start, end: 3}, targetTrackId: 'target'})).toBeNull()
    })

    it('prevents ripple from shifting an individually read-only clip', () => {
        const {editor, getRows} = setup({collisionPolicy: 'ripple'})
        const rows = getRows()
        rows[1].actions = [{id: 'locked', editable: false, start: 3, end: 6}]
        expect(editor.place({baseRows: rows, clip: {id: 'clip', start: 2, end: 5}, targetTrackId: 'target'})).toBeNull()
    })

    it('keeps a start extension valid while it consumes the free gap', () => {
        const {editor} = setup({resizeCollisionPolicy: 'ripple'})
        const rows = [{id: 'target', actions: [
            {id: 'before', start: 0, end: 2}, {id: 'clip', start: 4, end: 6},
        ]}]
        expect(editor.place({baseRows: rows, clip: {id: 'clip', start: 3, end: 6},
            targetTrackId: 'target', mode: 'resize', edge: 'start'}).rows[0].actions).toEqual([
            {id: 'before', start: 0, end: 2}, {id: 'clip', start: 3, end: 6},
        ])
    })

    it('keeps the previous clip fixed when a start extension has enough room', () => {
        const {editor} = setup({resizeCollisionPolicy: 'ripple'})
        const rows = [{id: 'target', actions: [
            {id: 'before', start: 1, end: 2}, {id: 'clip', start: 3, end: 6},
        ]}]
        const result = editor.place({baseRows: rows, clip: {id: 'clip', start: 2, end: 6},
            targetTrackId: 'target', mode: 'resize', edge: 'start'})
        expect(result.rows[0].actions).toEqual([
            {id: 'before', start: 1, end: 2}, {id: 'clip', start: 2, end: 6},
        ])
    })

    it('blocks a start extension when it reaches the previous clip', () => {
        const {editor} = setup({resizeCollisionPolicy: 'ripple'})
        const rows = [{id: 'target', actions: [
            {id: 'before', start: 1, end: 3}, {id: 'clip', start: 4, end: 6},
        ]}]
        expect(editor.place({baseRows: rows, clip: {id: 'clip', start: 2, end: 6},
            targetTrackId: 'target', mode: 'resize', edge: 'start'})).toBeNull()
    })

    it('consumes the free gap before rippling a neighbor on the end edge', () => {
        const clips = [
            {id: 'before', start: 2, end: 3},
            {id: 'clip', start: 4, end: 7},
            {id: 'after', start: 8, end: 11},
        ]
        expect(rippleResizedClips({
            clips,
            originalClip: clips[1],
            proposedClip: {...clips[1], start: 3},
            edge: 'start',
        })).toEqual([
            {id: 'before', start: 2, end: 3},
            {id: 'clip', start: 3, end: 7},
            {id: 'after', start: 8, end: 11},
        ])
        expect(rippleResizedClips({
            clips,
            originalClip: clips[1],
            proposedClip: {...clips[1], end: 7.5},
            edge: 'end',
        })).toEqual([
            {id: 'before', start: 2, end: 3},
            {id: 'clip', start: 4, end: 7.5},
            {id: 'after', start: 8, end: 11},
        ])
        expect(rippleResizedClips({
            clips,
            originalClip: clips[1],
            proposedClip: {...clips[1], end: 9},
            edge: 'end',
        })).toEqual([
            {id: 'before', start: 2, end: 3},
            {id: 'clip', start: 4, end: 9},
            {id: 'after', start: 9, end: 12},
        ])
    })

    it('returns a neighbor to its previous position after reversing a ripple resize', () => {
        const {editor} = setup({resizeCollisionPolicy: 'ripple'})
        const rows = [{id: 'target', actions: [
            {id: 'clip', start: 1, end: 4}, {id: 'after', start: 5, end: 8},
        ]}]
        const expanded = editor.place({baseRows: rows, clip: {id: 'clip', start: 1, end: 6},
            targetTrackId: 'target', mode: 'resize', edge: 'end'})
        editor.recordResizeResult({baseRows: rows, result: expanded, clipId: 'clip', edge: 'end'})

        const shortened = editor.place({baseRows: expanded.rows, clip: {id: 'clip', start: 1, end: 4},
            targetTrackId: 'target', mode: 'resize', edge: 'end'})
        expect(shortened.rows[0].actions).toEqual([
            {id: 'clip', start: 1, end: 4}, {id: 'after', start: 5, end: 8},
        ])
    })

    it('leaves a merely touching neighbor fixed when the clip is shortened', () => {
        const {editor} = setup({resizeCollisionPolicy: 'ripple'})
        const rows = [{id: 'target', actions: [
            {id: 'clip', start: 1, end: 4}, {id: 'after', start: 4, end: 8},
        ]}]
        const shortened = editor.place({baseRows: rows, clip: {id: 'clip', start: 1, end: 3},
            targetTrackId: 'target', mode: 'resize', edge: 'end'})
        expect(shortened.rows[0].actions).toEqual([
            {id: 'clip', start: 1, end: 3}, {id: 'after', start: 4, end: 8},
        ])
    })

    it('anchors a ripple insertion at the requested time and preserves neighboring durations', () => {
        const {editor} = setup({collisionPolicy: 'ripple'})
        const rows = [{id: 'target', actions: [{id: 'first', start: 0, end: 2}, {id: 'last', start: 2, end: 10}]}]
        const result = editor.place({baseRows: rows, clip: {id: 'new', start: 1, end: 4}, targetTrackId: 'target'})
        expect(result.rows[0].actions).toEqual([
            {id: 'new', start: 1, end: 4}, {id: 'first', start: 4, end: 6}, {id: 'last', start: 6, end: 14},
        ])
        expect(result.durationMillis).toBe(14_000)
    })

    it('rejects incompatible tracks after a previously valid preview', () => {
        const {editor, getRows} = setup({snap: false})
        const rows = getRows()
        rows[1].accepts = ['audio']
        const state = {mode: 'move', clipId: 'clip', sourceTrackId: 'source', startTime: 1,
            originalStart: 1, originalEnd: 4, baseRows: rows, initialDurationMillis: 10_000, initialRangeEndMillis: 10_000}
        editor.preview(state, {clientX: 2, clientY: 0})
        expect(state.lastResult).not.toBeNull()
        editor.preview(state, {clientX: 3, clientY: 1})
        expect(state.dropRejected).toBe(true)
        expect(state.lastResult).toBeNull()
        expect(state.targetTrackId).toBe('target')
    })

    it('temporarily bypasses magnets with Alt', () => {
        const {editor, getRows} = setup()
        const state = {mode: 'move', clipId: 'clip', sourceTrackId: 'source', startTime: 1,
            originalStart: 1, originalEnd: 4, baseRows: getRows(), initialDurationMillis: 10_000}
        editor.preview(state, {clientX: 3.3, clientY: 1})
        expect(state.lastResult.rows[1].actions[0].end).toBe(6.25)
        editor.preview(state, {clientX: 3.3, clientY: 1, altKey: true})
        expect(state.lastResult.rows[1].actions[0].end).toBe(6.3)
    })
})

describe('timeline edge magnets', () => {
    it('uses an eight pixel snap zone on both sides while preserving duration', () => {
        const snapOptions = {
            mode: 'move',
            targets: [1],
            thresholdPixels: 8,
            pixelsPerSecond: 40,
            thresholdSeconds: 0.2,
        }
        expect(snapClipToTargets({...snapOptions, start: 1.2, end: 4.2}))
            .toEqual({start: 1, end: 4})
        expect(snapClipToTargets({...snapOptions, start: 0.8, end: 3.8}))
            .toEqual({start: 1, end: 4})
        expect(snapClipToTargets({...snapOptions, start: 1.225, end: 4.225}))
            .toBeNull()
    })

    it('snaps the nearest moving edge without changing duration', () => {
        const result = snapClipToTargets({start: 1.15, end: 4.15, mode: 'move', targets: [1, 4.2], thresholdSeconds: 0.2})
        expect(result.start).toBeCloseTo(1.2)
        expect(result.end).toBe(4.2)
        expect(result.end - result.start).toBeCloseTo(3)
    })

    it('moves only the edited edge during a resize', () => {
        expect(snapClipToTargets({start: 1, end: 4.15, mode: 'resize', edge: 'end', targets: [4.2], thresholdSeconds: 0.2}))
            .toEqual({start: 1, end: 4.2})
    })

    it('considers both extremities of every clip as magnetic targets', () => {
        const result = snapClipToTargets({
            start: 2.94,
            end: 4.94,
            mode: 'move',
            targets: [0.25, 3, 7.5, 5],
            thresholdSeconds: 0.1,
        })
        expect(result).toEqual({start: 3, end: 5})
    })

    it('normalizes clip boundaries supplied as strings', () => {
        expect(snapClipToTargets({
            start: 2.94,
            end: 4.94,
            mode: 'move',
            targets: ['3', '7.5'],
            thresholdSeconds: 0.1,
        })).toEqual({start: 3, end: 5})
    })
})
