/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayTimelinePersistence.js
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

const REPLAY_VIDEO_TIMELINE_VERSION = 1
const REPLAY_TRACK_ID = 'replay'
const REPLAY_CLIP_SLOT_PRE_REPLAY = 'pre-replay'
const REPLAY_CLIP_SLOT_POST_REPLAY = 'post-replay'

/**
 * Read a finite number without treating null and empty values as zero.
 *
 * @param {*} value - Candidate value.
 * @returns {number|null} Finite number or null.
 */
const finiteNumber = value => {
    if (value === null || value === undefined || value === '') {
        return null
    }

    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

/**
 * Return a detached serializable copy of a Replay clip configuration.
 *
 * @param {Object|null} clips - Candidate Replay clip configuration.
 * @returns {Object} Detached configuration or an empty object when cloning fails.
 */
const cloneReplayClips = clips => {
    try {
        return JSON.parse(JSON.stringify(clips ?? {}))
    }
    catch {
        return {}
    }
}

/**
 * Return trimmed, non-empty string values without duplicates.
 *
 * @param {Array} values - Candidate string values.
 * @returns {string[]} Unique string values.
 */
const uniqueStrings = values => [...new Set((values ?? [])
    .filter(value => typeof value === 'string' && value.trim() !== '')
    .map(value => value.trim()))]

/**
 * Collect widget instance IDs referenced by serialized timeline tracks.
 *
 * @param {Array} tracks - Public timeline tracks.
 * @returns {string[]} Widget instance identifiers.
 */
export const resolveReplayTimelineWidgetIds = tracks => {
    const ids = []
    for (const track of Array.isArray(tracks) ? tracks : []) {
        if (track?.id === REPLAY_TRACK_ID || track?.kind === REPLAY_TRACK_ID) {
            continue
        }

        const trackIds = [track?.widgetId, ...(Array.isArray(track?.widgetIds) ? track.widgetIds : [])]
        for (const clip of track?.clips ?? []) {
            trackIds.push(clip?.metadata?.widgetId, clip?.widgetId)
        }

        if (!trackIds.some(Boolean) && !track?.widgetGroup && track?.id) {
            trackIds.push(track.id)
        }
        ids.push(...trackIds)
    }

    return uniqueStrings(ids)
}

/**
 * Build the complete widget manifest from current rows and an earlier snapshot.
 *
 * The manifest retains IDs for rows removed from the timeline so Replay can
 * keep those widgets mounted and resolve their absence as hidden.
 *
 * @param {Array} widgetOrder - Current timeline widget rows.
 * @param {Array} previousIds - IDs retained by an earlier timeline snapshot.
 * @returns {string[]} Unique widget instance identifiers.
 */
export const resolveReplayTimelineWidgetManifest = (widgetOrder = [], previousIds = []) => {
    const ids = [...(previousIds ?? [])]
    for (const widget of Array.isArray(widgetOrder) ? widgetOrder : []) {
        if (typeof widget === 'string') {
            ids.push(widget)
            continue
        }

        const isGroup = widget?.isGroup === true
            || widget?.type === 'widget-group'
            || Array.isArray(widget?.members)
        if (!isGroup) {
            ids.push(widget?.widgetId, widget?.id)
        }
        ids.push(...(Array.isArray(widget?.widgetIds) ? widget.widgetIds : []))
        ids.push(...(Array.isArray(widget?.members) ? widget.members.map(member => member?.id) : []))
    }

    return uniqueStrings(ids)
}

/**
 * Convert edited Replay phase events back into the clip configuration consumed
 * by interactive playback and deferred video export.
 *
 * Timeline clip bounds use seconds, while Replay clip instances store duration
 * in `params.duration`. The timeline row remains the source of ordering and
 * duration edits; widget rows are deliberately ignored here.
 *
 * @param {Object} options - Replay timeline and source clip configuration.
 * @param {Array} options.tracks - Public timeline track state.
 * @param {Object|null} options.clips - Current normalized Replay clips.
 * @returns {Object|null} Updated clip configuration, or null when no Replay row exists.
 */
export const resolveReplayTimelineClips = ({tracks, clips} = {}) => {
    const replayTrack = (Array.isArray(tracks) ? tracks : []).find(track => (
        track?.id === REPLAY_TRACK_ID || track?.kind === REPLAY_TRACK_ID
    ))
    if (!replayTrack || !Array.isArray(replayTrack.clips)) {
        return null
    }

    const source = cloneReplayClips(clips)
    const sourceCatalog = source.catalog ?? source.definitions ?? {}
    const hasConfiguredClips = (source.start?.length ?? 0) > 0 || (source.stop?.length ?? 0) > 0
    const phaseEvents = replayTrack.clips.filter(clip => (
        clip?.kind === REPLAY_CLIP_SLOT_PRE_REPLAY || clip?.kind === REPLAY_CLIP_SLOT_POST_REPLAY
    ))
    if (phaseEvents.length === 0 && !hasConfiguredClips) {
        return null
    }

    const resolveSlot = slot => replayTrack.clips
        .map((event, index) => ({event, index}))
        .filter(({event}) => event?.kind === slot)
        .sort((left, right) => {
            const leftStart = finiteNumber(left.event.start) ?? left.index
            const rightStart = finiteNumber(right.event.start) ?? right.index
            return leftStart - rightStart || left.index - right.index
        })
        .map(({event}) => {
            const instance = event?.metadata?.clip ?? event?.clip
            const start = finiteNumber(event?.start)
            const end = finiteNumber(event?.end)
            if (!instance || typeof instance !== 'object' || start === null || end === null) {
                return null
            }

            return {
                ...instance,
                slot,
                enabled: instance.enabled !== false && event.enabled !== false,
                params: {
                    ...(instance.params ?? {}),
                    duration: Math.max(0, end - start),
                },
            }
        })
        .filter(Boolean)

    return {
        catalog: sourceCatalog,
        start: resolveSlot(REPLAY_CLIP_SLOT_PRE_REPLAY),
        stop: resolveSlot(REPLAY_CLIP_SLOT_POST_REPLAY),
    }
}

/**
 * Normalize the Journey-owned Replay video timeline snapshot.
 *
 * @param {Object|null} value - Persisted timeline data.
 * @returns {Object|null} Serializable snapshot or null when invalid.
 */
export const normalizeJourneyReplayVideoTimeline = value => {
    if (!value || typeof value !== 'object' || !Array.isArray(value.tracks)) {
        return null
    }

    let tracks
    try {
        tracks = JSON.parse(JSON.stringify(value.tracks))
    }
    catch {
        return null
    }

    const source = value.source && typeof value.source === 'object' ? value.source : {}
    const timeline = value.timeline && typeof value.timeline === 'object' ? value.timeline : {}
    const widgetManifest = uniqueStrings(value.widgetManifest)
    const resolvedManifest = widgetManifest.length > 0
        ? widgetManifest
        : resolveReplayTimelineWidgetIds(tracks)

    return {
        version: REPLAY_VIDEO_TIMELINE_VERSION,
        journeySlug: typeof value.journeySlug === 'string' ? value.journeySlug : null,
        sourceSignature: typeof value.sourceSignature === 'string' ? value.sourceSignature : null,
        source: {
            clipSignature: typeof source.clipSignature === 'string' ? source.clipSignature : null,
            replayDurationMillis: finiteNumber(source.replayDurationMillis),
            frameCount: finiteNumber(source.frameCount),
            frameIntervalMs: finiteNumber(source.frameIntervalMs),
        },
        direction: finiteNumber(value.direction),
        fps: finiteNumber(value.fps),
        timeline: {
            durationMillis: finiteNumber(timeline.durationMillis),
            rangeStartMillis: finiteNumber(timeline.rangeStartMillis),
            rangeEndMillis: finiteNumber(timeline.rangeEndMillis),
            currentTimeMillis: finiteNumber(timeline.currentTimeMillis),
        },
        widgetManifest: resolvedManifest,
        tracks,
    }
}

/**
 * Check whether a saved timeline still describes the current Replay source.
 *
 * @param {Object|null} savedTimeline - Journey-owned snapshot.
 * @param {Object|null} projection - Current normalized Replay projection.
 * @returns {boolean} Whether its source ranges remain valid.
 */
export const isReplayTimelineSourceUnchanged = (savedTimeline, projection) => {
    const saved = normalizeJourneyReplayVideoTimeline(savedTimeline)
    if (!saved || !projection) {
        return false
    }

    return saved.source.clipSignature === (projection.source?.clipSignature ?? null)
        && saved.source.replayDurationMillis === finiteNumber(projection.source?.replayDurationMillis)
        && saved.direction === finiteNumber(projection.direction)
        && saved.fps === finiteNumber(projection.fps)
        && saved.timeline.durationMillis === finiteNumber(projection.durationMillis)
}

/**
 * Resolve the widget instances represented by one display row.
 *
 * @param {Object} track - Public timeline row.
 * @returns {string[]} Widget instance identifiers.
 */
const timelineWidgetIds = track => resolveReplayTimelineWidgetIds([track])

/**
 * Find the saved row that represents one or more current widget instances.
 *
 * @param {Object} track - Current or saved timeline row.
 * @param {Array} savedTracks - Candidate saved rows.
 * @returns {Object|null} Matching row or null.
 */
const findSavedTrack = (track, savedTracks) => {
    const widgetIds = new Set(timelineWidgetIds(track))
    if (widgetIds.size === 0) {
        return null
    }

    return savedTracks.find(savedTrack => timelineWidgetIds(savedTrack).some(id => widgetIds.has(id))) ?? null
}

/**
 * Carry row and clip visibility onto a freshly projected source row.
 *
 * @param {Object} baseTrack - Current source row.
 * @param {Object|null} savedTrack - Saved row with user visibility state.
 * @returns {Object} Current row with saved visibility.
 */
const preserveTimelineWidgetVisibility = (baseTrack, savedTrack) => {
    if (!savedTrack) {
        return baseTrack
    }

    const clipsById = new Map((savedTrack.clips ?? []).map(clip => [String(clip.id), clip]))
    return Object.assign({}, baseTrack, {
        visible: savedTrack.visible,
        clips: (baseTrack.clips ?? []).map(clip => {
            const savedClip = clipsById.get(String(clip.id))
            return savedClip ? {...clip, visible: savedClip.visible} : clip
        }),
    })
}

/**
 * Restore saved widget rows against the current source projection.
 *
 * Exact projections restore their complete editor state. A changed widget
 * catalogue with an unchanged Replay source keeps saved row order, visibility,
 * and removals while appending newly registered widgets. Changed Replay source
 * ranges use the fresh projection.
 *
 * @param {Object} options - Restoration inputs.
 * @param {Array} options.baseTracks - Fresh display rows.
 * @param {Object|null} options.savedTimeline - Persisted Journey snapshot.
 * @param {Object} options.projection - Current Replay projection.
 * @returns {Array} Restored display rows.
 */
export const restoreReplayTimelineTracks = ({baseTracks, savedTimeline, projection} = {}) => {
    const currentBaseTracks = Array.isArray(baseTracks) ? baseTracks : []
    const saved = normalizeJourneyReplayVideoTimeline(savedTimeline)
    if (!saved) {
        return currentBaseTracks
    }
    if (saved.sourceSignature === projection?.signature) {
        return saved.tracks
    }

    const sameSource = isReplayTimelineSourceUnchanged(saved, projection)
    const savedWidgetTracks = saved.tracks.filter(track => track?.id !== REPLAY_TRACK_ID
        && track?.kind !== REPLAY_TRACK_ID)
    const manifest = new Set(saved.widgetManifest)
    const baseWidgetTracks = currentBaseTracks.filter(track => track?.id !== REPLAY_TRACK_ID
        && track?.kind !== REPLAY_TRACK_ID)
    const baseReplayTrack = currentBaseTracks.find(track => track?.id === REPLAY_TRACK_ID
        || track?.kind === REPLAY_TRACK_ID)

    if (!sameSource) {
        const restoredWidgetTracks = savedWidgetTracks.map(savedTrack => {
            const currentTrack = findSavedTrack(savedTrack, baseWidgetTracks)
            return currentTrack ? preserveTimelineWidgetVisibility(currentTrack, savedTrack) : savedTrack
        })
        const restoredWidgetIds = new Set(resolveReplayTimelineWidgetIds(restoredWidgetTracks))
        const newlyRegisteredTracks = baseWidgetTracks.filter(track => {
            const ids = timelineWidgetIds(track)
            return ids.some(id => !manifest.has(id) && !restoredWidgetIds.has(id))
        })
        return baseReplayTrack
            ? [...restoredWidgetTracks, ...newlyRegisteredTracks, baseReplayTrack]
            : [...restoredWidgetTracks, ...newlyRegisteredTracks]
    }

    const restoredWidgetTracks = savedWidgetTracks
    const knownSavedIds = new Set(resolveReplayTimelineWidgetIds(restoredWidgetTracks))
    const newlyRegisteredTracks = baseWidgetTracks.filter(track => {
        const ids = timelineWidgetIds(track)
        return ids.some(id => !manifest.has(id) && !knownSavedIds.has(id))
    })
    const savedReplayTrack = saved.tracks.find(track => track?.id === REPLAY_TRACK_ID
        || track?.kind === REPLAY_TRACK_ID)

    return [
        ...restoredWidgetTracks,
        ...newlyRegisteredTracks,
        savedReplayTrack ?? baseReplayTrack,
    ].filter(Boolean)
}
