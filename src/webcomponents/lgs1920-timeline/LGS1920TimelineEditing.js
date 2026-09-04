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
 * Last modified: 2026-09-04
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
 * Snap a time value to the nearest ruler unit when it is close enough.
 *
 * @param {number} time - Time value in seconds.
 * @param {Object} options - Snap configuration.
 * @param {number} options.majorSeconds - Duration of one ruler unit.
 * @param {number} options.thresholdSeconds - Maximum distance allowed for snapping.
 * @returns {number} Snapped or unchanged time value.
 */
export const snapTimeToMajorUnit = (time, {majorSeconds, thresholdSeconds} = {}) => {
    const value = Number(time)
    const unit = Number(majorSeconds)
    const threshold = Number(thresholdSeconds)
    if (!Number.isFinite(value) || !Number.isFinite(unit) || unit <= 0 || !Number.isFinite(threshold) || threshold < 0) return value
    const snapped = Math.round(value / unit) * unit
    return Math.abs(snapped - value) <= threshold + 1e-9 ? Number(snapped.toFixed(6)) : value
}

/**
 * Snap the edited edge, or the closest edge during a move, to a ruler unit.
 *
 * @param {Object} options - Clip interval and snap configuration.
 * @param {number} options.start - Proposed clip start in seconds.
 * @param {number} options.end - Proposed clip end in seconds.
 * @param {'move'|'resize'} options.mode - Interaction mode.
 * @param {'start'|'end'|null} options.edge - Resized edge.
 * @param {number} options.majorSeconds - Duration of one ruler unit.
 * @param {number} options.thresholdSeconds - Maximum distance allowed for snapping.
 * @returns {{start: number, end: number}} Snapped clip interval.
 */
export const snapClipToMajorUnits = ({start, end, mode, edge, majorSeconds, thresholdSeconds}) => {
    const interval = {start: Number(start), end: Number(end)}
    if (mode === 'resize') {
        if (edge === 'start') {
            interval.start = snapTimeToMajorUnit(interval.start, {majorSeconds, thresholdSeconds})
        } else if (edge === 'end') {
            interval.end = snapTimeToMajorUnit(interval.end, {majorSeconds, thresholdSeconds})
        }
        return interval
    }

    const duration = interval.end - interval.start
    const unit = Number(majorSeconds)
    const threshold = Number(thresholdSeconds)
    if (!Number.isFinite(unit) || unit <= 0 || !Number.isFinite(threshold) || threshold < 0) return interval
    const candidates = [
        {edge: 'start', target: Math.round(interval.start / unit) * unit},
        {edge: 'end', target: Math.round(interval.end / unit) * unit},
    ]
    candidates.forEach(candidate => {
        candidate.distance = Math.abs(candidate.target - (candidate.edge === 'start' ? interval.start : interval.end))
    })
    candidates.sort((left, right) => left.distance - right.distance)
    const nearest = candidates[0]
    if (!nearest || nearest.distance > threshold + 1e-9) return interval
    const target = nearest.target
    return nearest.edge === 'start'
        ? {start: target, end: target + duration}
        : {start: target - duration, end: target}
}

/**
 * Resolve the collision policy for a track.
 *
 * @param {Object} timeline - Timeline configuration.
 * @param {Object} track - Target track.
 * @returns {'allow'|'prevent'|'ripple'} Collision policy.
 */
const resolveCollisionPolicy = (timeline, track, mode = 'move') => {
    const policy = mode === 'resize'
        ? track?.resizeCollisionPolicy ?? timeline?.resizeCollisionPolicy ?? 'ripple'
        : track?.collisionPolicy ?? timeline?.collisionPolicy ?? 'prevent'
    return ['allow', 'prevent', 'ripple'].includes(policy) ? policy : 'prevent'
}

/**
 * Determine whether a track accepts a clip kind.
 *
 * @param {Object} track - Target track.
 * @param {Object} clip - Clip being placed.
 * @returns {boolean} Whether the clip can be placed.
 */
