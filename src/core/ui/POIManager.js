import { POI_STANDARD_TYPE, POI_THRESHOLD_DISTANCE, STARTER_POI, STARTER_TYPE } from '@Core/constants'
import { MapPOI }                                                               from '@Core/MapPOI'
import { Export }                                                               from '@Core/ui/Export'
import { TrackUtils }                                                           from '@Utils/cesium/TrackUtils'
import { KM }                                                                   from '@Utils/UnitUtils'
import { v4 as uuid }                                                           from 'uuid'

export class POIManager {

    threshold = POI_THRESHOLD_DISTANCE

    constructor() {
        // Singleton
        if (POIManager.instance) {
            return POIManager.instance
        }

        this.observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                Object.assign(this.list.get(entry.target.id), {withinScreenLimits: entry.isIntersecting})
            })
        }, {ratio: 1, rootMargin: '-64px'})

        POIManager.instance = this
    }

    get list() {
        return lgs.mainProxy.components.pois.list
    }


    /**
     * Adds a new POI to the map
     *
     * @param {Object} poi - The new POI object
     *
     * @return {MapPOI|false} - The new POI or false if it is closer than others
     */
    add = (poi) => {
        poi.id = poi.id ?? uuid()
        if (this.isTooCloseThanExistingPoints(poi, this.threshold)) {
            return false
        }

        this.list.set(poi.id, new MapPOI({...poi, ...this.poiDefaultStatus}))
        return this.list.get(poi.id)
    }

    /**
     * Removes a POI from the map by its ID
     *
     * @param {string} id - The ID of the POI to remove
     */
    remove = (id) => {
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
            this.list.set(id, poi.update(updates))
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

    copyCoordinatesToClipboard = async (point) => {
        return Export.toClipboard(`${point.latitude}, ${point.longitude}`)
    }

    getPOIByKeyValue = (key, value) => {
        const result = []
        this.list.forEach(poi => {
            if (poi[key] === value) {
                result.push(poi)
            }
        })
        return result
    }

    setStarter = (current) => {
        const starter = this.getPOIByKeyValue('type', STARTER_TYPE)[0]
        if (starter) {
            // We force the former type of the starter and apply the right color
            this.list.set(starter.id, starter.update({
                                                         type:  starter.formerType ?? POI_STANDARD_TYPE,
                                                         color: lgs.settings.ui.poi.defaultColor,
                                                     }))

            // Then mark the current as Starter with the right color
            this.list.set(current.id, current.update({
                                                         formerType: current.type ?? POI_STANDARD_TYPE,
                                                         type:       STARTER_TYPE,
                                                         color:      lgs.settings.starter.color,
                                                     }))

            return current
        }
        return false
    }
}