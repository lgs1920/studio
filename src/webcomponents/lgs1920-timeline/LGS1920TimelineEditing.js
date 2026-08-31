/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LGS1920TimelineEditing.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-31
 * Last modified: 2026-08-31
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Clone the editable parts of timeline rows for a transient interaction.
 *
 * @param {Array} rows - Timeline rows.
 * @returns {Array} Cloned rows and clips.
 */
export const cloneRows = rows => rows.map(row => ({
    ...row,
    actions: (row.actions ?? []).map(clip => ({...clip})),
}))

/**
 * Resolve a clip interval with a positive duration.
 *
 * @param {Object} clip - Timeline clip.
 * @returns {{start: number, end: number, duration: number}} Clip interval.
 */
export const resolveClipInterval = clip => {
    const start = Math.max(0, Number(clip?.start) || 0)
    const end = Math.max(start, Number(clip?.end) || start)
    return {start, end, duration: Math.max(0, end - start)}
}

/**
 * Resolve the collision policy for a track.
 *
 * @param {Object} timeline - Timeline configuration.
 * @param {Object} track - Target track.
 * @returns {'allow'|'prevent'|'ripple'} Collision policy.
 */
const resolveCollisionPolicy = (timeline, track) => {
    const policy = track?.collisionPolicy ?? timeline?.collisionPolicy ?? 'allow'
    return ['allow', 'prevent', 'ripple'].includes(policy) ? policy : 'allow'
}

/**
 * Determine whether a track accepts a clip kind.
 *
 * @param {Object} track - Target track.
 * @param {Object} clip - Clip being placed.
 * @returns {boolean} Whether the clip can be placed.
 */
export const trackAcceptsClip = (track, clip) => {
    if (!track || track.droppable === false || track.acceptsClips === false) return false
    if (!Array.isArray(track.accepts) || track.accepts.length === 0) return true
    return track.accepts.includes(clip?.kind)
}

/**
 * Test whether two clip intervals overlap.
 *
 * @param {Object} left - First clip.
 * @param {Object} right - Second clip.
 * @returns {boolean} Whether the intervals overlap.
 */
const clipsOverlap = (left, right) => {
    const first = resolveClipInterval(left)
    const second = resolveClipInterval(right)
    return first.start < second.end && second.start < first.end
}

/**
 * Shift overlapping clips to the right while preserving their durations.
 *
 * @param {Array} clips - Clips on one track.
 * @returns {Array} Layout with overlaps resolved by ripple.
 */
const rippleClips = clips => {
    let previousEnd = 0
    return [...clips]
        .sort((left, right) => {
            const startDifference = resolveClipInterval(left).start - resolveClipInterval(right).start
            return startDifference || String(left.id).localeCompare(String(right.id))
        })
        .map(clip => {
            const interval = resolveClipInterval(clip)
            const start = Math.max(interval.start, previousEnd)
            const end = start + interval.duration
            previousEnd = end
            return {...clip, start, end}
        })
}

/**
 * Create the clip editing controller used by the timeline custom element.
 *
 * @param {Object} options - Controller dependencies.
 * @returns {Object} Clip editing operations.
 */
