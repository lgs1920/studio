/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Mobility.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-11
 * Last modified: 2026-02-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { MILLIS }        from '@Core/constants'
import { Cartographic, EllipsoidGeodesic } from 'cesium'
import { DateTime }                       from 'luxon'

export class Mobility {
    /**
     * Compute the distance between 2 points using the Spherical Law of Cosines.
     * https://en.wikipedia.org/wiki/Spherical_law_of_cosines
     *
     * @param start {Object} should contain {latitude,longitude} in degrees
     * @param end {Object}  should contain {latitude,longitude} in degrees
     *
     * @return {number} the distance in meters
     *
     */
    static distance = (start, end) => {
        const startLongitude = Number(start?.longitude)
        const startLatitude = Number(start?.latitude)
        const endLongitude = Number(end?.longitude)
        const endLatitude = Number(end?.latitude)

        if ([startLongitude, startLatitude, endLongitude, endLatitude].every(Number.isFinite)) {
            if (startLongitude === endLongitude && startLatitude === endLatitude) {
                return 0
            }

            try {
                const geodesic = new EllipsoidGeodesic(
                    Cartographic.fromDegrees(startLongitude, startLatitude),
                    Cartographic.fromDegrees(endLongitude, endLatitude),
                )
                return geodesic.surfaceDistance
            }
            catch {
                const toRadians = degrees => degrees * Math.PI / 180
                const dLat = toRadians(endLatitude - startLatitude)
                const dLon = toRadians(endLongitude - startLongitude)
                const lat1 = toRadians(startLatitude)
                const lat2 = toRadians(endLatitude)
                const a = Math.sin(dLat / 2) ** 2 +
                    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
                return 6378137 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
            }
        }
        return 0
    }
    /**
     * Return the elevation between  points
     *
     * @param {Object} start should contain {altitude} in meters
     * @param {Object} end   should contain {altitude} in meters
     *
     * @return {undefined|number}
     */
    static elevation = (start, end) => {
        if (Number.isFinite(start?.altitude) && Number.isFinite(end?.altitude)) {
            return end.altitude - start.altitude
        }
        return 0
    }

    /**
     * Return the speed
     *
     * @param {number} distance in meters
     * @param {number} duration in second
     *
     * @return {number} speed in meters/second
     */
    static speed = (distance, duration) => {
        if (!Number.isFinite(distance) || !Number.isFinite(duration) || duration <= 0) {
            return 0
        }
        return distance / duration
    }

    /**
     * Return the pace
     *
     * @param {number} distance in meters
     * @param {number} duration in second
     *
     * @return {number} pace in second/meter
     */
    static pace = (distance, duration) => {
        if (!Number.isFinite(distance) || !Number.isFinite(duration) || distance <= 0) {
            return 0
        }
        return duration / distance
    }

    /**
     * Compute duration (in seconds) between 2 date in ISO format
     * @param {string} start
     * @param {string} stop
     * @return {number} duration in seconds
     */
    static duration(start, stop) {
        if (start && stop) {
            const startDate = DateTime.isDateTime(start) ? start : DateTime.fromISO(start)
            const stopDate = DateTime.isDateTime(stop) ? stop : DateTime.fromISO(stop)

            if (startDate.isValid && stopDate.isValid) {
                return Math.abs(stopDate.diff(startDate).toMillis()) / MILLIS
            }
        }
        return 0
    }

}
