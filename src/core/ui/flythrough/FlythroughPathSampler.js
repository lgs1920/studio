/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FlythroughPathSampler.js
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
import { getTrackRenderContent } from '@Utils/cesium/trackRenderSmoothing'

const LINE_STRING = 'LineString'
const MULTI_LINE_STRING = 'MultiLineString'
export const FLYTHROUGH_SCOPE_VISIBLE_TRACKS = 'visible-tracks'
export const FLYTHROUGH_SCOPE_CURRENT_TRACK = 'current-track'
export const FLYTHROUGH_SCOPE_ALL_TRACKS = 'all-tracks'

const finiteNumber = value => {
    if (value === null || value === undefined || value === '') {
        return null
    }

    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

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

const interpolateSample = (start, end, targetDistance, totalDistance) => {
    const distance = end.distanceFromStart - start.distanceFromStart
    const segmentRatio = distance > 0 ? clamp((targetDistance - start.distanceFromStart) / distance, 0, 1) : 0
    const altitude = interpolateValue(start.altitude ?? 0, end.altitude ?? 0, segmentRatio)

    return {
        progress: totalDistance > 0 ? clamp(targetDistance / totalDistance, 0, 1) : 0,
        distanceFromStart: targetDistance,
        remainingDistance: Math.max(0, totalDistance - targetDistance),
        trackSlug: end.trackSlug,
        trackIndex: end.trackIndex,
        pointIndex: end.pointIndex,
        segmentIndex: end.segmentIndex,
        segmentRatio,
        longitude: interpolateValue(start.longitude, end.longitude, segmentRatio),
        latitude: interpolateValue(start.latitude, end.latitude, segmentRatio),
        altitude,
        height: altitude,
        interpolated: true,
        source: {
            startPoint: sampleReference(start),
            endPoint:   sampleReference(end),
        },
    }
}

export class FlythroughPathSampler {
    #journey = null
    #scope = FLYTHROUGH_SCOPE_VISIBLE_TRACKS
    #trackSlug = null
    #includeHiddenTracks = false
    #samples = []
    #segments = []
    #totalDistance = 0

    constructor(options = {}) {
        this.update(options)
    }

    update = ({
                  journey = this.#journey,
                  scope = this.#scope,
                  trackSlug = this.#trackSlug,
                  includeHiddenTracks = this.#includeHiddenTracks,
              } = {}) => {
        this.#journey = journey
        this.#scope = scope
        this.#trackSlug = trackSlug
        this.#includeHiddenTracks = includeHiddenTracks
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

    get hasSamples() {
        return this.#samples.length > 0
    }

    #selectedTracks = () => {
        const tracks = Array.from(this.#journey?.tracks?.values?.() ?? [])
            .map((track, index) => ({track, index}))

        if (this.#scope === FLYTHROUGH_SCOPE_ALL_TRACKS) {
            return tracks
        }

        if (this.#scope === FLYTHROUGH_SCOPE_CURRENT_TRACK) {
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

        if (!this.#journey?.tracks) {
            return
        }

        const selectedTracks = this.#selectedTracks()
        let cumulativeDistance = 0

        selectedTracks.forEach(({track, index: trackIndex}) => {
            const coordinateSegments = FlythroughPathSampler.coordinateSegmentsFromTrack(track)

            coordinateSegments.forEach((coordinates, segmentIndex) => {
                const points = coordinates.map(pointFromCoordinate).filter(Boolean)
                if (points.length < 2) {
                    return
                }

                const startIndex = this.#samples.length
                const startDistance = cumulativeDistance
                const segmentSamples = []

                points.forEach((point, pointIndex) => {
                    if (pointIndex > 0) {
                        cumulativeDistance += Mobility.distance(points[pointIndex - 1], point)
                    }

                    const sample = {
                        progress: 0,
                        distanceFromStart: cumulativeDistance,
                        remainingDistance: 0,
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

                    segmentSamples.push(sample)
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
        })

        this.#totalDistance = cumulativeDistance
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
                coordinates.push(FlythroughPathSampler.sampleCoordinates(sample))
            }
        })

        if (targetDistance < segment.endDistance) {
            const interpolated = this.#interpolateInSegment(segmentSamples, targetDistance)
            const last = coordinates[coordinates.length - 1]
            const next = FlythroughPathSampler.sampleCoordinates(interpolated)
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
            coordinates.push(FlythroughPathSampler.sampleCoordinates(this.#interpolateInSegment(segmentSamples, targetDistance)))
        }

        segmentSamples.forEach(sample => {
            if (sample.distanceFromStart >= targetDistance) {
                const next = FlythroughPathSampler.sampleCoordinates(sample)
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

    static coordinateSegmentsFromTrack = (track) => {
        const geometry = getTrackRenderContent(track)?.geometry
        if (!geometry) {
            return []
        }

        if (geometry.type === LINE_STRING && Array.isArray(geometry.coordinates)) {
            return [geometry.coordinates]
        }

        if (geometry.type === MULTI_LINE_STRING && Array.isArray(geometry.coordinates)) {
            return geometry.coordinates.filter(Array.isArray)
        }

        return []
    }
}
