/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayPOISpeedProfile.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-28
 * Last modified: 2026-10-31
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {normalizeJourneyReplayPOISettings, normalizeReplayPOIBehavior} from './JourneyReplayPOISettings'

const DEFAULT_POI_PLAYBACK_SPEED_FACTOR = 0.5
const DEFAULT_POI_SLOWDOWN_DURATION_MILLIS = 1000
const POI_CRAWL_SPEED_FACTOR = 0.05
const POI_CRAWL_RAMP_STEPS = 16
const MAX_POI_REPLAY_DISTANCE_METERS = 500
const POI_SPEED_RAMP_STEPS = 16

/** Convert input into a finite number or null. */
const finiteNumber = value => {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

/** Clamp a numeric value to an inclusive range. */
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value))

/** Create a one-second crawl profile that reaches zero speed at the POI. */
const createPOICrawlSegments = (centerMillis, routeDuration) => {
    const maximumRouteSpan = DEFAULT_POI_SLOWDOWN_DURATION_MILLIS * POI_CRAWL_SPEED_FACTOR / 2
    const routeSpan = Math.min(
        maximumRouteSpan,
        Math.max(0, centerMillis) * 2,
        Math.max(0, routeDuration - centerMillis) * 2,
    )
    if (routeSpan <= 0) {
        return []
    }

    const peakSpeedFactor = routeSpan * 2 / DEFAULT_POI_SLOWDOWN_DURATION_MILLIS
    const routeStartMillis = centerMillis - routeSpan / 2
    const halfDurationMillis = DEFAULT_POI_SLOWDOWN_DURATION_MILLIS / 2
    const stepDurationMillis = halfDurationMillis / POI_CRAWL_RAMP_STEPS
    const segments = []
    let routeCursor = routeStartMillis

    for (let half = 0; half < 2; half += 1) {
        for (let step = 0; step < POI_CRAWL_RAMP_STEPS; step += 1) {
            const start = step * stepDurationMillis
            const end = (step + 1) * stepDurationMillis
            const routeDistance = half === 0
                ? peakSpeedFactor * (end - start - (end ** 2 - start ** 2) / (2 * halfDurationMillis))
                : peakSpeedFactor * (end ** 2 - start ** 2) / (2 * halfDurationMillis)
            const routeEndMillis = half === 0 && step === POI_CRAWL_RAMP_STEPS - 1
                ? centerMillis
                : half === 1 && step === POI_CRAWL_RAMP_STEPS - 1
                    ? routeStartMillis + routeSpan
                    : routeCursor + routeDistance
            const segmentDurationMillis = stepDurationMillis
            segments.push({
                routeStartMillis: routeCursor,
                routeEndMillis,
                speedFactor: (routeEndMillis - routeCursor) / segmentDurationMillis,
            })
            routeCursor = routeEndMillis
        }
    }

    return segments
}

/** Check whether the POI is close enough to the Replay route to affect its timing. */
const isPOINearReplayRoute = entry => {
    const distance = finiteNumber(entry?.distanceToJourneyMeters)
    return distance === null || distance <= MAX_POI_REPLAY_DISTANCE_METERS
}

/** Return whether this POI can actually be shown as an animated Replay POI. */
const canAnimatePOIInReplay = (entry, behavior) => {
    const poi = entry?.poi ?? entry
    const settings = normalizeJourneyReplayPOISettings(poi?.replay)
    const isEndpoint = ['start', 'stop', 'starter'].includes(poi?.type)
    const replayVisible = isEndpoint
        ? settings.visible
        : behavior.poiVisibilityMode !== 'user' || settings.visible
    return behavior.animatePoisDuringJourneyReplay
        && settings.animated
        && replayVisible
        && poi?.visible !== false
        && entry?.inVideoCrop !== false
}

/** Return an unmodified route timeline when no POI can produce a visible animation. */
const createRouteOnlyProfile = (routeDuration, safeDirection, factor, shouldSlowdown = false) => ({
    routeDurationMillis: routeDuration,
    playbackDurationMillis: routeDuration,
    direction: safeDirection,
    shouldSlowdown,
    speedFactor: factor,
    segments: [{
        routeStartMillis: 0,
        routeEndMillis: routeDuration,
        playbackStartMillis: 0,
        playbackEndMillis: routeDuration,
        speedFactor: 1,
    }],
})

/**
 * Build a time-warp profile that slows around displayed POIs and crawls past each one.
 *
 * @param {object} options - Replay and POI timing inputs.
 * @returns {object} Route and playback time segments with the effective duration.
 */
