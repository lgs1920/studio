/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayTurfPath.ts
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-01
 * Last modified: 2026-08-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import along from '@turf/along'
import { lineString } from '@turf/helpers'
import length from '@turf/length'

export type ReplayPathCoordinate = readonly [number, number, ...number[]]

export interface ReplayPathPosition {
    longitude: number
    latitude: number
    altitude: number
}

export interface ReplayPathTangent {
    bearingDegrees: number
    longitude: number
    latitude: number
}

const METERS_PER_KILOMETER = 1000

const finiteCoordinate = (coordinate: readonly number[]): ReplayPathCoordinate | null => {
    if (coordinate[0] === null || coordinate[0] === undefined || coordinate[1] === null || coordinate[1] === undefined) {
        return null
    }

    const longitude = Number(coordinate[0])
    const latitude = Number(coordinate[1])

    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        return null
    }

    const altitude = Number(coordinate[2])
    return Number.isFinite(altitude)
           ? [longitude, latitude, altitude]
           : [longitude, latitude]
}

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value))

const normalizeBearing = (bearing: number) => ((bearing + 540) % 360) - 180

const interpolate = (start: number, end: number, ratio: number) => start + ((end - start) * ratio)

const distanceRatio = (distance: number, cumulativeDistances: readonly number[]) => {
    let low = 1
    let high = cumulativeDistances.length - 1

    while (low < high) {
        const middle = Math.floor((low + high) / 2)
        if (cumulativeDistances[middle] < distance) {
            low = middle + 1
        }
        else {
            high = middle
        }
    }

    const endIndex = Math.max(1, low)
    const startIndex = endIndex - 1
    const span = cumulativeDistances[endIndex] - cumulativeDistances[startIndex]

    return {
        startIndex,
        endIndex,
        ratio: span > 0 ? clamp((distance - cumulativeDistances[startIndex]) / span, 0, 1) : 0,
    }
}

export class JourneyReplayTurfPath {
    readonly coordinates: ReplayPathCoordinate[]
    readonly totalDistance: number
    readonly cumulativeDistances: number[]
    readonly line

    constructor(coordinates: readonly (readonly number[])[]) {
        this.coordinates = coordinates.map(finiteCoordinate).filter((coordinate): coordinate is ReplayPathCoordinate => coordinate !== null)
        this.line = this.coordinates.length >= 2
                   ? lineString(this.coordinates.map(coordinate => [coordinate[0], coordinate[1]]))
                   : null
        const cumulativeDistances: number[] = []
        this.coordinates.forEach((coordinate, index) => {
            if (index === 0) {
                cumulativeDistances.push(0)
                return
            }

            cumulativeDistances.push(
                cumulativeDistances[index - 1]
                + JourneyReplayTurfPath.distanceBetween(this.coordinates[index - 1], coordinate),
            )
        })
        this.cumulativeDistances = cumulativeDistances
        this.totalDistance = this.cumulativeDistances.at(-1) ?? 0
    }

    get isValid() {
        return this.coordinates.length >= 2 && this.totalDistance > 0 && this.line !== null
    }

    /**
     * Evaluate the geodesic route at a distance in metres.
     *
     * @param distance Distance from the route origin in metres.
     * @returns The interpolated geographic position.
     */
    positionAtDistance = (distance: number): ReplayPathPosition => {
        const targetDistance = clamp(Number(distance) || 0, 0, this.totalDistance)
        const routeLine = this.line
        if (!this.isValid || !routeLine) {
            const [longitude = 0, latitude = 0, altitude = 0] = this.coordinates[0] ?? []
            return {longitude, latitude, altitude}
        }

        const target = along(routeLine, targetDistance / METERS_PER_KILOMETER, {units: 'kilometers'})
        const [longitude, latitude] = target.geometry.coordinates
        const {startIndex, endIndex, ratio} = distanceRatio(targetDistance, this.cumulativeDistances)
        const altitude = interpolate(
            this.coordinates[startIndex][2] ?? 0,
            this.coordinates[endIndex][2] ?? 0,
            ratio,
        )

        return {longitude, latitude, altitude}
    }

    /**
     * Return the local route tangent at a distance in metres.
     *
     * @param distance Distance from the route origin in metres.
     * @returns The normalized route tangent.
     */
    tangentAtDistance = (distance: number): ReplayPathTangent => {
        const targetDistance = clamp(Number(distance) || 0, 0, this.totalDistance)
        if (!this.isValid) {
            return {bearingDegrees: 0, longitude: 0, latitude: 0}
        }

        const {startIndex, endIndex} = distanceRatio(targetDistance, this.cumulativeDistances)
        const start = this.coordinates[startIndex]
        const end = this.coordinates[endIndex]
        const startPosition = this.positionAtDistance(this.cumulativeDistances[startIndex])
        const endPosition = this.positionAtDistance(this.cumulativeDistances[endIndex])
        const longitudeScale = Math.cos((start[1] * Math.PI) / 180)
        const longitudeDelta = (end[0] - start[0]) * longitudeScale
        const latitudeDelta = end[1] - start[1]
        const bearingDegrees = normalizeBearing((Math.atan2(longitudeDelta, latitudeDelta) * 180) / Math.PI)

        return {
            bearingDegrees,
            longitude: endPosition.longitude - startPosition.longitude,
            latitude: endPosition.latitude - startPosition.latitude,
        }
    }

    /**
     * Evaluate a future route position without extrapolating linearly from velocity.
     *
     * @param distance Current distance from the route origin in metres.
     * @param lookaheadMeters Future distance in metres.
     * @returns The future geographic position.
     */
    lookaheadAtDistance = (distance: number, lookaheadMeters: number) => this.positionAtDistance(
        (Number(distance) || 0) + Math.max(0, Number(lookaheadMeters) || 0),
    )

    static distanceBetween = (start: ReplayPathCoordinate, end: ReplayPathCoordinate) =>
        length(lineString([[start[0], start[1]], [end[0], end[1]]]), {units: 'kilometers'}) * METERS_PER_KILOMETER

}