export const trackAcceptsClip = (track, clip) => {
    if (!track || track.editable === false || track.droppable === false || track.acceptsClips === false) return false
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
 * Ripple clips on the edited side of a resized clip.
 *
 * @param {Object} options - Resize ripple options.
 * @param {Array} options.clips - Clips on the target track including the edited clip.
 * @param {Object} options.originalClip - Clip before the resize.
 * @param {Object} options.proposedClip - Clip after the resize.
 * @param {'start'|'end'} options.edge - Resized edge.
 * @returns {Array} Resized and rippled clips.
 */
export const rippleResizedClips = ({clips, originalClip, proposedClip, edge}) => {
    const original = resolveClipInterval(originalClip)
    const proposed = resolveClipInterval(proposedClip)
    const delta = edge === 'start'
        ? proposed.start - original.start
        : proposed.end - original.end

    return clips.map(value => {
        if (value.id === proposedClip.id) return proposedClip
        const interval = resolveClipInterval(value)
        const isOnEditedSide = edge === 'start'
            ? interval.end <= original.start
            : interval.start >= original.end
        if (!isOnEditedSide) return value
        return {...value, start: interval.start + delta, end: interval.end + delta}
    }).sort((left, right) => resolveClipInterval(left).start - resolveClipInterval(right).start)
}

/**
 * Fit a proposed clip into the free interval of a track.
 *
 * @param {Object} options - Placement options.
 * @param {Object} options.clip - Proposed clip.
 * @param {Array} options.otherClips - Other clips on the target track.
 * @param {'move'|'resize'} options.mode - Interaction mode.
 * @param {'start'|'end'|null} options.edge - Resized edge.
 * @param {number} options.minimumDuration - Minimum duration in seconds.
 * @param {number} options.maximumEnd - Latest permitted end in seconds.
 * @returns {Object|null} Fitted clip or null when no valid interval remains.
 */
const fitClipToFreeInterval = ({clip, otherClips, mode, edge, minimumDuration, maximumEnd}) => {
    const proposed = resolveClipInterval(clip)
    const ordered = otherClips
        .map(value => ({clip: value, interval: resolveClipInterval(value)}))
        .sort((left, right) => left.interval.start - right.interval.start)
    let start = proposed.start
    let end = Math.min(proposed.end, maximumEnd)

    if (mode === 'resize' && edge === 'start') {
        const blockingClips = ordered.filter(({interval}) => (
            interval.start < proposed.end && interval.end > proposed.start
        ))
        start = Math.max(start, ...blockingClips.map(({interval}) => interval.end), 0)
    } else if (mode === 'resize' && edge === 'end') {
        const nextClip = ordered.find(({interval}) => (
            interval.start >= proposed.start && interval.start < proposed.end
        ))
        if (nextClip) end = Math.min(end, nextClip.interval.start)
    } else {
        const currentBlocker = ordered.find(({interval}) => (
            interval.start < start && interval.end > start
        ))
        if (currentBlocker) return null
        const nextClip = ordered.find(({interval}) => (
            interval.start >= start && interval.start < end
        ))
        if (nextClip) end = Math.min(end, nextClip.interval.start)
    }

    if (end - start < minimumDuration || end <= start) return null
    const fitted = Object.assign({}, clip, {start, end})
    return otherClips.some(value => clipsOverlap(value, fitted)) ? null : fitted
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
    getMajorRulerUnit,
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
     * Resolve the magnetic snap configuration for the current ruler.
     *
     * @param {Object} [options] - Snap options.
     * @param {boolean} [options.secondary=false] - Use the secondary ruler unit.
     * @returns {{majorSeconds: number, thresholdSeconds: number}|null} Snap configuration.
     */
    const resolveSnap = ({secondary = false} = {}) => {
        const timeline = getTimelineConfig()
        if (timeline.snap === false) return null
        const unit = getMajorRulerUnit?.()
        const requestedSeconds = secondary ? Number(unit?.minorSeconds) : Number(unit?.seconds)
        const requestedPixels = secondary ? Number(unit?.minorPixels) : Number(unit?.pixels)
        const majorSeconds = requestedSeconds > 0 ? requestedSeconds : Number(unit?.seconds)
        const pixels = requestedPixels > 0 ? requestedPixels : Number(unit?.pixels)
        if (!Number.isFinite(majorSeconds) || majorSeconds <= 0 || !Number.isFinite(pixels) || pixels <= 0) return null
        const configuredPixels = Number(timeline.snapThresholdPixels)
        const thresholdPixels = Number.isFinite(configuredPixels) && configuredPixels >= 0 ? configuredPixels : 8
        return {
            majorSeconds,
            thresholdSeconds: (thresholdPixels / pixels) * majorSeconds,
        }
    }

    /**
     * Place a clip on a track and apply the track collision policy.
     *
     * @param {Object} options - Placement options.
     * @param {Array} options.baseRows - Rows before the interaction.
     * @param {Object} options.clip - Clip with proposed bounds.
     * @param {string} options.targetTrackId - Target track identifier.
     * @param {'move'|'resize'} [options.mode='move'] - Interaction mode.
     * @param {'start'|'end'|null} [options.edge=null] - Resized edge.
     * @param {boolean} [options.previewOnly=false] - Allow an invalid overlap for visual preview.
     * @returns {{rows: Array, durationMillis: number}|null} Proposed state.
     */
    const place = ({baseRows, clip, targetTrackId, mode = 'move', edge = null, previewOnly = false}) => {
        const timeline = getTimelineConfig()
        const target = baseRows.find(row => row.id === targetTrackId)
        if (!target || !trackAcceptsClip(target, clip)) return null
        const {start, end} = resolveClipInterval(clip)
        if (end <= start) return null

        const rowsWithoutClip = baseRows.map(row => ({
            ...row,
            actions: (row.actions ?? []).filter(value => value.id !== clip.id),
        }))
        const originalClip = target.actions?.find(value => value.id === clip.id) ?? clip
        const targetAfterRemoval = rowsWithoutClip.find(row => row.id === targetTrackId)
        const policy = previewOnly ? 'allow' : resolveCollisionPolicy(timeline, target, mode)
        const minimumDuration = minimumClipDuration(target, clip)
        const durationPolicy = timeline.durationPolicy ?? 'fixed'
        const baseDurationMillis = Number(getProjectionDurationMillis()) || 0
        const latestEnd = durationPolicy === 'extend' ? Infinity : baseDurationMillis / 1000
        const proposedClip = Object.assign({}, clip, {start, end})
        const placedClip = policy === 'prevent'
            ? fitClipToFreeInterval({
                clip: proposedClip,
                otherClips: targetAfterRemoval?.actions ?? [],
                mode,
                edge,
                minimumDuration,
                maximumEnd: latestEnd,
            })
            : proposedClip
        if (!placedClip) return null
        const targetClips = [...(targetAfterRemoval?.actions ?? []), placedClip]

        const laidOutClips = policy === 'ripple' && mode === 'resize'
            ? rippleResizedClips({
                clips: targetClips,
                originalClip,
                proposedClip: placedClip,
                edge,
            })
            : policy === 'ripple'
                ? rippleClips(targetClips)
            : targetClips.sort((left, right) => resolveClipInterval(left).start - resolveClipInterval(right).start)
        if (laidOutClips.some(value => resolveClipInterval(value).start < 0)) return null
        const nextRows = rowsWithoutClip.map(row => row.id === targetTrackId
            ? {...row, actions: laidOutClips}
            : row)
        const maximumEnd = nextRows.reduce((maximum, row) => Math.max(
            maximum,
            ...(row.actions ?? []).map(value => resolveClipInterval(value).end),
        ), 0)
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
                const track = Object.assign({}, row)
                const actions = track.actions ?? []
                delete track.actions
                delete track.locked
                delete track.movable
                delete track.fixed
                return {...track, clips: actions}
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
        if (!entry || (state.mode === 'resize' && entry.clip.resizable === false)) return
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

        const snap = resolveSnap({secondary: (state.mode === 'move' || state.mode === 'resize') && event.shiftKey === true})
        if (snap) {
            const snapped = snapClipToMajorUnits({start, end, mode: state.mode, edge: state.edge, ...snap})
            start = snapped.start
            end = snapped.end
        }
        if (state.mode === 'move') {
            start = Math.max(0, start)
            if (durationPolicy !== 'extend') start = Math.min(start, Math.max(0, baseDuration - duration))
            end = start + duration
        } else if (state.edge === 'start') {
            start = Math.max(0, Math.min(start, state.originalEnd - minimumDuration))
        } else {
            end = Math.max(state.originalStart + minimumDuration, end)
            if (durationPolicy !== 'extend') end = Math.min(end, baseDuration)
        }

        const result = place({
            baseRows: state.baseRows,
            clip: Object.assign({}, entry.clip, {start, end}),
            targetTrackId: targetTrack.id,
            mode: state.mode,
            edge: state.edge,
        })
        state.targetTrackId = targetTrack.id
        if (!result) {
            state.dropRejected = true
            const previewResult = place({
                baseRows: state.baseRows,
                clip: Object.assign({}, entry.clip, {start, end}),
                targetTrackId: targetTrack.id,
                mode: state.mode,
                edge: state.edge,
                previewOnly: true,
            })
            if (previewResult) {
                setRows(previewResult.rows)
                setInteractionDurationMillis(previewResult.durationMillis)
            }
            render()
            return
        }
        state.dropRejected = false
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
        if (getTimelineConfig().editable === false) return
        event.preventDefault()
        event.stopPropagation()
        const rows = getRows()
        const entry = findClipEntry(rows, clipId)
        if (!entry) return
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
            mode: 'resize',
            edge,
        })
        if (!result) return
        setRows(result.rows)
        setInteractionDurationMillis(result.durationMillis)
        emit('clip-change', changeDetail(state, result, event))
        render()
    }

    return {changeDetail, findClipEntry, place, preview, resizeByKeyboard}
}
