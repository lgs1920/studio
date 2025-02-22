/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 *
 * File: POIManager.js
 * Path: /home/christian/devs/assets/lgs1920/studio/src/core/ui/POIManager.js
 *
 * Author : Christian Denat
 * email: christian.denat@orange.fr
 *
 * Created on: 2025-02-22
 * Last modified: 2025-02-22
 *
 *
 * Copyright © 2025 LGS1920
 *
 ******************************************************************************/

import { POI_STANDARD_TYPE, POI_STARTER_TYPE, POI_THRESHOLD_DISTANCE, POIS_STORE } from '@Core/constants'
import { MapPOI }                                                                  from '@Core/MapPOI'
import { Export }                                                                  from '@Core/ui/Export'
import { TrackUtils }                                                              from '@Utils/cesium/TrackUtils'
import { KM }                                                                      from '@Utils/UnitUtils'
import { v4 as uuid }                                                              from 'uuid'
import { snapshot }                                                                from 'valtio/index'

export class POIManager {

    threshold = POI_THRESHOLD_DISTANCE

    constructor() {
        // Singleton
        if (POIManager.instance) {
            return POIManager.instance
        }

        this.observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry) {
                    if (this.list.get(entry.target.id)) {
                        Object.assign(this.list.get(entry.target.id), {withinScreen: entry.isIntersecting})
                    }
                }
            })
        }, {ratio: 1, rootMargin: '-32px'})

        ;(async () => {
            this.readAllFromDB()
        })
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
     * Retrieve the starter POI
     *
     * @return {MapPOI}
     */
    get starter() {
        return this.list.values().find(poi => poi.type === POI_STARTER_TYPE)
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
     * Removes a POI from the map by its ID
     *
     * @param {string} id - The ID of the POI to remove
     * @param dbSync {boolean} - true for DB sync (false by default)
     */
    remove = async (id, dbSync = false) => {
        this.list.delete(id)
        if (dbSync) {
            await this.removeInDB(this.list.get(id))
        }
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

    set starterSettings(poi) {
        Object.keys(lgs.settings.starter).forEach(key => {
            lgs.settings.starter[key] = poi[key]
        })
    }

    /**
     * Computes Haversine distance between 2 points
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
        if (newPoi.type === POI_STARTER_TYPE) {
            return false
        }
        for (let poi of this.list.values()) {
            if (this.closerThan(newPoi, poi, threshold)) {
                return true
            }
        }
        return false
    }

    /**
     * Returns an elevation
     *
     * @param point
     * @return {Promise<altitude>}
     */
    getElevationFromTerrain = async (point) => {
        return TrackUtils.getElevationFromTerrain(point)
    }

    /**
     * Pushes the current POI as starter and changes the former starter configuration
     *
     * @param current
     * @return {*|boolean}
     */
    setStarter = async (current) => {
        const former = this.getPOIByKeyValue('type', POI_STARTER_TYPE)[0]
        if (former) {
            // We force the former type of the starter and apply the right color
            Object.assign(this.list.get(former.id), {
                type: former.formerType ?? POI_STANDARD_TYPE,
                color: lgs.settings.ui.poi.defaultColor,
            })
            await this.saveInDB(this.list.get(former.id))

            // Then mark the current as Starter with the right color
            Object.assign(this.list.get(current.id), {
                formerType: current.type ?? POI_STANDARD_TYPE,
                type: POI_STARTER_TYPE,
                color:      lgs.settings.starter.color,
            })

            await this.saveInDB(this.list.get(current.id))
            const starter = this.starterSettings = this.list.get(current.id)
            return {former, starter}
        }
        return false
    }

    /**
     * Saves a POI in DB
     *
     * @param poi
     *
     * @return {Promise<void>}
     */
    saveInDB = async (poi = lgs.mainProxy.components.pois.current) => {
        await lgs.db.lgs1920.put(poi.id, MapPOI.serialize({...poi, ...{__class: MapPOI}}), POIS_STORE)
    }

    /**
     * Removes a POI in DB
     *
     * @param poi
     *
     * @return {Promise<void>}
     */
    removeInDB = async (poi = lgs.mainProxy.components.pois.current) => {
        await lgs.db.lgs1920.delete(poi.id, POIS_STORE)
    }

    /**
     * Reads a POI from DB and populates the internal list
     *
     * @param poi
     * @return {Promise<void>}
     */
    readFromDB = async (poi = lgs.mainProxy.components.pois.current) => {
        const poiFromDB = await lgs.db.lgs1920.get(poi.id, POIS_STORE)
        if (poiFromDB) {
            this.list.set(poiFromDB.id, new MapPOI(poiFromDB))
        }
    }

    /**
     * Get all POIs from the database, populates and returns the internal list
     *
     * @return {proxyMap|false}
     *
     */
    readAllFromDB = async () => {
        try {
            // get all ids
            const keys = await lgs.db.lgs1920.keys(POIS_STORE)

            // Get each poi content
            const poiPromises = keys.map(async (key) => {
                return await lgs.db.lgs1920.get(key, POIS_STORE)
            })
            const list = await Promise.all(poiPromises)

            // Build the list
            list.forEach(poi => this.list.set(poi.id, new MapPOI(poi)))
            return this.list
        }
        catch (error) {
            console.error('Error when trying to get pois from browser database :', error)
            return false
        }

    }

    saveAllInDB = async () => {
        try {

            // Put each poi content
            Array.from(this.list.entries()).map(async ([key, poi]) => {
                return snapshot(
                    {
                        object: await lgs.db.lgs1920.put(key, MapPOI.serialize({...poi, ...{__class: MapPOI}}), POIS_STORE),
                        reset:  true,
                    },
                )
            })
            return await Promise.all(poiPromises)
        }
        catch (error) {
            console.error('Error when trying to save pois to browser database :', error)
            return []
        }
    }

    /**
     * Internal list size checker
     *
     * @return {boolean} true if thecollction contaoins element otherwize false.
     */
    hasPOIs = () => {
        return this.list.size > 0
    }

    /**
     * Update the poi type to POI
     *
     * @param id {string} POI id
     */
    saveAsPOI = async (id) => {
        Object.assign(this.list.get(id), {
            type: POI_STANDARD_TYPE,
        })
        await this.saveInDB(this.list.get(id))
        return this.list.get(id)
    }

    /**
     * "Shrink" a POI ie reduce it to its icon.
     *
     * @param id {string}
     */
    shrink = async (id) => {
        this.list.get(id).expanded = false
        await this.saveInDB(this.list.get(id))
        return this.list.get(id)
    }

    /**
     * "Expand" a POI ie expand it to a flag with more information.
     *
     * @param id {string}
     */
    expand = async (id) => {
        this.list.get(id).expanded = true
        await this.saveInDB(this.list.get(id))
        return this.list.get(id)
    }

    /**
     * Change the visibility  in order to hide the POI
     *
     * @param id {string}
     */
    hide = async (id) => {
        this.list.get(id).visible = false
        await this.saveInDB(this.list.get(id))
        return this.list.get(id)
    }

    /**
     * Change the visibility  in order to show the POI
     *
     * @param id {string}
     */
    show = async (id) => {
        this.list.get(id).visible = true
        await this.saveInDB(this.list.get(id))
        return this.list.get(id)
    }


}