export const createReplayPOISpeedProfile = ({
    entries = [],
    totalDistance = 0,
    replayDurationMillis = 0,
    direction = 1,
    basicSettings = {},
    enabled = false,
    speedFactor = DEFAULT_POI_PLAYBACK_SPEED_FACTOR,
    isPOIInVideoCrop = null,
} = {}) => {
    const routeDuration = Math.max(0, finiteNumber(replayDurationMillis) ?? 0)
    const routeDistance = Math.max(0, finiteNumber(totalDistance) ?? 0)
    const factor = clamp(finiteNumber(speedFactor) ?? DEFAULT_POI_PLAYBACK_SPEED_FACTOR, 0.1, 1)
    const behavior = normalizeReplayPOIBehavior(basicSettings)
    const poiEntries = Array.isArray(entries) ? entries : []
    const displayDuration = Math.max(0, behavior.poiAnimationDurationSeconds * 1000)
    const safeDirection = Number(direction) < 0 ? -1 : 1
    if (!enabled || !behavior.animatePoisDuringJourneyReplay || routeDuration <= 0
        || routeDistance <= 0 || displayDuration <= 0 || factor >= 1) {
        return createRouteOnlyProfile(routeDuration, safeDirection, factor)
    }

    const windows = poiEntries.flatMap(entry => {
        const poi = entry?.poi ?? entry
        if (!poi?.id) {
            return []
        }

        if (poi.tooClose === true || !isPOINearReplayRoute(entry)) {
            return []
        }

        if (!canAnimatePOIInReplay(entry, behavior)) {
            return []
        }

        const distance = finiteNumber(entry?.projectedAbscissa)
        if (distance === null) {
            return []
        }

        const poiProgress = clamp(distance / routeDistance, 0, 1)
        const centerMillis = clamp(distance / routeDistance, 0, 1) * routeDuration
        const windowDuration = Math.min(displayDuration, routeDuration)
        const chronologicalStart = clamp(centerMillis - windowDuration / 2, 0, routeDuration - windowDuration)
        const chronologicalEnd = chronologicalStart + windowDuration
        const cropProgressRadius = windowDuration / (2 * routeDuration)
        const cropProgressSamples = [
            clamp(poiProgress - cropProgressRadius, 0, 1),
            poiProgress,
            clamp(poiProgress + cropProgressRadius, 0, 1),
        ]
        const cropVisibilitySamples = typeof isPOIInVideoCrop === 'function'
            ? cropProgressSamples.map(progress => isPOIInVideoCrop(entry, progress))
            : []
        const inVideoCrop = cropVisibilitySamples.includes(true)
            ? true
            : cropVisibilitySamples.length > 0 && cropVisibilitySamples.every(value => value === false)
                ? false
                : entry.inVideoCrop
        if (inVideoCrop === false) {
            return []
        }

        const routeStartMillis = safeDirection < 0 ? routeDuration - chronologicalEnd : chronologicalStart
        const routeEndMillis = safeDirection < 0 ? routeDuration - chronologicalStart : chronologicalEnd
        const routeCenterMillis = safeDirection < 0 ? routeDuration - centerMillis : centerMillis
        return [{routeStartMillis, routeEndMillis, routeCenterMillis}]
    }).sort((left, right) => left.routeStartMillis - right.routeStartMillis)

    if (windows.length === 0) {
        return createRouteOnlyProfile(routeDuration, safeDirection, factor)
    }

    // Merge overlapping windows while retaining each POI's crawl zone.
    const mergedWindows = windows.reduce((merged, window) => {
        const previous = merged.at(-1)
        if (previous && window.routeStartMillis <= previous.routeEndMillis) {
            previous.routeEndMillis = Math.max(previous.routeEndMillis, window.routeEndMillis)
            previous.windows.push(window)
        }
        else {
            merged.push({...window, windows: [window]})
        }
        return merged
    }, [])

    let routeCursor = 0
    let playbackCursor = 0
    const segments = []
    /** Append one ordered route segment and advance its playback clock. */
    const appendSegment = (routeStartMillis, routeEndMillis, speed, metadata = {}) => {
        if (routeEndMillis <= routeStartMillis) {
            return
        }

        const playbackDuration = (routeEndMillis - routeStartMillis) / speed
        segments.push({
            routeStartMillis,
            routeEndMillis,
            playbackStartMillis: playbackCursor,
            playbackEndMillis: playbackCursor + playbackDuration,
            speedFactor: speed,
            ...metadata,
        })
        playbackCursor += playbackDuration
        routeCursor = routeEndMillis
    }

    mergedWindows.forEach(window => {
        appendSegment(routeCursor, window.routeStartMillis, 1)

        const breakpoints = new Set([window.routeStartMillis, window.routeEndMillis])
        const crawlSegments = window.windows.flatMap(({routeCenterMillis}) => (
            createPOICrawlSegments(routeCenterMillis, routeDuration)
        ))
        crawlSegments.forEach(({routeStartMillis, routeEndMillis}) => {
            breakpoints.add(routeStartMillis)
            breakpoints.add(routeEndMillis)
        })
        window.windows.forEach(poiWindow => {
            const {routeStartMillis, routeEndMillis, routeCenterMillis} = poiWindow
            const halfSteps = Math.max(1, POI_SPEED_RAMP_STEPS)
            for (let step = 0; step <= halfSteps; step += 1) {
                const fraction = step / halfSteps
                breakpoints.add(routeStartMillis + (routeCenterMillis - routeStartMillis) * fraction)
                breakpoints.add(routeCenterMillis + (routeEndMillis - routeCenterMillis) * fraction)
            }
        })

        const orderedBreakpoints = [...breakpoints].sort((left, right) => left - right)
        const speedAt = routeMillis => window.windows.reduce((slowest, poiWindow) => {
            const {routeStartMillis, routeEndMillis, routeCenterMillis} = poiWindow
            if (routeMillis < routeStartMillis || routeMillis > routeEndMillis) {
                return slowest
            }

            const rampProgress = routeMillis <= routeCenterMillis
                ? (routeMillis - routeStartMillis) / Math.max(1, routeCenterMillis - routeStartMillis)
                : (routeEndMillis - routeMillis) / Math.max(1, routeEndMillis - routeCenterMillis)
            const easedProgress = Math.sin(Math.PI * clamp(rampProgress, 0, 1) / 2)
            const poiSpeed = factor + (1 - factor) * (1 - easedProgress)
            return Math.min(slowest, poiSpeed)
        }, 1)

        orderedBreakpoints.forEach((point, index) => {
            if (index > 0) {
                const previousPoint = orderedBreakpoints[index - 1]
                const middlePoint = (previousPoint + point) / 2
                const crawlSegment = crawlSegments.find(segment => (
                    middlePoint >= segment.routeStartMillis && middlePoint < segment.routeEndMillis
                ))
                appendSegment(
                    previousPoint,
                    point,
                    crawlSegment?.speedFactor ?? speedAt(middlePoint),
                    crawlSegment ? {poiCrawl: true} : {},
                )
            }
        })
    })
    appendSegment(routeCursor, routeDuration, 1)

    return {
        routeDurationMillis: routeDuration,
        playbackDurationMillis: playbackCursor,
        direction: safeDirection,
        shouldSlowdown: windows.length > 0,
        speedFactor: factor,
        segments,
    }
}

