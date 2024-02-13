import * as Cesium                from 'cesium'
import {DateTime}                 from 'luxon'
import {KM, MILE, MILLIS, MINUTE} from './AppUtils'

export class Mobility {
    /**
     * Compute the distance between 2 points using the Spherical Law of Cosines.
     * https://en.wikipedia.org/wiki/Spherical_law_of_cosines
     *
     * @param start {Object} should contain {latitude,longitude} in degrees
     * @param end {Object}  should contain {latitude,longitude} in degrees
     *
     * @return {number} the distance
     *
     */
    static distance = (start, end) => {
        const R = 6371e3  //Earth average radius in meter
        const p1 = Cesium.Math.toRadians(start.latitude)
        const p2 = Cesium.Math.toRadians(end.latitude)
        const fp = Math.pow(Math.sin((p2 - p1) / 2), 2)
        const fl = Math.pow(Math.sin(Cesium.Math.toRadians(end.longitude - start.longitude) / 2), 2)

        const a = fp + Math.cos(p1) * Math.cos(p2) * fl
        return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    }
    /**
     * Return the elevation between  points
     *
     * @param {Object} start should contain {height} in meters
     * @param {Object} end   should contain {height} in meters
     *
     * @return {undefined|number}
     */
    static elevation = (start, end) => {
        if (start.height && end.height) {
            return end.height - start.height
        }
        return undefined
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
            return undefined
        }
        return distance / duration * 3.6 / (kms ? KM : MILE) * 1000
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
            return undefined
        }
        return duration / MINUTE / distance * (km ? KM : MILE) * 1000
    }

    /**
     * Compute duration (in seconds) between 2 date in ISO format
     * @param {string} start
     * @param {string} stop
     * @return {number} duration in seconds
     */
    static duration(start, stop) {
        return Math.abs(DateTime.fromISO(stop).diff(DateTime.fromISO(start)).toMillis()) / MILLIS
    }

}