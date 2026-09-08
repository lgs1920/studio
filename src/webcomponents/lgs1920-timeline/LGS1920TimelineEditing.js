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
 * Last modified: 2026-09-08
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
 * Snap an edited interval to nearby clip boundaries or the playhead.
 *
 * @param {Object} options - Proposed interval, edit mode, targets and tolerance.
 * @returns {Object|null} Magnetized interval or null outside the tolerance.
 */
export const snapClipToTargets = ({start, end, mode, edge, targets, thresholdSeconds}) => {
    const edges = mode === 'resize' ? [edge] : ['start', 'end']
    let nearest = null
    edges.forEach(side => targets.forEach(target => {
        if (!Number.isFinite(target) || target < 0) return
        const delta = target - (side === 'start' ? start : end)
        if (Math.abs(delta) > thresholdSeconds + 1e-9) return
        if (mode === 'move' && start + delta < 0) return
        if (nearest === null || Math.abs(delta) < Math.abs(nearest.delta)) nearest = {side, delta}
    }))
    if (!nearest) return null
    const round = value => Number(Number(value).toFixed(6))
    if (mode !== 'resize') return {start: round(start + nearest.delta), end: round(end + nearest.delta)}
    return nearest.side === 'start'
        ? {start: round(start + nearest.delta), end: round(end)}
        : {start: round(start), end: round(end + nearest.delta)}
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
        ? track?.resizeCollisionPolicy ?? timeline?.resizeCollisionPolicy ?? timeline?.collisionPolicy ?? 'prevent'
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
 * Check whether a track layout contains overlapping clips.
 *
 * @param {Array} clips - Clips on one track.
 * @returns {boolean} Whether at least two clips overlap.
 */
export const hasClipOverlaps = clips => {
    const ordered = (clips ?? [])
        .map(clip => ({clip, interval: resolveClipInterval(clip)}))
        .sort((left, right) => left.interval.start - right.interval.start)
    return ordered.some((entry, index) => ordered.slice(index + 1).some(candidate => (
        entry.interval.end > candidate.interval.start
        && candidate.interval.end > entry.interval.start
    )))
}

/**
 * Shift overlapping clips to the right while preserving their durations.
 *
 * @param {Array} clips - Clips on one track.
 * @param {Object} proposedClip - Clip anchored at the requested insertion time.
 * @returns {Array} Layout with overlaps resolved by ripple.
 */
const rippleClips = (clips, proposedClip) => {
    let previousEnd = proposedClip.end
    const shifted = clips.filter(clip => clip.id !== proposedClip.id)
        .sort((left, right) => left.start - right.start)
        .map(clip => {
            if (clip.end <= proposedClip.start) return clip
            const start = Math.max(clip.start, previousEnd)
            const end = start + (clip.end - clip.start)
            previousEnd = end
            return {...clip, start, end}
        })
    return [...shifted, proposedClip].sort((left, right) => left.start - right.start)
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
 * Expand a clip to the free interval between its nearest neighbors.
 *
 * @param {Object} options - Clip extension options.
 * @param {Object} options.clip - Clip to expand.
 * @param {Array} options.otherClips - Other clips on the same track.
 * @param {number} options.durationSeconds - Current timeline duration.
 * @returns {Object} Expanded clip interval.
 */
export const resolveClipExtension = ({clip, otherClips, durationSeconds} = {}) => {
    const current = resolveClipInterval(clip)
    const timelineEnd = Math.max(0, Number(durationSeconds) || 0)
    const previousEnd = (Array.isArray(otherClips) ? otherClips : [])
        .map(resolveClipInterval)
        .filter(interval => interval.end <= current.start)
        .reduce((maximum, interval) => Math.max(maximum, interval.end), 0)
    const nextStart = (Array.isArray(otherClips) ? otherClips : [])
        .map(resolveClipInterval)
        .filter(interval => interval.start >= current.end)
        .reduce((minimum, interval) => Math.min(minimum, interval.start), timelineEnd)
    return {
        start: previousEnd,
        end: Math.max(previousEnd, nextStart),
    }
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
        // A move never trims media to make it fit a smaller gap.
        if (proposed.end > maximumEnd || otherClips.some(value => clipsOverlap(value, clip))) return null
    }

    if (end - start < minimumDuration - 1e-9 || end <= start) return null
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
    getRangeEndMillis,
    getCurrentTimeMillis,
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
        return Number.isFinite(configured) && configured > 0 ? configured : 1 / (Number(timeline.fps) > 0 ? Number(timeline.fps) : 30)
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
        if (!Number.isFinite(Number(clip.start)) || !Number.isFinite(Number(clip.end)) || Number(clip.start) < 0 || end <= start) return null
        const source = findClipEntry(baseRows, clip.id)
        if (source && (source.row.editable === false || source.clip.editable === false)) return null
        if (mode === 'resize' && source?.clip.resizable === false) return null

        const rowsWithoutClip = baseRows.map(row => ({
            ...row,
            actions: (row.actions ?? []).filter(value => value.id !== clip.id),
        }))
        const originalClip = target.actions?.find(value => value.id === clip.id) ?? clip
        const targetAfterRemoval = rowsWithoutClip.find(row => row.id === targetTrackId)
        const policy = previewOnly ? 'allow' : resolveCollisionPolicy(timeline, target, mode)
        const minimumDuration = minimumClipDuration(target, clip)
        const durationPolicy = timeline.durationPolicy ?? 'extend'
        const baseDurationMillis = Number(getProjectionDurationMillis()) || 0
        const extendsDuration = durationPolicy !== 'fixed'
            && (mode !== 'resize' || timeline.resizeExtendsDuration !== false)
        const latestEnd = extendsDuration ? Infinity : baseDurationMillis / 1000
        if (end - start < minimumDuration - 1e-9) return null
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
                ? rippleClips(targetClips, placedClip)
            : targetClips.sort((left, right) => resolveClipInterval(left).start - resolveClipInterval(right).start)
        // Collision prevention is a hard invariant for committed layouts.
        if (!previewOnly && hasClipOverlaps(laidOutClips)) return null
        if (laidOutClips.some(value => value.start < 0)) return null
        if (laidOutClips.some(value => {
            const original = target.actions?.find(candidate => candidate.id === value.id)
            return original?.editable === false && (value.start !== original.start || value.end !== original.end)
        })) return null
        const nextRows = rowsWithoutClip.map(row => row.id === targetTrackId
            ? {...row, actions: laidOutClips}
            : row)
        const maximumEnd = nextRows.reduce((maximum, row) => Math.max(
            maximum,
            ...(row.actions ?? []).map(value => resolveClipInterval(value).end),
        ), 0)
        if (!extendsDuration && maximumEnd * 1000 > baseDurationMillis) return null
        const durationMillis = extendsDuration
            ? Math.max(baseDurationMillis, maximumEnd * 1000)
            : baseDurationMillis
        const rangeEnd = Number(getRangeEndMillis?.())
        const rangeCoversDuration = Number.isFinite(rangeEnd)
            && rangeEnd >= baseDurationMillis - 1e-9
        const rangeEndMillis = getRangeEndFollowsDuration() || rangeCoversDuration ? durationMillis : rangeEnd
        return {rows: nextRows, durationMillis, rangeEndMillis}
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
        const initialEntry = findClipEntry(state.baseRows, state.clipId)
        const clip = entry ? Object.assign({}, entry.clip, {trackId: entry.row.id}) : null
        const oldClip = initialEntry
            ? Object.assign({}, initialEntry.clip, {trackId: initialEntry.row.id})
            : null
        const dragStart = state.dragStart ?? null
        const drag = event
            ? {
                clientX: Number(event.clientX) || 0,
                clientY: Number(event.clientY) || 0,
                time: Number(state.targetTime ?? state.startTime) || 0,
                timeMillis: (Number(state.targetTime ?? state.startTime) || 0) * 1000,
                trackId: entry?.row.id ?? state.targetTrackId ?? null,
            }
            : null
        return {
            type: state.mode,
            edge: state.edge ?? null,
            resizeEdge: state.edge ?? null,
            clipId: state.clipId,
            fromTrackId: state.sourceTrackId,
            toTrackId: entry?.row.id ?? state.targetTrackId,
            start: clip?.start ?? null,
            end: clip?.end ?? null,
            clip,
            oldClip,
            oldTimeline: {
                trackId: state.sourceTrackId,
                clip: oldClip,
                start: oldClip?.start ?? null,
                end: oldClip?.end ?? null,
            },
            newTimeline: {
                trackId: entry?.row.id ?? state.targetTrackId,
                clip,
                start: clip?.start ?? null,
                end: clip?.end ?? null,
            },
            dragStart,
            drag,
            durationMillis: result.durationMillis,
            rangeEndMillis: result.rangeEndMillis,
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
        if (!entry || entry.clip.editable === false || (state.mode === 'resize' && entry.clip.resizable === false)) return
        state.previewClientX = event.clientX
        state.previewClientY = event.clientY
        const delta = getTimeAtClientX(event.clientX) - state.startTime
        state.targetTime = getTimeAtClientX(event.clientX)
        const duration = state.originalEnd - state.originalStart
        const timeline = getTimelineConfig()
        const baseDuration = (Number(getProjectionDurationMillis()) || 0) / 1000
        const target = state.mode === 'move'
            ? getTrackAtClientY(event.clientY)
            : state.baseRows.find(row => row.id === state.sourceTrackId)
        const targetTrack = target ?? state.baseRows.find(row => row.id === state.sourceTrackId)
        const invalidTarget = state.mode === 'move' && (!target || !trackAcceptsClip(target, entry.clip))
        const minimumDuration = minimumClipDuration(targetTrack, entry.clip)
        const durationPolicy = timeline.durationPolicy ?? 'extend'
        const extendsDuration = durationPolicy !== 'fixed'
            && (state.mode !== 'resize' || timeline.resizeExtendsDuration !== false)
        let start = state.originalStart
        let end = state.originalEnd

        if (state.mode === 'move') {
            start = Math.max(0, state.originalStart + delta)
            end = start + duration
            if (!extendsDuration) {
                start = Math.min(start, Math.max(0, baseDuration - duration))
                end = start + duration
            }
        } else if (state.edge === 'start') {
            start = Math.max(0, Math.min(state.originalStart + delta, state.originalEnd - minimumDuration))
        } else {
            end = Math.max(state.originalStart + minimumDuration, state.originalEnd + delta)
            if (!extendsDuration) end = Math.min(end, baseDuration)
        }

        state.previewClip = Object.assign({}, entry.clip, {start, end})

        const snap = resolveSnap({secondary: (state.mode === 'move' || state.mode === 'resize') && event.shiftKey === true})
        if (snap && !event.altKey) {
            const snapped = snapClipToMajorUnits({start, end, mode: state.mode, edge: state.edge, ...snap})
            const targets = [0, Number(getCurrentTimeMillis?.()) / 1000]
            state.baseRows.forEach(row => (row.actions ?? []).forEach(clip => {
                if (clip.id !== state.clipId) targets.push(clip.start, clip.end)
            }))
            const magnetic = snapClipToTargets({start, end, mode: state.mode, edge: state.edge,
                targets, thresholdSeconds: snap.thresholdSeconds})
            start = magnetic?.start ?? snapped.start
            end = magnetic?.end ?? snapped.end
        }
        if (state.mode === 'move') {
            start = Math.max(0, start)
            if (!extendsDuration) start = Math.min(start, Math.max(0, baseDuration - duration))
            end = start + duration
        } else if (state.edge === 'start') {
            start = Math.max(0, Math.min(start, state.originalEnd - minimumDuration))
        } else {
            end = Math.max(state.originalStart + minimumDuration, end)
            if (!extendsDuration) end = Math.min(end, baseDuration)
        }

        const result = invalidTarget ? null : place({
            baseRows: state.baseRows,
            clip: Object.assign({}, entry.clip, {start, end}),
            targetTrackId: targetTrack.id,
            mode: state.mode,
            edge: state.edge,
        })
        state.targetTrackId = targetTrack.id
        if (!result) {
            state.dropRejected = true
            state.lastResult = null
            // Keep the last valid layout visible while the rejected pointer
            // position is marked on the target track. Invalid overlaps never
            // enter the transient row state, even during a preview.
            setRows(state.baseRows)
            setInteractionDurationMillis(state.initialDurationMillis)
            if (Number.isFinite(state.initialRangeEndMillis)) setRangeEndMillis(state.initialRangeEndMillis)
            render()
            return
        }
        state.dropRejected = false
        state.lastResult = result
        setRows(result.rows)
        setRangeEndMillis(result.rangeEndMillis)
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
    /**
     * Resolve an extension transaction for one clip.
     *
     * @param {string} clipId - Clip identifier.
     * @returns {{rows: Array, durationMillis: number, rangeEndMillis: number}|null} Extension result.
     */
    const extend = clipId => {
        const rows = cloneRows(getRows())
        const entry = findClipEntry(rows, clipId)
        if (!entry || entry.clip.editable === false || entry.row.editable === false) return null
        const otherClips = (entry.row.actions ?? []).filter(value => value.id !== clipId)
        const interval = resolveClipExtension({
            clip: entry.clip,
            otherClips,
            durationSeconds: (Number(getProjectionDurationMillis()) || 0) / 1000,
        })
        return place({
            baseRows: rows,
            clip: {...entry.clip, ...interval},
            targetTrackId: entry.row.id,
            mode: 'move',
        })
    }

    const resizeByKeyboard = (clipId, edge, event) => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
        if (getTimelineConfig().editable === false) return
        event.preventDefault()
        event.stopPropagation()
        const rows = getRows()
        const entry = findClipEntry(rows, clipId)
        if (!entry || entry.clip.editable === false || entry.clip.resizable === false) return
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
            startTime: interval[edge === 'start' ? 'start' : 'end'],
            targetTime: interval[edge === 'start' ? 'start' : 'end'],
            baseRows: cloneRows(rows),
            dragStart: {
                clientX: Number(event.clientX) || 0,
                clientY: Number(event.clientY) || 0,
                time: interval[edge === 'start' ? 'start' : 'end'],
                timeMillis: interval[edge === 'start' ? 'start' : 'end'] * 1000,
                trackId: entry.row.id,
            },
        }
        const result = place({
            baseRows: cloneRows(rows),
            clip: nextClip,
            targetTrackId: entry.row.id,
            mode: 'resize',
            edge,
        })
        if (!result) return
        const detail = changeDetail(state, result, event)
        if (emit('before-clip-change', detail, {cancelable: true}).defaultPrevented) return
        setRows(result.rows)
        setRangeEndMillis(result.rangeEndMillis)
        setInteractionDurationMillis(result.durationMillis)
        emit('clip-change', detail)
        render()
        emit('after-clip-change', detail)
    }

    return {changeDetail, extend, findClipEntry, place, preview, resizeByKeyboard}
}
