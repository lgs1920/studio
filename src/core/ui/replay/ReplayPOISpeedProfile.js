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
 * Last modified: 2026-10-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {isReplayPOIAnimationEndpoint, normalizeJourneyReplayPOISettings, normalizeReplayPOIBehavior} from './JourneyReplayPOISettings'

const DEFAULT_POI_PLAYBACK_SPEED_FACTOR = 0.5
const DEFAULT_POI_HOLD_DURATION_MILLIS = 1000
const POI_SPEED_RAMP_STEPS = 16

/** Convert input into a finite number or null. */
const finiteNumber = value => {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

/** Clamp a numeric value to an inclusive range. */
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value))

/**
 * Build a time-warp profile that slows around displayed POIs and holds at their closest point.
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
} = {}) => {
    const routeDuration = Math.max(0, finiteNumber(replayDurationMillis) ?? 0)
    const routeDistance = Math.max(0, finiteNumber(totalDistance) ?? 0)
    const factor = clamp(finiteNumber(speedFactor) ?? DEFAULT_POI_PLAYBACK_SPEED_FACTOR, 0.1, 1)
    const behavior = normalizeReplayPOIBehavior(basicSettings)
    const poiEntries = Array.isArray(entries) ? entries : []
    const displayDuration = Math.max(0, behavior.poiAnimationDurationSeconds * 1000)
    const safeDirection = Number(direction) < 0 ? -1 : 1
    const hasExpandedPOI = poiEntries.some(entry => {
        const poi = entry?.poi ?? entry
        return poi?.expanded === true && !isReplayPOIAnimationEndpoint(poi)
    })
    const shouldSlowdown = enabled && (behavior.animatePoisDuringJourneyReplay || hasExpandedPOI)

    if (!shouldSlowdown || routeDuration <= 0
        || routeDistance <= 0 || displayDuration <= 0 || factor >= 1) {
        return {
            routeDurationMillis: routeDuration,
            playbackDurationMillis: routeDuration,
            direction: safeDirection,
            shouldSlowdown: Boolean(shouldSlowdown),
            speedFactor: factor,
            segments: [{routeStartMillis: 0, routeEndMillis: routeDuration, playbackStartMillis: 0, playbackEndMillis: routeDuration, speedFactor: 1}],
        }
    }

    const windows = poiEntries.flatMap(entry => {
        const poi = entry?.poi ?? entry
        if (!poi?.id || isReplayPOIAnimationEndpoint(poi)) {
            return []
        }

        const poiSettings = normalizeJourneyReplayPOISettings(poi.replay)
        const willExpandDuringAnimation = behavior.animatePoisDuringJourneyReplay && poiSettings.animated !== false
        if (poi.expanded !== true && !willExpandDuringAnimation) {
            return []
        }

        if (behavior.poiVisibilityMode === 'user'
            && poiSettings.visible === false) {
            return []
        }

        const distance = finiteNumber(entry?.projectedAbscissa)
        if (distance === null) {
            return []
        }

        const centerMillis = clamp(distance / routeDistance, 0, 1) * routeDuration
        const windowDuration = Math.min(displayDuration, routeDuration)
        const chronologicalStart = clamp(centerMillis - windowDuration / 2, 0, routeDuration - windowDuration)
        const chronologicalEnd = chronologicalStart + windowDuration
        const routeStartMillis = safeDirection < 0 ? routeDuration - chronologicalEnd : chronologicalStart
        const routeEndMillis = safeDirection < 0 ? routeDuration - chronologicalStart : chronologicalEnd
        const routeCenterMillis = safeDirection < 0 ? routeDuration - centerMillis : centerMillis
        return [{routeStartMillis, routeEndMillis, routeCenterMillis}]
    }).sort((left, right) => left.routeStartMillis - right.routeStartMillis)

    // Merge overlapping windows while retaining each POI's center and one-second hold.
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
    const appendSegment = (routeStartMillis, routeEndMillis, speed) => {
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
        })
        playbackCursor += playbackDuration
        routeCursor = routeEndMillis
    }

    /** Append a one-second wall-clock hold without advancing route progress. */
    const appendPOIHold = routeMillis => {
        segments.push({
            routeStartMillis: routeMillis,
            routeEndMillis: routeMillis,
            playbackStartMillis: playbackCursor,
            playbackEndMillis: playbackCursor + DEFAULT_POI_HOLD_DURATION_MILLIS,
            speedFactor: 0,
            poiHold: true,
        })
        playbackCursor += DEFAULT_POI_HOLD_DURATION_MILLIS
        routeCursor = routeMillis
    }

    mergedWindows.forEach(window => {
        appendSegment(routeCursor, window.routeStartMillis, 1)

        const breakpoints = new Set([window.routeStartMillis, window.routeEndMillis])
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
        const holdCenters = [...new Set(window.windows.map(poiWindow => poiWindow.routeCenterMillis))]
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
                appendSegment(previousPoint, point, speedAt((previousPoint + point) / 2))
            }
            if (holdCenters.includes(point)) {
                appendPOIHold(point)
            }
        })
    })
    appendSegment(routeCursor, routeDuration, 1)

    return {
        routeDurationMillis: routeDuration,
        playbackDurationMillis: playbackCursor,
        direction: safeDirection,
        shouldSlowdown: Boolean(shouldSlowdown),
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

    if (segment.poiHold || segment.speedFactor <= 0) {
        return clamp(segment.playbackStartMillis, 0, playbackDuration)
    }

    const localRoute = clamp(routeTime - segment.routeStartMillis, 0, segment.routeEndMillis - segment.routeStartMillis)
    return clamp(segment.playbackStartMillis + localRoute / segment.speedFactor, 0, playbackDuration)
}