/**
 * Convert Replay wall-clock milliseconds into route milliseconds.
 *
 * @param {object} profile - POI playback speed profile.
 * @param {number} playbackMillis - Elapsed video time.
 * @returns {number} Elapsed route time.
 */
export const replayRouteTimeAtPlaybackTime = (profile, playbackMillis) => {
    const playbackDuration = Math.max(0, finiteNumber(profile?.playbackDurationMillis) ?? 0)
    const routeDuration = Math.max(0, finiteNumber(profile?.routeDurationMillis) ?? 0)
    const playbackTime = clamp(finiteNumber(playbackMillis) ?? 0, 0, playbackDuration)
    const segment = profile?.segments?.find(item => playbackTime <= item.playbackEndMillis)
        ?? profile?.segments?.at(-1)

    if (!segment) {
        return playbackTime
    }

    const localPlayback = clamp(playbackTime - segment.playbackStartMillis, 0, segment.playbackEndMillis - segment.playbackStartMillis)
    return clamp(segment.routeStartMillis + localPlayback * segment.speedFactor, 0, routeDuration)
}

/** Return whether playback is inside the extreme crawl around a Replay POI. */
export const isReplayPOICrawlAtPlaybackTime = (profile, playbackMillis) => {
    const time = finiteNumber(playbackMillis)
    if (time === null) {
        return false
    }

    return profile?.segments?.some(segment => segment.poiCrawl === true
        && time >= segment.playbackStartMillis
        && time < segment.playbackEndMillis) === true
}

/**
 * Convert route milliseconds into Replay wall-clock milliseconds.
 *
 * @param {object} profile - POI playback speed profile.
 * @param {number} routeMillis - Elapsed route time.
 * @returns {number} Elapsed video time.
 */
export const replayPlaybackTimeAtRouteTime = (profile, routeMillis) => {
    const playbackDuration = Math.max(0, finiteNumber(profile?.playbackDurationMillis) ?? 0)
    const routeDuration = Math.max(0, finiteNumber(profile?.routeDurationMillis) ?? 0)
    const routeTime = clamp(finiteNumber(routeMillis) ?? 0, 0, routeDuration)
    const segment = profile?.segments?.find(item => routeTime <= item.routeEndMillis)
        ?? profile?.segments?.at(-1)

    if (!segment) {
        return routeTime
    }

    if (segment.speedFactor <= 0) {
        return clamp(segment.playbackStartMillis, 0, playbackDuration)
    }

    const localRoute = clamp(routeTime - segment.routeStartMillis, 0, segment.routeEndMillis - segment.routeStartMillis)
    return clamp(segment.playbackStartMillis + localRoute / segment.speedFactor, 0, playbackDuration)
}
