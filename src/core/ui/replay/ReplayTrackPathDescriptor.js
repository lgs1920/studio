/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayTrackPathDescriptor.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-24
 * Last modified: 2026-08-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Lightweight identity descriptor for plan-owned replay track geometry.
 */

const trackSegmentIds = new WeakMap()
let nextTrackSegmentId = 0

/**
 * Resolve a stable runtime identity for one segment without reading its points.
 *
 * @param {Array|null} segment - Plan-owned coordinate segment.
 * @returns {string} Runtime segment identity.
 */
const replayTrackSegmentIdentity = segment => {
    if (!segment || (typeof segment !== 'object' && typeof segment !== 'function')) {
        return 'none'
    }

    let identity = trackSegmentIds.get(segment)
    if (!identity) {
        nextTrackSegmentId += 1
        identity = `segment-${nextTrackSegmentId}`
        trackSegmentIds.set(segment, identity)
    }
    return identity
}

/**
 * Describe replay track geometry without serializing or cloning coordinates.
 *
 * Segment array identity is stable for the lifetime of the current runtime.
 * Replacing geometry therefore invalidates a warm plan while repeated reads of
 * the same cached logical path remain cheap. Explicit revisions can be supplied
 * by future persisted track models without changing this contract.
 *
 * @param {Array|null} trackPath - Renderer-independent logical track path.
 * @returns {Object} Lightweight path descriptor and signature.
 */
export const createReplayTrackPathDescriptor = trackPath => {
    const tracks = (trackPath ?? []).map((entry, trackIndex) => {
        const segments = (entry?.segments ?? []).map((segment, segmentIndex) => ({
            segmentIndex,
            identity: replayTrackSegmentIdentity(segment),
            pointCount: Array.isArray(segment) ? segment.length : 0,
        }))

        return {
            trackSlug: entry?.trackSlug ?? null,
            trackIndex: Number.isFinite(Number(entry?.trackIndex))
                        ? Number(entry.trackIndex)
                        : trackIndex,
            revision: entry?.revision ?? null,
            segmentCount: segments.length,
            pointCount: segments.reduce((total, segment) => total + segment.pointCount, 0),
            segments,
        }
    })
    const signature = tracks
        .map(track => [
            track.trackSlug ?? '',
            track.trackIndex,
            track.revision ?? '',
            track.segments
                .map(segment => `${segment.identity}:${segment.pointCount}`)
                .join(','),
        ].join(':'))
        .join('|')

    return {
        signature,
        trackCount: tracks.length,
        segmentCount: tracks.reduce((total, track) => total + track.segmentCount, 0),
        pointCount: tracks.reduce((total, track) => total + track.pointCount, 0),
        tracks,
    }
}
