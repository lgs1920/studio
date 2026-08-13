/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayPathSampler.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-04
 * Last modified: 2026-05-04
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {logicalCoordinateSegmentsFromTrack, logicalTrackPathFromJourney} from './JourneyReplayLogicalTrackPath'
import { JourneyReplayTurfPath } from './JourneyReplayTurfPath'

const LINE_STRING = 'LineString'
const MULTI_LINE_STRING = 'MultiLineString'
export const REPLAY_SCOPE_VISIBLE_TRACKS = 'visible-tracks'
export const REPLAY_SCOPE_CURRENT_TRACK = 'current-track'
export const REPLAY_SCOPE_ALL_TRACKS = 'all-tracks'

const finiteNumber = value => {
    if (value === null || value === undefined || value === '') {
        return null
    }

    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const parseTimeMillis = value => {
    if (!value) {
        return null
    }

    const millis = Date.parse(value)
    return Number.isFinite(millis) ? millis : null
}

const isoTime = millis => Number.isFinite(millis) ? new Date(millis).toISOString() : null

const rawCoordinateSegmentsCache = new WeakMap()
const timeSegmentsCache = new WeakMap()
const metricBreakpointsCache = new WeakMap()
const segmentTurfPathCache = new WeakMap()

const getWeakMapBucket = (cache, key) => {
    if (!key || (typeof key !== 'object' && typeof key !== 'function')) {
        return null
    }

    let bucket = cache.get(key)
    if (!bucket) {
        bucket = new Map()
        cache.set(key, bucket)
    }

    return bucket
}

const pointFromCoordinate = (coordinate) => {
    if (!coordinate) {
        return null
    }

    const longitude = finiteNumber(Array.isArray(coordinate) ? coordinate[0] : coordinate.longitude)
    const latitude = finiteNumber(Array.isArray(coordinate) ? coordinate[1] : coordinate.latitude)

    if (longitude === null || latitude === null) {
        return null
    }

    const altitude = finiteNumber(
        Array.isArray(coordinate)
        ? coordinate[2]
        : coordinate.altitude ?? coordinate.height ?? coordinate.simulatedHeight,
    ) ?? 0

    return {
        longitude,
        latitude,
        altitude,
        height: altitude,
    }
}

const sampleReference = sample => sample ? {
    progress:          sample.progress,
    distanceFromStart: sample.distanceFromStart,
    remainingDistance: sample.remainingDistance,
    time:              sample.time,
    timeMillis:        sample.timeMillis,
    journeyElapsedMillis: sample.journeyElapsedMillis,
    journeyDurationMillis: sample.journeyDurationMillis,
    trackSlug:         sample.trackSlug,
    trackIndex:        sample.trackIndex,
    pointIndex:        sample.pointIndex,
    segmentIndex:      sample.segmentIndex,
    segmentRatio:      sample.segmentRatio,
    longitude:         sample.longitude,
    latitude:          sample.latitude,
    altitude:          sample.altitude,
    height:            sample.height,
    interpolated:      sample.interpolated,
} : null

const sampleSource = source => source ? {
    startPoint: sampleReference(source.startPoint),
    endPoint:   sampleReference(source.endPoint),
} : undefined

const cloneSample = sample => sample ? {
    ...sampleReference(sample),
    source: sampleSource(sample.source),
} : null

const interpolateValue = (start, end, ratio) => start + ((end - start) * ratio)

/**
 * Resolve the shortest signed angular delta between two headings.
 *
 * @param {number} start - Start heading in radians.
 * @param {number} end - End heading in radians.
 * @returns {number} Shortest signed delta in radians.
 */
const angularDelta = (start, end) => {
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
        return null
    }

    const fullTurn = Math.PI * 2
    return ((end - start + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI
}

/**
 * Resolve a local geodesic heading between two replay samples.
 *
 * @param {object|null} start - Start sample.
 * @param {object|null} end - End sample.
 * @returns {number|null} Heading in radians, clockwise from north.
 */
const headingBetweenSamples = (start, end) => {
    const startLongitude = finiteNumber(start?.longitude)
    const startLatitude = finiteNumber(start?.latitude)
    const endLongitude = finiteNumber(end?.longitude)
    const endLatitude = finiteNumber(end?.latitude)
    if ([startLongitude, startLatitude, endLongitude, endLatitude].some(value => value === null)) {
        return null
    }

    const radians = Math.PI / 180
    let longitudeDelta = (endLongitude - startLongitude) * radians
    while (longitudeDelta > Math.PI) {
        longitudeDelta -= Math.PI * 2
    }
    while (longitudeDelta < -Math.PI) {
        longitudeDelta += Math.PI * 2
    }
    const latitudeStart = startLatitude * radians
    const latitudeEnd = endLatitude * radians
    const east = longitudeDelta * Math.cos((latitudeStart + latitudeEnd) / 2)
    const north = (endLatitude - startLatitude) * radians
    if (Math.hypot(east, north) <= Number.EPSILON) {
        return null
    }

    return Math.atan2(east, north)
}

/**
 * Project a geographic sample into a local east/north metric frame.
 *
 * @param {Object} origin - Projection origin.
 * @param {Object} sample - Geographic sample to project.
 * @returns {{x: number, y: number}|null} Local metric coordinates.
 */
const projectToLocalMeters = (origin, sample) => {
    const originLongitude = finiteNumber(origin?.longitude)
    const originLatitude = finiteNumber(origin?.latitude)
    const longitude = finiteNumber(sample?.longitude)
    const latitude = finiteNumber(sample?.latitude)
    if ([originLongitude, originLatitude, longitude, latitude].some(value => value === null)) {
        return null
    }

    const radians = Math.PI / 180
    const earthRadiusMeters = 6_371_008.8
    const latitudeScale = Math.cos(originLatitude * radians)
    return {
        x: (longitude - originLongitude) * radians * earthRadiusMeters * latitudeScale,
        y: (latitude - originLatitude) * radians * earthRadiusMeters,
    }
}

/**
 * Resolve a stable path heading from a spatial window using the beta.2 PCA
 * method, oriented by the future route chord to preserve turn anticipation.
 *
 * @param {Object[]} samples - Ordered samples in the spatial window.
 * @param {Object} current - Current replay sample.
 * @param {Object} future - Future replay sample.
 * @returns {number|null} Stable heading in radians.
 */
const headingFromWindowSamples = (samples, current, future) => {
    if (!Array.isArray(samples) || samples.length < 2) {
        return headingBetweenSamples(current, future)
    }

    const origin = samples[Math.floor(samples.length / 2)] ?? current
    const localPoints = samples
        .map(sample => projectToLocalMeters(origin, sample))
        .filter(Boolean)
    if (localPoints.length < 2) {
        return headingBetweenSamples(current, future)
    }

    const meanX = localPoints.reduce((sum, point) => sum + point.x, 0) / localPoints.length
    const meanY = localPoints.reduce((sum, point) => sum + point.y, 0) / localPoints.length
    let covarianceXX = 0
    let covarianceXY = 0
    let covarianceYY = 0
    localPoints.forEach(point => {
        const deltaX = point.x - meanX
        const deltaY = point.y - meanY
        covarianceXX += deltaX * deltaX
        covarianceXY += deltaX * deltaY
        covarianceYY += deltaY * deltaY
    })

    if (covarianceXX + covarianceYY <= Number.EPSILON) {
        return headingBetweenSamples(current, future)
    }

    const axisAngle = 0.5 * Math.atan2(
        2 * covarianceXY,
        covarianceXX - covarianceYY,
    )
    let heading = Math.atan2(Math.cos(axisAngle), Math.sin(axisAngle))
    const futureHeading = headingBetweenSamples(current, future)
    const orientationDelta = angularDelta(heading, futureHeading)
    if (orientationDelta !== null && Math.abs(orientationDelta) > (Math.PI / 2)) {
        heading += Math.PI
    }

    return heading
}

const interpolateNullableValue = (start, end, ratio) => {
    const startValue = finiteNumber(start)
    const endValue = finiteNumber(end)

    if (startValue === null || endValue === null) {
        return startValue ?? endValue
    }

    return interpolateValue(startValue, endValue, ratio)
}

const interpolateSample = (start, end, targetDistance, totalDistance) => {
    const distance = end.distanceFromStart - start.distanceFromStart
    const segmentRatio = distance > 0 ? clamp((targetDistance - start.distanceFromStart) / distance, 0, 1) : 0
    const altitude = interpolateValue(start.altitude ?? 0, end.altitude ?? 0, segmentRatio)
    const timeMillis = interpolateNullableValue(start.timeMillis, end.timeMillis, segmentRatio)

    return {
        progress: totalDistance > 0 ? clamp(targetDistance / totalDistance, 0, 1) : 0,
        distanceFromStart: targetDistance,
        remainingDistance: Math.max(0, totalDistance - targetDistance),
        time: isoTime(timeMillis),
        timeMillis,
        journeyElapsedMillis: interpolateNullableValue(start.journeyElapsedMillis, end.journeyElapsedMillis, segmentRatio),
        journeyDurationMillis: start.journeyDurationMillis ?? end.journeyDurationMillis ?? null,
        trackSlug: end.trackSlug,
        trackIndex: end.trackIndex,
        pointIndex: end.pointIndex,
        segmentIndex: end.segmentIndex,
        segmentRatio,
        longitude: interpolateValue(start.longitude, end.longitude, segmentRatio),
        latitude: interpolateValue(start.latitude, end.latitude, segmentRatio),
        altitude,
        height: altitude,
        cumulativeElevationGain: interpolateNullableValue(
            start.cumulativeElevationGain,
            end.cumulativeElevationGain,
            segmentRatio,
        ) ?? 0,
        interpolated: true,
        source: {
            startPoint: sampleReference(start),
            endPoint:   sampleReference(end),
        },
    }
}

export class JourneyReplayPathSampler {
    #journey = null
    #scope = REPLAY_SCOPE_VISIBLE_TRACKS
    #trackSlug = null
    #includeHiddenTracks = false
    #forceRenderSmoothing = false
    #renderSmoothing = undefined
    #samples = []
    #segments = []
    #totalDistance = 0
    #startTimeMillis = null
    #endTimeMillis = null
    #durationMillis = null

    constructor(options = {}) {
        this.update(options)
    }

    update = ({
                  journey = this.#journey,
                  scope = this.#scope,
                  trackSlug = this.#trackSlug,
                  includeHiddenTracks = this.#includeHiddenTracks,
                  forceRenderSmoothing = this.#forceRenderSmoothing,
                  renderSmoothing = this.#renderSmoothing,
              } = {}) => {
        this.#journey = journey
        this.#scope = scope
        this.#trackSlug = trackSlug
        this.#includeHiddenTracks = includeHiddenTracks
        this.#forceRenderSmoothing = forceRenderSmoothing === true
        this.#renderSmoothing = renderSmoothing
        this.#build()
        return this
    }

    get journey() {
        return this.#journey
    }

    get scope() {
        return this.#scope
    }

    get trackSlug() {
        return this.#trackSlug
    }

    get samples() {
        return this.#samples
    }

    get segments() {
        return this.#segments
    }

    get totalDistance() {
        return this.#totalDistance
    }

    get startTimeMillis() {
        return this.#startTimeMillis
    }

    get endTimeMillis() {
        return this.#endTimeMillis
    }

    get durationMillis() {
        return this.#durationMillis
    }

    get hasSamples() {
        return this.#samples.length > 0
    }

    /**
     * Return the renderer-independent path used by the replay sampler.
     *
     * @returns {Array<Object>} Logical track path entries.
     */
    get logicalTrackPath() {
        return logicalTrackPathFromJourney(this.#journey, {
            scope:               this.#scope,
            trackSlug:           this.#trackSlug,
            includeHiddenTracks: this.#includeHiddenTracks,
            forceRenderSmoothing: this.#forceRenderSmoothing,
            renderSmoothing:      this.#renderSmoothing,
        })
    }

    #selectedTracks = () => {
        const tracks = Array.from(this.#journey?.tracks?.values?.() ?? [])
            .map((track, index) => ({track, index}))

        if (this.#scope === REPLAY_SCOPE_ALL_TRACKS) {
            return tracks
        }

        if (this.#scope === REPLAY_SCOPE_CURRENT_TRACK) {
            const currentTrackSlug = this.#trackSlug ?? globalThis.lgs?.theTrack?.slug
            const current = tracks.filter(({track}) => track?.slug === currentTrackSlug)
            if (current.length > 0) {
                return current
            }
        }

        return tracks.filter(({track}) => this.#includeHiddenTracks || track?.visible !== false)
    }

    #build = () => {
        this.#samples = []
        this.#segments = []
        this.#totalDistance = 0
        this.#startTimeMillis = null
        this.#endTimeMillis = null
        this.#durationMillis = null

        if (!this.#journey?.tracks) {
            return
        }

        const selectedTracks = this.#selectedTracks()
        let cumulativeDistance = 0
        const metricTimeBreakpoints = []

        selectedTracks.forEach(({track, index: trackIndex}) => {
            const trackStartDistance = cumulativeDistance
            const coordinateSegments = JourneyReplayPathSampler.coordinateSegmentsFromTrack(track, {
                forceRenderSmoothing: this.#forceRenderSmoothing,
                renderSmoothing:      this.#renderSmoothing,
            })
            const timeSegments = JourneyReplayPathSampler.timeSegmentsFromTrack(track)

            coordinateSegments.forEach((coordinates, segmentIndex) => {
                const points = coordinates.map(pointFromCoordinate).filter(Boolean)
                if (points.length < 2) {
                    return
                }

                const turfPath = new JourneyReplayTurfPath(points.map(point => [point.longitude, point.latitude, point.altitude]))
                if (!turfPath.isValid) {
                    return
                }

                JourneyReplayPathSampler.assignSegmentTimes(points, timeSegments[segmentIndex])

                const startIndex = this.#samples.length
                const startDistance = cumulativeDistance

                points.forEach((point, pointIndex) => {
                    const segmentDistance = pointIndex > 0
                        ? turfPath.cumulativeDistances[pointIndex] - turfPath.cumulativeDistances[pointIndex - 1]
                        : 0

                    if (pointIndex > 0) {
                        cumulativeDistance += segmentDistance
                    }

                    const sample = {
                        progress: 0,
                        distanceFromStart: cumulativeDistance,
                        remainingDistance: 0,
                        time: point.time,
                        timeMillis: point.timeMillis,
                        journeyElapsedMillis: null,
                        journeyDurationMillis: null,
                        trackSlug: track.slug,
                        trackIndex,
                        pointIndex,
                        segmentIndex,
                        segmentRatio: pointIndex === 0 ? 0 : 1,
                        longitude: point.longitude,
                        latitude: point.latitude,
                        altitude: point.altitude,
                        height: point.altitude,
                        interpolated: false,
                        source: {
                            startPoint: null,
                            endPoint:   null,
                        },
                    }

                    this.#samples.push(sample)
                })

                const segment = {
                    key: `${track.slug}:${segmentIndex}`,
                    trackSlug: track.slug,
                    trackIndex,
                    segmentIndex,
                    startIndex,
                    endIndex: this.#samples.length - 1,
                    startDistance,
                    endDistance: cumulativeDistance,
                }
                segmentTurfPathCache.set(segment, turfPath)
                this.#segments.push(segment)
            })

            const elevationBreakpoints = JourneyReplayPathSampler.cumulativeElevationBreakpointsFromTrack(
                track,
                trackStartDistance,
                cumulativeDistance,
            )

            for (let index = this.#samples.length - 1; index >= 0; index--) {
                const sample = this.#samples[index]
                if (sample.trackSlug !== track.slug) {
                    break
                }
                sample.cumulativeElevationGain = JourneyReplayPathSampler.valueAtDistance(
                    elevationBreakpoints,
                    sample.distanceFromStart,
                ) ?? 0
            }

            metricTimeBreakpoints.push(
                ...JourneyReplayPathSampler.metricTimeBreakpointsFromTrack(track, trackStartDistance, cumulativeDistance),
            )
        })

        this.#totalDistance = cumulativeDistance
        this.#resolveJourneyTime(metricTimeBreakpoints)
        this.#samples.forEach((sample, index) => {
            sample.progress = this.#totalDistance > 0
                              ? clamp(sample.distanceFromStart / this.#totalDistance, 0, 1)
                              : (this.#samples.length > 1 ? index / (this.#samples.length - 1) : 0)
            sample.remainingDistance = Math.max(0, this.#totalDistance - sample.distanceFromStart)
        })

        this.#samples.forEach((sample, index) => {
            const previous = this.#samples[index - 1]
            const next = this.#samples[index + 1]
            const sameSegment = candidate => candidate?.trackSlug === sample.trackSlug
                && candidate?.segmentIndex === sample.segmentIndex
            sample.source = {
                startPoint: sameSegment(previous) ? sampleReference(previous) : null,
                endPoint:   sameSegment(next) ? sampleReference(next) : null,
            }
        })
    }

    #resolveJourneyTime = (fallbackBreakpoints = []) => {
        const sampleBreakpoints = this.#samples
            .filter(sample => Number.isFinite(sample.timeMillis))
            .map(sample => ({
                distance:   sample.distanceFromStart,
                timeMillis: sample.timeMillis,
            }))
        const breakpoints = sampleBreakpoints.length >= 2
                            ? sampleBreakpoints
                            : fallbackBreakpoints.filter(point => Number.isFinite(point.distance) && Number.isFinite(point.timeMillis))

        if (breakpoints.length < 2) {
            return
        }

        this.#startTimeMillis = breakpoints[0].timeMillis
        this.#endTimeMillis = breakpoints[breakpoints.length - 1].timeMillis
        const durationMillis = Math.abs(this.#endTimeMillis - this.#startTimeMillis)
        if (!Number.isFinite(durationMillis) || durationMillis <= 0) {
            this.#startTimeMillis = null
            this.#endTimeMillis = null
            return
        }

        this.#durationMillis = durationMillis
        this.#samples.forEach(sample => {
            const timeMillis = JourneyReplayPathSampler.timeAtDistance(breakpoints, sample.distanceFromStart)
            if (!Number.isFinite(timeMillis)) {
                return
            }

            sample.timeMillis = timeMillis
            sample.time = isoTime(timeMillis)
            sample.journeyElapsedMillis = clamp(Math.abs(sample.timeMillis - this.#startTimeMillis), 0, durationMillis)
            sample.journeyDurationMillis = durationMillis
        })
    }

    atProgress = (progress = 0) => {
        const safeProgress = clamp(Number(progress) || 0, 0, 1)
        return this.atDistance(this.#totalDistance * safeProgress)
    }

    /**
     * Resolve a metric lookahead sample from replay progress.
     *
     * The lookahead is derived from the local route speed and replay time,
     * then clamped to a deterministic minimum and the route end. This keeps
     * prediction independent from render cadence and from guide-point density.
     *
     * @param {number} progress - Normalized replay progress.
     * @param {object} options - Lookahead configuration.
     * @param {number} [options.seconds=1] - Prediction horizon in seconds.
     * @param {number} [options.minimumMeters=120] - Minimum metric horizon.
     * @returns {Object|null} Predicted replay sample.
     */
    lookaheadAtProgress = (progress = 0, {seconds = 1, minimumMeters = 120} = {}) => {
        const anchor = this.atProgress(progress)
        if (!anchor || this.#samples.length < 2 || this.#totalDistance <= 0) {
            return anchor
        }

        const safeSeconds = Math.max(0, finiteNumber(seconds) ?? 0)
        const safeMinimumMeters = Math.max(0, finiteNumber(minimumMeters) ?? 0)
        const anchorDistance = anchor.distanceFromStart
        const speedProbeMeters = Math.min(
            Math.max(20, safeMinimumMeters),
            Math.max(0, this.#totalDistance - anchorDistance),
        )
        const probeDistance = Math.min(this.#totalDistance, anchorDistance + speedProbeMeters)
        const probe = this.atDistance(probeDistance)
        const timeDeltaSeconds = Number.isFinite(anchor.timeMillis)
                                 && Number.isFinite(probe?.timeMillis)
                                 && probe.timeMillis > anchor.timeMillis
            ? (probe.timeMillis - anchor.timeMillis) / 1000
            : 0
        const localSpeed = timeDeltaSeconds > 0
            ? Math.max(0, (probeDistance - anchorDistance) / timeDeltaSeconds)
            : 0
        const predictedDistance = anchorDistance + Math.max(
            safeMinimumMeters,
            localSpeed * safeSeconds,
        )

        return this.atDistance(Math.min(this.#totalDistance, predictedDistance))
    }

    /**
     * Resolve a stable route heading from a Turf metric window at replay progress.
     *
     * @param {number} progress - Normalized replay progress.
     * @param {object} options - Heading prediction options.
     * @param {number} [options.lookaheadSeconds=0] - Future tangent horizon.
     * @param {number} [options.windowSeconds=0] - Chord window used to anticipate turns.
     * @param {number} [options.minimumMeters=120] - Minimum local heading distance.
     * @returns {number} Heading in radians, clockwise from north.
     */
    headingAtProgress = (progress = 0, {
        lookaheadSeconds = 0,
        windowSeconds = 0,
        minimumMeters = 120,
    } = {}) => {
        const safeLookaheadSeconds = Math.max(0, finiteNumber(lookaheadSeconds) ?? 0)
        const safeWindowSeconds = Math.max(0, finiteNumber(windowSeconds) ?? 0)
        const safeMinimumMeters = Math.max(0, finiteNumber(minimumMeters) ?? 120)
        const anchor = this.atProgress(progress)
        if (!anchor) {
            return 0
        }

        if (safeLookaheadSeconds <= 0) {
            const segment = this.#segmentForDistance(anchor.distanceFromStart)
            const turfPath = segment ? segmentTurfPathCache.get(segment) : null
            const tangentDistance = segment
                ? anchor.distanceFromStart - segment.startDistance
                : 0
            const tangent = turfPath?.tangentAtDistance(tangentDistance)
            return Number.isFinite(tangent?.bearingDegrees)
                ? tangent.bearingDegrees * (Math.PI / 180)
                : 0
        }

        const future = this.lookaheadAtProgress(progress, {
            seconds:       safeLookaheadSeconds,
            minimumMeters: safeMinimumMeters,
        })
        if (!future) {
            return 0
        }

        // beta.2 used a 400 m spatial window. Keep the horizon metric and
        // deterministic, while allowing callers to request a smaller window
        // for short synthetic paths and tests.
        const futureDistance = Math.max(
            safeMinimumMeters,
            (future.distanceFromStart ?? 0) - (anchor.distanceFromStart ?? 0),
        )
        const pastWindowRatio = safeLookaheadSeconds > 0 && safeWindowSeconds > 0
            ? clamp(safeWindowSeconds / safeLookaheadSeconds, 0.5, 1)
            : 1
        const pastDistance = Math.max(
            0,
            (anchor.distanceFromStart ?? 0) - (futureDistance * pastWindowRatio),
        )
        const sampleCount = 9
        const windowSamples = Array.from({length: sampleCount}, (_, index) => {
            const ratio = index / (sampleCount - 1)
            return this.atDistance(
                pastDistance + ((future.distanceFromStart - pastDistance) * ratio),
            )
        }).filter(Boolean)
        const stableHeading = headingFromWindowSamples(windowSamples, anchor, future)
        if (stableHeading !== null) {
            return stableHeading
        }

        return headingBetweenSamples(anchor, future) ?? 0
    }

    atDistance = (distance = 0) => {
        if (this.#samples.length === 0) {
            return null
        }

        if (this.#samples.length === 1 || this.#totalDistance <= 0) {
            return cloneSample(this.#samples[0])
        }

        const targetDistance = clamp(Number(distance) || 0, 0, this.#totalDistance)
        if (targetDistance <= 0) {
            return cloneSample(this.#samples[0])
        }
        if (targetDistance >= this.#totalDistance) {
            return cloneSample(this.#samples[this.#samples.length - 1])
        }

        let low = 0
        let high = this.#samples.length - 1
        while (low < high) {
            const mid = Math.floor((low + high) / 2)
            if (this.#samples[mid].distanceFromStart < targetDistance) {
                low = mid + 1
            }
            else {
                high = mid
            }
        }

        const end = this.#samples[low]
        const start = this.#samples[Math.max(0, low - 1)]

        if (!start || start === end || end.distanceFromStart === start.distanceFromStart) {
            return cloneSample(end)
        }

        return interpolateSample(start, end, targetDistance, this.#totalDistance)
    }

    #segmentForDistance = distance => this.#segments.find(segment => (
        distance >= segment.startDistance && distance <= segment.endDistance
    )) ?? this.#segments.at(-1)

    nearestToLonLat = (coordinates) => {
        const point = pointFromCoordinate(coordinates)
        if (!point || this.#samples.length === 0) {
            return null
        }

        let nearest = null
        let nearestDistance = Infinity

        this.#samples.forEach(sample => {
            const distance = JourneyReplayTurfPath.distanceBetween(
                [point.longitude, point.latitude, point.altitude],
                [sample.longitude, sample.latitude, sample.altitude],
            )
            if (distance < nearestDistance) {
                nearestDistance = distance
                nearest = sample
            }
        })

        return nearest ? {
            ...cloneSample(nearest),
            pointerDistance: nearestDistance,
        } : null
    }

    completedSegmentsAt = (sampleOrProgress) => {
        const sample = typeof sampleOrProgress === 'number' ? this.atProgress(sampleOrProgress) : sampleOrProgress
        if (!sample || this.#segments.length === 0) {
            return []
        }

        const targetDistance = clamp(sample.distanceFromStart, 0, this.#totalDistance)

        return this.#segments
            .map(segment => this.#completedSegment(segment, targetDistance))
            .filter(segment => segment.coordinates.length >= 2)
    }

    remainingSegmentsAt = (sampleOrProgress) => {
        const sample = typeof sampleOrProgress === 'number' ? this.atProgress(sampleOrProgress) : sampleOrProgress
        if (!sample || this.#segments.length === 0) {
            return []
        }

        const targetDistance = clamp(sample.distanceFromStart, 0, this.#totalDistance)

        return this.#segments
            .map(segment => this.#remainingSegment(segment, targetDistance))
            .filter(segment => segment.coordinates.length >= 2)
    }

    #completedSegment = (segment, targetDistance) => {
        const coordinates = []
        if (targetDistance < segment.startDistance) {
            return {...segment, coordinates}
        }

        const segmentSamples = this.#samples.slice(segment.startIndex, segment.endIndex + 1)
        segmentSamples.forEach(sample => {
            if (sample.distanceFromStart <= targetDistance) {
                coordinates.push(JourneyReplayPathSampler.sampleCoordinates(sample))
            }
        })

        if (targetDistance < segment.endDistance) {
            const interpolated = this.#interpolateInSegment(segmentSamples, targetDistance)
            const last = coordinates[coordinates.length - 1]
            const next = JourneyReplayPathSampler.sampleCoordinates(interpolated)
            if (!last || last[0] !== next[0] || last[1] !== next[1] || last[2] !== next[2]) {
                coordinates.push(next)
            }
        }

        return {...segment, coordinates}
    }

    #remainingSegment = (segment, targetDistance) => {
        const coordinates = []
        if (targetDistance > segment.endDistance) {
            return {...segment, coordinates}
        }

        const segmentSamples = this.#samples.slice(segment.startIndex, segment.endIndex + 1)

        if (targetDistance > segment.startDistance) {
            coordinates.push(JourneyReplayPathSampler.sampleCoordinates(this.#interpolateInSegment(segmentSamples, targetDistance)))
        }

        segmentSamples.forEach(sample => {
            if (sample.distanceFromStart >= targetDistance) {
                const next = JourneyReplayPathSampler.sampleCoordinates(sample)
                const last = coordinates[coordinates.length - 1]
                if (!last || last[0] !== next[0] || last[1] !== next[1] || last[2] !== next[2]) {
                    coordinates.push(next)
                }
            }
        })

        return {...segment, coordinates}
    }

    #interpolateInSegment = (segmentSamples, targetDistance) => {
        for (let index = 1; index < segmentSamples.length; index++) {
            const start = segmentSamples[index - 1]
            const end = segmentSamples[index]
            if (targetDistance <= end.distanceFromStart) {
                if (end.distanceFromStart === start.distanceFromStart) {
                    return cloneSample(end)
                }

                const sample = interpolateSample(start, end, targetDistance, this.#totalDistance)
                const segment = this.#segments.find(candidate => candidate.startIndex <= this.#samples.indexOf(start)
                    && candidate.endIndex >= this.#samples.indexOf(end))
                const turfPath = segment ? segmentTurfPathCache.get(segment) : null
                if (!turfPath) {
                    return sample
                }

                const position = turfPath.positionAtDistance(targetDistance - (segment.startDistance ?? 0))
                return {
                    ...sample,
                    longitude: position.longitude,
                    latitude: position.latitude,
                    altitude: position.altitude,
                    height: position.altitude,
                }
            }
        }

        return cloneSample(segmentSamples[segmentSamples.length - 1])
    }

    static sampleCoordinates = sample => [
        sample.longitude,
        sample.latitude,
        sample.altitude ?? sample.height ?? 0,
    ]

    static rawCoordinateSegmentsFromTrack = (track) => {
        const geometry = track?.content?.geometry
        if (!geometry) {
            return []
        }

        const cachedSegments = rawCoordinateSegmentsCache.get(track?.content)
        if (cachedSegments) {
            return cachedSegments
        }

        let segments = []
        if (geometry.type === LINE_STRING && Array.isArray(geometry.coordinates)) {
            segments = [geometry.coordinates]
        }
        else if (geometry.type === MULTI_LINE_STRING && Array.isArray(geometry.coordinates)) {
            segments = geometry.coordinates.filter(Array.isArray)
        }

        rawCoordinateSegmentsCache.set(track.content, segments)
        return segments
    }

    static coordinateSegmentsFromTrack = (track, options = {}) => {
        return logicalCoordinateSegmentsFromTrack(track, options)
    }

    static timeSegmentsFromTrack = (track) => {
        const cacheKey = track?.content
        const cachedSegments = timeSegmentsCache.get(cacheKey)
        if (cachedSegments) {
            return cachedSegments
        }

        const rawSegments = JourneyReplayPathSampler.rawCoordinateSegmentsFromTrack(track)
        const geometryType = track?.content?.geometry?.type
        const times = track?.content?.properties?.coordinateProperties?.times
        let timeCursor = 0

        const segments = rawSegments.map((coordinates, index) => {
            let segmentTimes = []

            if (geometryType === LINE_STRING && Array.isArray(times)) {
                segmentTimes = times
            }
            else if (Array.isArray(times?.[index])) {
                segmentTimes = times[index]
            }
            else if (Array.isArray(times)) {
                segmentTimes = times.slice(timeCursor, timeCursor + coordinates.length)
            }

            timeCursor += coordinates.length

            return {
                coordinates,
                times: segmentTimes,
            }
        })

        if (cacheKey) {
            timeSegmentsCache.set(cacheKey, segments)
        }

        return segments
    }

    static timeBreakpointsFromSegment = (segment) => {
        const coordinates = Array.isArray(segment?.coordinates) ? segment.coordinates : []
        const times = Array.isArray(segment?.times) ? segment.times : []
        const points = coordinates
            .map((coordinate, index) => ({
                point:      pointFromCoordinate(coordinate),
                timeMillis: parseTimeMillis(times[index]),
            }))
            .filter(item => item.point)

        if (points.length < 2) {
            return []
        }

        let distance = 0
        points.forEach((item, index) => {
            if (index > 0) {
                distance += JourneyReplayTurfPath.distanceBetween(
                    [points[index - 1].point.longitude, points[index - 1].point.latitude],
                    [item.point.longitude, item.point.latitude],
                )
            }
            item.distance = distance
        })

        return points
            .map((item, index) => ({
                ratio:      distance > 0 ? clamp(item.distance / distance, 0, 1) : (points.length > 1 ? index / (points.length - 1) : 0),
                timeMillis: item.timeMillis,
            }))
            .filter(item => Number.isFinite(item.timeMillis))
    }

    static timeAtRatio = (breakpoints, ratio) => {
        if (!Array.isArray(breakpoints) || breakpoints.length === 0) {
            return null
        }

        const safeRatio = clamp(Number(ratio) || 0, 0, 1)
        if (safeRatio <= breakpoints[0].ratio) {
            return breakpoints[0].timeMillis
        }
        if (safeRatio >= breakpoints[breakpoints.length - 1].ratio) {
            return breakpoints[breakpoints.length - 1].timeMillis
        }

        for (let index = 1; index < breakpoints.length; index++) {
            const start = breakpoints[index - 1]
            const end = breakpoints[index]
            if (safeRatio <= end.ratio) {
                const span = end.ratio - start.ratio
                const segmentRatio = span > 0 ? clamp((safeRatio - start.ratio) / span, 0, 1) : 0
                return interpolateValue(start.timeMillis, end.timeMillis, segmentRatio)
            }
        }

        return breakpoints[breakpoints.length - 1].timeMillis
    }

    static timeAtDistance = (breakpoints, distance) => {
        if (!Array.isArray(breakpoints) || breakpoints.length === 0) {
            return null
        }

        const targetDistance = Number(distance) || 0
        if (targetDistance <= breakpoints[0].distance) {
            return breakpoints[0].timeMillis
        }
        if (targetDistance >= breakpoints[breakpoints.length - 1].distance) {
            return breakpoints[breakpoints.length - 1].timeMillis
        }

        for (let index = 1; index < breakpoints.length; index++) {
            const start = breakpoints[index - 1]
            const end = breakpoints[index]
            if (targetDistance <= end.distance) {
                const span = end.distance - start.distance
                const segmentRatio = span > 0 ? clamp((targetDistance - start.distance) / span, 0, 1) : 0
                return interpolateValue(start.timeMillis, end.timeMillis, segmentRatio)
            }
        }

        return breakpoints[breakpoints.length - 1].timeMillis
    }

    static valueAtDistance = (breakpoints, distance) => {
        if (!Array.isArray(breakpoints) || breakpoints.length === 0) {
            return null
        }

        const targetDistance = Number(distance) || 0
        if (targetDistance <= breakpoints[0].distance) {
            return breakpoints[0].value
        }
        if (targetDistance >= breakpoints[breakpoints.length - 1].distance) {
            return breakpoints[breakpoints.length - 1].value
        }

        for (let index = 1; index < breakpoints.length; index++) {
            const start = breakpoints[index - 1]
            const end = breakpoints[index]
            if (targetDistance <= end.distance) {
                const span = end.distance - start.distance
                const segmentRatio = span > 0 ? clamp((targetDistance - start.distance) / span, 0, 1) : 0
                return interpolateValue(start.value, end.value, segmentRatio)
            }
        }

        return breakpoints[breakpoints.length - 1].value
    }

    static metricTimeBreakpointsFromTrack = (track, trackStartDistance, trackEndDistance) => {
        const metrics = track?.metrics
        const metricPoints = Array.isArray(metrics?.points) ? metrics.points : []
        const cacheKey = metrics
        const cacheBucket = getWeakMapBucket(metricBreakpointsCache, cacheKey)
        const cacheEntryKey = `${trackStartDistance ?? 0}:${trackEndDistance ?? 0}`
        const cachedBreakpoints = cacheBucket?.get(cacheEntryKey)
        if (cachedBreakpoints) {
            return cachedBreakpoints
        }

        const timedPoints = []
        let metricDistance = 0

        metricPoints.forEach(point => {
            const pointDistance = finiteNumber(point?.distance) ?? 0
            const timeMillis = parseTimeMillis(point?.time)

            metricDistance += pointDistance

            if (Number.isFinite(timeMillis)) {
                timedPoints.push({
                                     distance: metricDistance,
                                     timeMillis,
                                     duration: finiteNumber(point?.duration),
                                 })
            }
        })

        if (timedPoints.length === 0) {
            return []
        }

        const firstPoint = timedPoints[0]
        if (Number.isFinite(firstPoint.duration) && firstPoint.duration > 0) {
            timedPoints.unshift({
                                   distance:   Math.max(0, firstPoint.distance - (finiteNumber(metricPoints[0]?.distance) ?? 0)),
                                   timeMillis: firstPoint.timeMillis - (firstPoint.duration * 1000),
                               })
        }

        if (timedPoints.length < 2) {
            return []
        }

        const metricStartDistance = timedPoints[0].distance
        const metricEndDistance = timedPoints[timedPoints.length - 1].distance
        const metricSpan = metricEndDistance - metricStartDistance
        const renderSpan = trackEndDistance - trackStartDistance

        const breakpoints = timedPoints.map(point => {
            const ratio = metricSpan > 0 ? clamp((point.distance - metricStartDistance) / metricSpan, 0, 1) : 0
            return {
                distance:   trackStartDistance + (renderSpan * ratio),
                timeMillis: point.timeMillis,
            }
        })

        cacheBucket?.set(cacheEntryKey, breakpoints)
        return breakpoints
    }

    static cumulativeElevationBreakpointsFromTrack = (track, trackStartDistance, trackEndDistance) => {
        const metrics = track?.metrics
        const metricPoints = Array.isArray(metrics?.points) ? metrics.points : []
        const cacheKey = metrics
        const cacheBucket = getWeakMapBucket(metricBreakpointsCache, cacheKey)
        const cacheEntryKey = `elevation:${trackStartDistance ?? 0}:${trackEndDistance ?? 0}`
        const cachedBreakpoints = cacheBucket?.get(cacheEntryKey)
        if (cachedBreakpoints) {
            return cachedBreakpoints
        }

        const timedPoints = []
        let metricDistance = 0
        let cumulativeElevationGain = 0

        metricPoints.forEach(point => {
            const pointDistance = finiteNumber(point?.distance) ?? 0
            const elevation = finiteNumber(point?.trendElevation ?? point?.elevation) ?? 0

            metricDistance += pointDistance
            if (elevation > 0) {
                cumulativeElevationGain += elevation
            }

            timedPoints.push({
                distance: metricDistance,
                value:    cumulativeElevationGain,
            })
        })

        if (timedPoints.length === 0) {
            return []
        }

        const metricStartDistance = timedPoints[0].distance
        const metricEndDistance = timedPoints[timedPoints.length - 1].distance
        const metricSpan = metricEndDistance - metricStartDistance
        const renderSpan = trackEndDistance - trackStartDistance

        const breakpoints = timedPoints.map(point => {
            const ratio = metricSpan > 0 ? clamp((point.distance - metricStartDistance) / metricSpan, 0, 1) : 0
            return {
                distance: trackStartDistance + (renderSpan * ratio),
                value:    point.value,
            }
        })

        cacheBucket?.set(cacheEntryKey, breakpoints)
        return breakpoints
    }

    static assignSegmentTimes = (points, timeSegment) => {
        const breakpoints = JourneyReplayPathSampler.timeBreakpointsFromSegment(timeSegment)
        if (breakpoints.length < 2 || !Array.isArray(points) || points.length === 0) {
            return
        }

        let distance = 0
        points.forEach((point, index) => {
            if (index > 0) {
                distance += JourneyReplayTurfPath.distanceBetween(
                    [points[index - 1].longitude, points[index - 1].latitude],
                    [point.longitude, point.latitude],
                )
            }
            point.replaySegmentDistance = distance
        })

        points.forEach((point, index) => {
            const ratio = distance > 0
                          ? clamp(point.replaySegmentDistance / distance, 0, 1)
                          : (points.length > 1 ? index / (points.length - 1) : 0)
            const timeMillis = JourneyReplayPathSampler.timeAtRatio(breakpoints, ratio)

            if (Number.isFinite(timeMillis)) {
                point.timeMillis = timeMillis
                point.time = isoTime(timeMillis)
            }

            delete point.replaySegmentDistance
        })
    }
}
