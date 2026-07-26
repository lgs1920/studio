/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayPathSampler.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-04
 * Last modified: 2026-05-04
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Mobility } from '@Utils/Mobility'
import { getTrackRenderContent, trackRenderSmoothingKey } from '@Utils/cesium/trackRenderSmoothing'
import { Track } from '@Core/Track'

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
const renderedCoordinateSegmentsCache = new WeakMap()
const timeSegmentsCache = new WeakMap()
const metricBreakpointsCache = new WeakMap()

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

                JourneyReplayPathSampler.assignSegmentTimes(points, timeSegments[segmentIndex])

                const startIndex = this.#samples.length
                const startDistance = cumulativeDistance

                points.forEach((point, pointIndex) => {
                    const segmentDistance = pointIndex > 0
                        ? Mobility.distance(points[pointIndex - 1], point)
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

                this.#segments.push({
                    key: `${track.slug}:${segmentIndex}`,
                    trackSlug: track.slug,
                    trackIndex,
                    segmentIndex,
                    startIndex,
                    endIndex: this.#samples.length - 1,
                    startDistance,
                    endDistance: cumulativeDistance,
                })
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

    nearestToLonLat = (coordinates) => {
        const point = pointFromCoordinate(coordinates)
        if (!point || this.#samples.length === 0) {
            return null
        }

        let nearest = null
        let nearestDistance = Infinity

        this.#samples.forEach(sample => {
            const distance = Mobility.distance(point, sample)
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
                return end.distanceFromStart === start.distanceFromStart
                       ? cloneSample(end)
                       : interpolateSample(start, end, targetDistance, this.#totalDistance)
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
        const cacheKey = track?.content
        const smoothingKey = trackRenderSmoothingKey(track, options)
        const cacheBucket = getWeakMapBucket(renderedCoordinateSegmentsCache, cacheKey)
        const cachedSegments = cacheBucket?.get(smoothingKey)
        if (cachedSegments) {
            return cachedSegments
        }

        const geometry = getTrackRenderContent(track, options)?.geometry
        if (!geometry) {
            return []
        }

        let segments = []
        if (geometry.type === LINE_STRING && Array.isArray(geometry.coordinates)) {
            segments = [geometry.coordinates]
        }
        else if (geometry.type === MULTI_LINE_STRING && Array.isArray(geometry.coordinates)) {
            segments = geometry.coordinates.filter(Array.isArray)
        }

        cacheBucket?.set(smoothingKey, segments)
        return segments
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
                distance += Mobility.distance(points[index - 1].point, item.point)
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
                distance += Mobility.distance(points[index - 1], point)
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
