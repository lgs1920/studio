import * as turfDistance from '@turf/distance'

import { DateTime }   from 'luxon'
import * as turfPoint from 'turf-point'
import { MILLIS }     from '../core/constants'

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
        if (start && end) {
            return turfDistance.default(
                turfPoint.default([start.longitude, start.latitude]),
                turfPoint.default([end.longitude, end.latitude]),
            ) * 1000
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
        if (start && end && start.altitude && end.altitude) {
            return end.altitude - start.altitude
        }
        return 0
    }

    /**
     * Return the speed
     *
     * @param {number} distance in meters
     * @param {number} duration in second
     * @param {boolean} kms unit in kms by default, else miles
     *
     * @return {number} speed in kms/hour or miles/hour
     */
    static speed = (distance, duration, kms = true) => {
        if (duration === 0) {
            return 0
        }
        return distance / duration
    }

    /**
     * Return the pace
     *
     * @param {number} distance in meters
     * @param {number} duration in millisecond
     * @param {boolean} km unit per km by default, else mile
     *
     * @return {number} pace in minutes/km or minutes/mile
     */
    static pace = (distance, duration, km = true) => {
        if (distance === 0) {
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
            return Math.abs(DateTime.fromISO(stop).diff(DateTime.fromISO(start)).toMillis()) / MILLIS
        }
        return 0
    }

}