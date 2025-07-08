/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Geocoder.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-08
 * Last modified: 2025-07-08
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { featureEach } from '@turf/meta'

/**
 * Geocoder class for handling geocoding and reverse geocoding requests.
 * Singleton pattern to ensure a single instance.
 */
export class Geocoder {

    excludePlaces = []
    results = new Map()
    limit = 0
    email
    url
    #search
    #reverse
    format
    license

    /**
     * Converts coordinates to Degree-Minute-Second format.
     */
    toDMS = __.ui.ui.DMS2DD

    /**
     * Creates or returns the singleton instance of Geocoder.
     */
    constructor() {
        // Singleton
        if (Geocoder.instance) {
            return Geocoder.instance
        }

        this.url = lgs.settings.ui.geocoder.url
        this.limit = lgs.settings.ui.geocoder.limit
        this.email = lgs.settings.ui.geocoder.email
        this.#search = lgs.settings.ui.geocoder.search
        this.#reverse = lgs.settings.ui.geocoder.reverse
        this.format = 'geojson'

        this.init()

        Geocoder.instance = this
    }

    /**
     * Initializes the geocoder by resetting excludePlaces and results.
     */
    init = () => {
        this.excludePlaces.length = 0
        this.results.clear()
    }

    /**
     * Searches for locations based on a query string.
     * @param {string} location - The location to search for.
     * @returns {Promise<Map|Object>} A Map of GeoJSON features or an error object.
     */
    search = async (location) => {
        // Build the query
        const url = new URL(`${this.url}/${this.#search}`)
        // Add the searched location
        url.searchParams.append('q', location)
        url.searchParams.append('limit', this.limit)
        url.searchParams.append('format', this.format)
        url.searchParams.append('email', this.email)
        url.searchParams.append('dedupe', 1)
        url.searchParams.append('namedetails', 1)
        url.searchParams.append('addressdetails', 1)

        // Add exclude place
        if (this.excludePlaces.length > 0) {
            url.searchParams.append('exclude_place_ids', this.excludePlaces.join(','))
        }

        // Time to query the geocoder
        this.results.clear()
        try {
            const features = await this.fetch(url)
            featureEach(features, (feature, index) => {
                this.results.set(feature.properties.place_id, feature)
                // We exclude this result for the next time
                if (!this.excludePlaces.includes(feature.properties.place_id)) {
                    this.excludePlaces.push(feature.properties.place_id)
                }
            })
            this.license = features.licence
        }
        catch (error) {
            console.error(error)
            return {error: error.message}
        }
        return this.results
    }

    /**
     * Retrieves the country code for given longitude and latitude coordinates.
     * @param {number} longitude - The longitude coordinate.
     * @param {number} latitude - The latitude coordinate.
     * @returns {Promise<string|Object>} The country code (e.g., 'FR') or an error object.
     */
    getCountryCode = async (longitude, latitude) => {
        const url = new URL(`${this.url}/${this.#reverse}`)
        url.searchParams.append('lon', longitude)
        url.searchParams.append('lat', latitude)
        url.searchParams.append('format', this.format)
        url.searchParams.append('email', this.email)
        url.searchParams.append('addressdetails', 1)

        try {
            const features = await this.fetch(url)
            if (features?.properties?.address?.country_code) {
                return features.properties.address.country_code
            }
            return ''
        }
        catch (error) {
            console.error(error)
            return {error: error.message}
        }
    }

    /**
     * Fetches data from the geocoding API.
     * @param {URL} url - The URL to fetch data from.
     * @returns {Promise<Object>} The API response data.
     */
    fetch = async (url) => {
        const response = await lgs.axios.get(url)
        return response.data
    }

}