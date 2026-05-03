/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Geocoder.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { featureEach } from '@turf/meta'

const CITY_FIELDS = ['city', 'town', 'village', 'municipality', 'hamlet', 'county', 'state']

const finiteCoordinate = value => {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const normalizeCoordinate = coordinate => {
    const longitude = finiteCoordinate(Array.isArray(coordinate) ? coordinate[0] : coordinate?.longitude ?? coordinate?.lon)
    const latitude = finiteCoordinate(Array.isArray(coordinate) ? coordinate[1] : coordinate?.latitude ?? coordinate?.lat)

    if (longitude === null || latitude === null) {
        return null
    }

    return {longitude, latitude}
}

const normalizePlaceName = value => String(value ?? '').trim()

const getTrackCoordinates = track => {
    const geometry = track?.content?.geometry

    if (!geometry) {
        return []
    }

    if (geometry.type === 'LineString') {
        return Array.isArray(geometry.coordinates) ? geometry.coordinates : []
    }

    if (geometry.type === 'MultiLineString') {
        return Array.isArray(geometry.coordinates) ? geometry.coordinates.flat() : []
    }

    return []
}

export const formatJourneyLocation = (start, stop) => {
    const startLocation = normalizePlaceName(start)
    const stopLocation = normalizePlaceName(stop)

    if (!startLocation && !stopLocation) {
        return ''
    }

    if (!startLocation || !stopLocation) {
        return startLocation || stopLocation
    }

    if (startLocation.localeCompare(stopLocation, undefined, {sensitivity: 'accent'}) === 0) {
        return startLocation
    }

    return `${startLocation} - ${stopLocation}`
}

export const cityFromGeocodingFeature = feature => {
    const result = feature?.type === 'FeatureCollection' ? feature.features?.[0] : feature
    const properties = result?.properties ?? result ?? {}
    const address = properties.address ?? {}
    const city = CITY_FIELDS.map(field => normalizePlaceName(address[field])).find(Boolean)

    if (city) {
        return city
    }

    return normalizePlaceName(properties.name) || normalizePlaceName(properties.display_name).split(',')[0].trim()
}

export const journeyLocationCoordinates = journey => {
    const tracks = typeof journey?.tracks?.values === 'function'
                   ? Array.from(journey.tracks.values())
                   : Object.values(journey?.tracks ?? {})
    const coordinates = tracks.flatMap(getTrackCoordinates).map(normalizeCoordinate).filter(Boolean)

    return locationCoordinatesFromList(coordinates)
}

export const trackLocationCoordinates = track => {
    const coordinates = getTrackCoordinates(track).map(normalizeCoordinate).filter(Boolean)

    return locationCoordinatesFromList(coordinates)
}

const locationCoordinatesFromList = coordinates => {
    return {
        start: coordinates[0] ?? null,
        stop:  coordinates[coordinates.length - 1] ?? null,
    }
}

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
    #reverseLocationCache = new Map()
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
            featureEach(features, (feature) => {
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
     * Retrieves the city or nearest named place for given longitude and latitude coordinates.
     * @param {number} longitude - The longitude coordinate.
     * @param {number} latitude - The latitude coordinate.
     * @returns {Promise<string>} The city or place name.
     */
    getCity = async (longitude, latitude) => {
        const coordinate = normalizeCoordinate({longitude, latitude})

        if (!coordinate) {
            return ''
        }

        const key = `${coordinate.longitude.toFixed(5)}:${coordinate.latitude.toFixed(5)}`

        if (!this.#reverseLocationCache.has(key)) {
            this.#reverseLocationCache.set(key, this.#fetchCity(coordinate).catch(error => {
                this.#reverseLocationCache.delete(key)
                console.error(error)
                return ''
            }))
        }

        return this.#reverseLocationCache.get(key)
    }

    getCoordinatesLocation = async (start, stop) => {
        const startCoordinate = normalizeCoordinate(start)
        const stopCoordinate = normalizeCoordinate(stop)

        if (!startCoordinate && !stopCoordinate) {
            return ''
        }

        const [startLocation, stopLocation] = await Promise.all([
                                                                    startCoordinate ? this.getCity(startCoordinate.longitude, startCoordinate.latitude) : '',
                                                                    stopCoordinate ? this.getCity(stopCoordinate.longitude, stopCoordinate.latitude) : '',
                                                                ])

        return formatJourneyLocation(startLocation, stopLocation)
    }

    #fetchCity = async ({longitude, latitude}) => {
        const url = new URL(`${this.url}/${this.#reverse}`)
        url.searchParams.append('lon', longitude)
        url.searchParams.append('lat', latitude)
        url.searchParams.append('format', this.format)
        url.searchParams.append('email', this.email)
        url.searchParams.append('addressdetails', 1)
        url.searchParams.append('zoom', 10)

        const feature = await this.fetch(url)
        return cityFromGeocodingFeature(feature)
    }

    /**
     * Resolves the display location for a journey using its start and end coordinates.
     * @param {Journey} journey - The journey to resolve.
     * @returns {Promise<string>} A single place or "start - end" when places differ.
     */
    getJourneyLocation = async (journey) => {
        const {start, stop} = journeyLocationCoordinates(journey)

        return this.getCoordinatesLocation(start, stop)
    }

    /**
     * Resolves the display location for a track using its start and end coordinates.
     * @param {Track} track - The track to resolve.
     * @returns {Promise<string>} A single place or "start - end" when places differ.
     */
    getTrackLocation = async (track) => {
        const {start, stop} = trackLocationCoordinates(track)

        return this.getCoordinatesLocation(start, stop)
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