export const createTimelineClipEditor = ({
    getRows,
    getTimelineConfig,
    getProjectionDurationMillis,
    getTimeAtClientX,
    getTrackAtClientY,
    getRangeEndFollowsDuration,
    setRangeEndMillis,
    setRows,
    setInteractionDurationMillis,
    emit,
    render,
}) => {
    /**
     * Find a clip and its owning track in a row collection.
     *
     * @param {Array} rows - Timeline rows.
     * @param {string} identifier - Clip identifier.
     * @returns {{row: Object, clip: Object}|null} Matching clip entry.
     */
    const findClipEntry = (rows, identifier) => {
        for (const row of rows) {
            const clip = (row.actions ?? []).find(value => value.id === identifier)
            if (clip) return {row, clip}
        }
        return null
    }

    /**
     * Resolve the minimum duration allowed for a clip.
     *
     * @param {Object} track - Owning track.
     * @param {Object} clip - Timeline clip.
     * @returns {number} Minimum duration in seconds.
     */
    const minimumClipDuration = (track, clip) => {
        const timeline = getTimelineConfig()
        const configured = Number(clip?.minDuration ?? track?.minClipDuration ?? timeline.minClipDuration)
        return Number.isFinite(configured) && configured > 0 ? configured : 0
    }

    /**
     * Place a clip on a track and apply the track collision policy.
     *
     * @param {Object} options - Placement options.
     * @param {Array} options.baseRows - Rows before the interaction.
     * @param {Object} options.clip - Clip with proposed bounds.
     * @param {string} options.targetTrackId - Target track identifier.
     * @returns {{rows: Array, durationMillis: number}|null} Proposed state.
     */
    const place = ({baseRows, clip, targetTrackId}) => {
        const timeline = getTimelineConfig()
        const target = baseRows.find(row => row.id === targetTrackId)
        if (!target || !trackAcceptsClip(target, clip)) return null
        const {start, end} = resolveClipInterval(clip)
        if (end <= start) return null

        const rowsWithoutClip = baseRows.map(row => ({
            ...row,
            actions: (row.actions ?? []).filter(value => value.id !== clip.id),
        }))
        const targetAfterRemoval = rowsWithoutClip.find(row => row.id === targetTrackId)
        const policy = resolveCollisionPolicy(timeline, target)
        const proposedClip = Object.assign({}, clip, {start, end})
        const targetClips = [...(targetAfterRemoval?.actions ?? []), proposedClip]

        if (policy === 'prevent' && targetClips.some(value => value.id !== proposedClip.id && clipsOverlap(value, proposedClip))) {
            return null
        }

        const laidOutClips = policy === 'ripple'
            ? rippleClips(targetClips)
            : targetClips.sort((left, right) => resolveClipInterval(left).start - resolveClipInterval(right).start)
        const nextRows = rowsWithoutClip.map(row => row.id === targetTrackId
            ? {...row, actions: laidOutClips}
            : row)
        const maximumEnd = nextRows.reduce((maximum, row) => Math.max(
            maximum,
            ...(row.actions ?? []).map(value => resolveClipInterval(value).end),
        ), 0)
        const baseDurationMillis = Number(getProjectionDurationMillis()) || 0
        const durationPolicy = timeline.durationPolicy ?? 'fixed'
        if (durationPolicy !== 'extend' && maximumEnd * 1000 > baseDurationMillis) return null
        const durationMillis = durationPolicy === 'extend'
            ? Math.max(baseDurationMillis, maximumEnd * 1000)
            : baseDurationMillis
        if (durationMillis > baseDurationMillis && getRangeEndFollowsDuration()) {
            setRangeEndMillis(durationMillis)
        }

        return {rows: nextRows, durationMillis}
    }

    /**
     * Build a public detail payload for a clip edit.
     *
     * @param {Object} state - Interaction state.
     * @param {Object} result - Proposed interaction result.
     * @param {Event} event - Triggering event.
     * @returns {Object} Public event detail.
     */
    const changeDetail = (state, result, event) => {
        const entry = findClipEntry(result.rows, state.clipId)
        const clip = entry ? Object.assign({}, entry.clip, {trackId: entry.row.id}) : null
        return {
            type: state.mode,
            edge: state.edge ?? null,
            clipId: state.clipId,
            fromTrackId: state.sourceTrackId,
            toTrackId: entry?.row.id ?? state.targetTrackId,
            start: clip?.start ?? null,
            end: clip?.end ?? null,
            clip,
            durationMillis: result.durationMillis,
            tracks: result.rows.map(row => {
                const {actions, ...track} = row
                return {...track, clips: actions ?? []}
            }),
            event,
        }
    }

    /**
     * Preview a clip movement or resize from the current pointer position.
     *
     * @param {Object} state - Active interaction state.
     * @param {PointerEvent} event - Pointer event.
     */
    const preview = (state, event) => {
        const entry = findClipEntry(state.baseRows, state.clipId)
        if (!entry) return
        const delta = getTimeAtClientX(event.clientX) - state.startTime
        const duration = state.originalEnd - state.originalStart
        const timeline = getTimelineConfig()
        const baseDuration = (Number(getProjectionDurationMillis()) || 0) / 1000
        const target = state.mode === 'move'
            ? getTrackAtClientY(event.clientY)
            : state.baseRows.find(row => row.id === state.sourceTrackId)
        const targetTrack = target && trackAcceptsClip(target, entry.clip)
            ? target
            : state.baseRows.find(row => row.id === state.sourceTrackId)
        const minimumDuration = minimumClipDuration(targetTrack, entry.clip)
        const durationPolicy = timeline.durationPolicy ?? 'fixed'
        let start = state.originalStart
        let end = state.originalEnd

        if (state.mode === 'move') {
            start = Math.max(0, state.originalStart + delta)
            end = start + duration
            if (durationPolicy !== 'extend') {
                start = Math.min(start, Math.max(0, baseDuration - duration))
                end = start + duration
            }
        } else if (state.edge === 'start') {
            start = Math.max(0, Math.min(state.originalStart + delta, state.originalEnd - minimumDuration))
        } else {
            end = Math.max(state.originalStart + minimumDuration, state.originalEnd + delta)
            if (durationPolicy !== 'extend') end = Math.min(end, baseDuration)
        }

        const result = place({
            baseRows: state.baseRows,
            clip: Object.assign({}, entry.clip, {start, end}),
            targetTrackId: targetTrack.id,
        })
        if (!result) return
        state.targetTrackId = targetTrack.id
        state.lastResult = result
        setRows(result.rows)
        setInteractionDurationMillis(result.durationMillis)
        emit('clip-changing', changeDetail(state, result, event))
        render()
    }

    /**
     * Commit a keyboard clip resize in one step.
     *
     * @param {string} clipId - Clip identifier.
     * @param {'start'|'end'} edge - Resized edge.
     * @param {KeyboardEvent} event - Keyboard event.
     */
    const resizeByKeyboard = (clipId, edge, event) => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
        event.preventDefault()
        event.stopPropagation()
        const rows = getRows()
        const entry = findClipEntry(rows, clipId)
        if (!entry || entry.clip.resizable === false || entry.clip.fixed === true) return
        const timeline = getTimelineConfig()
        const configuredStep = Number(timeline.keyboardStepSeconds)
        const step = configuredStep > 0 ? configuredStep : 0.1
        const delta = (event.key === 'ArrowRight' ? 1 : -1) * step * (event.shiftKey ? 10 : 1)
        const interval = resolveClipInterval(entry.clip)
        const minimumDurationValue = minimumClipDuration(entry.row, entry.clip)
        const nextClip = edge === 'start'
            ? Object.assign({}, entry.clip, {start: Math.max(0, Math.min(interval.start + delta, interval.end - minimumDurationValue))})
            : Object.assign({}, entry.clip, {end: Math.max(interval.start + minimumDurationValue, interval.end + delta)})
        const state = {
            mode: 'resize',
            edge,
            clipId,
            sourceTrackId: entry.row.id,
            targetTrackId: entry.row.id,
        }
        const result = place({
            baseRows: cloneRows(rows),
            clip: nextClip,
            targetTrackId: entry.row.id,
        })
        if (!result) return
        setRows(result.rows)
        setInteractionDurationMillis(result.durationMillis)
        emit('clip-change', changeDetail(state, result, event))
        render()
    }

    return {changeDetail, findClipEntry, place, preview, resizeByKeyboard}
}
