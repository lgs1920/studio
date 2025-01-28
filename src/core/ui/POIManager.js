import { POI_THRESHOLD_DISTANCE, STARTER_POI } from '@Core/constants'
import { TrackUtils }                          from '@Utils/cesium/TrackUtils'
import { KM }                                  from '@Utils/UnitUtils'
import { v4 as uuid }                          from 'uuid'

export class POIManager {

    poiDefaultStatus = {
        withinScreenLimits: null,
        frontOfTerrain:     true,
        scale:              1,
        showFlag:           null,
        showPOI:            true,
    }

    threshold = POI_THRESHOLD_DISTANCE

    constructor() {
        // Singleton
        if (POIManager.instance) {
            return POIManager.instance
        }

        this.observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                const data = this.list.get(entry.target.id) ?? this.poiDefaultStatus
                data.withinScreenLimits = entry !== undefined ? entry.isIntersecting : true
                this.update(entry.target.id, data)
            })
        }, {ratio: 1, rootMargin: '-64px'})

        POIManager.instance = this
    }

    get list() {
        return lgs.mainProxy.components.poi.list
    }


    /**
     * Adds a new POI to the map
     *
     * @param {Object} newPoi - The new POI object
     *
     * @return {object|false} - The new POI or false if it is closer than others
     */
    add = (newPoi) => {
        const id = newPoi.id ?? uuid()
        newPoi.id = id
        if (this.isTooCloseThanExistingPoints(newPoi, this.threshold)) {
            return false
        }

        this.list.set(id, {...newPoi, ...this.poiDefaultStatus})
        return this.list.get(id)
    }

    /**
     * Removes a POI from the map by its ID
     *
     * @param {string} id - The ID of the POI to remove
     */
    remove = (pois, id) => {
        this.list.delete(id)
    }

    /**
     * Updates an existing POI in the map
     *
     * @param {string} id - The ID of the POI to update
     * @param {Object} updates - The updates to apply to the POI
     */
    update = (id, updates) => {
        const poi = this.list.get(id)
        if (poi) {
            this.list.set(id, {...poi, ...updates})
            return this.list.get(id)
        }
        return false
    }

    /**
     * compute Haversine distance between 2 points
     *
     * @param {number} poi1 - first point
     * @param {number} poi2 - second point
     *
     * @returns {number} - distance in meters
     */
    haversineDistance = (poi1, poi2) => {
        const toRadians = (degrees) => degrees * (Math.PI / 180)
        const R = 6371  //Kms
        const dLat = toRadians(poi2.latitude - poi1.latitude)
        const dLon = toRadians(poi2.longitude - poi1.longitude)
        const a =
                  Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(toRadians(poi1.latitude)) * Math.cos(toRadians(poi2.latitude)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2)
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        return R * c / KM   // Meters
    }

    /**
     * We check whether the distance between two points is closer than a threshold
     *
     * @param {number} poi1 - first point
     * @param {number} poi2 - second point
     *
     * @param {number} threshold - threshold distance in meters
     *
     * @returns {boolean} - true if they are closer
     */
    closerThan = (poi1, poi2, threshold = this.threshold) => {
        return this.haversineDistance(poi1, poi2) <= threshold
    }

    /**
     * We want to know if there is an existing point that is closer than a given point
     * in the list.
     *
     * @param newPoi
     * @param threshold
     *
     * @return {boolean} - true if there is one closer
     */
    isTooCloseThanExistingPoints = (newPoi, threshold = this.threshold) => {
        if (newPoi.id === STARTER_POI) {
            return false
        }
        for (let poi of this.list.values()) {
            if (this.closerThan(newPoi, poi, threshold)) {
                return true
            }
        }
        return false
    }

    getElevationFromTerrain = async (point) => {
        return TrackUtils.getElevationFromTerrain(point)
    }


}