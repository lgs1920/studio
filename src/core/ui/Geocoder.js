/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Geocoder.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2025-01-19
 * Last modified: 2026-10-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { POI_FLAG_START, POI_FLAG_STOP } from '@Core/constants'
import { featureEach }                   from '@turf/meta'

const CITY_FIELDS = ['city', 'town', 'village', 'municipality', 'hamlet', 'county', 'state']
const COMMUNE_FIELDS = ['city', 'town', 'village', 'municipality', 'hamlet']
const REVERSE_GEOCODING_RETRY_DELAY = 60_000

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
const isTechnicalPlaceName = value => /^[A-Z][A-Z0-9]*\d+_[A-Za-z0-9]+$/.test(normalizePlaceName(value))

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

const normalizeCountryCode = value => normalizePlaceName(value).toUpperCase()

const firstGeocodingFeature = feature => feature?.type === 'FeatureCollection' ? feature.features?.[0] : feature

const uniqueValues = values => [...new Set(values.map(normalizePlaceName).filter(Boolean))]

const normalizeLocationDetails = details => {
    if (typeof details === 'string') {
        return {
            location:    normalizePlaceName(details),
            country:     '',
            countryCode: '',
        }
    }

    return {
        location:    normalizePlaceName(details?.location),
        country:     normalizePlaceName(details?.country),
        countryCode: normalizeCountryCode(details?.countryCode),
    }
}

const applyLocationDetails = (target, details) => {
    if (!target || typeof target !== 'object') {
        return
    }

    if (details.location) {
        target.location = details.location
    }
    if (details.country) {
        target.country = details.country
    }
    if (details.countryCode) {
        target.countryCode = details.countryCode
    }
    if (details.countries?.length) {
        target.countries = details.countries
    }
    if (details.countryCodes?.length) {
        target.countryCodes = details.countryCodes
    }
}

export const formatJourneyLocationDetails = (start, stop) => {
    const startDetails = normalizeLocationDetails(start)
    const stopDetails = normalizeLocationDetails(stop)
    const countries = uniqueValues([startDetails.country, stopDetails.country])
    const countryCodes = uniqueValues([startDetails.countryCode, stopDetails.countryCode]).map(normalizeCountryCode)

    return {
        location:    formatJourneyLocation(startDetails.location, stopDetails.location),
        country:     formatJourneyLocation(startDetails.country, stopDetails.country),
        countryCode: formatJourneyLocation(startDetails.countryCode, stopDetails.countryCode),
        countries,
        countryCodes,
        start:       startDetails,
        stop:        stopDetails,
    }
}

export const cityFromGeocodingFeature = feature => {
    const result = firstGeocodingFeature(feature)
    const properties = result?.properties ?? result ?? {}
    const address = properties.address ?? {}
    const city = CITY_FIELDS.map(field => normalizePlaceName(address[field])).find(Boolean)

    if (city) {
        return city
    }

    const fallback = [properties.name, normalizePlaceName(properties.display_name).split(',')[0].trim()]
        .map(normalizePlaceName)
        .find(candidate => candidate && !isTechnicalPlaceName(candidate))

    return fallback ?? ''
}

export const locationDetailsFromGeocodingFeature = feature => {
    const result = firstGeocodingFeature(feature)
    const properties = result?.properties ?? result ?? {}
    const address = properties.address ?? {}

    return {
        location:    cityFromGeocodingFeature(feature),
        country:     normalizePlaceName(address.country),
        countryCode: normalizeCountryCode(address.country_code),
    }
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
    proxy
    #search
    #reverse
    #reverseFeatureCache = new Map()
    #reverseLocationUnavailableUntil = 0
    #lastReverseLocationWarningAt = 0
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
        this.proxy = lgs.servers?.studio?.proxy || lgs.settings.ui.geocoder.proxy || ''
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
        const details = await this.getCoordinateLocationDetails({longitude, latitude})
        return details.countryCode
    }

    /**
     * Retrieves the city or nearest named place for given longitude and latitude coordinates.
     * @param {number} longitude - The longitude coordinate.
     * @param {number} latitude - The latitude coordinate.
     * @returns {Promise<string>} The city or place name.
     */
    getCity = async (longitude, latitude) => {
        const details = await this.getCoordinateLocationDetails({longitude, latitude})
        return details.location
    }

    getCoordinateLocationDetails = async (coordinate) => {
        coordinate = normalizeCoordinate(coordinate)

        if (!coordinate) {
            return normalizeLocationDetails()
        }

        if (this.#isReverseLocationUnavailable()) {
            return normalizeLocationDetails()
        }

        const feature = await this.#getCoordinateFeature(coordinate)
        return feature ? locationDetailsFromGeocodingFeature(feature) : normalizeLocationDetails()
    }

    /**
     * Retrieve a POI's display name and address from its coordinates.
     * @param {Object} poi - POI whose longitude and latitude should be reverse-geocoded.
     * @returns {Promise<{title: string, description: string}>} The place name and display address.
     */
    getPOIPresentationDetails = async (poi) => {
        const coordinate = normalizeCoordinate(poi)
        if (!coordinate || this.#isReverseLocationUnavailable()) {
            return {title: '', description: ''}
        }

        const feature = await this.#getCoordinateFeature(coordinate)
        const properties = firstGeocodingFeature(feature)?.properties ?? {}
        const displayName = normalizePlaceName(properties.display_name)
        const address = properties.address ?? {}
        const commune = COMMUNE_FIELDS.map(field => normalizePlaceName(address[field])).find(Boolean)
        const displayLabel = displayName.split(',')[0].trim()
        const title = [properties.name, commune, displayLabel]
            .map(normalizePlaceName)
            .find(candidate => candidate && !isTechnicalPlaceName(candidate)) ?? ''

        return {
            title,
            description: displayName.split(', ').join(' - '),
        }
    }

    getCoordinatesLocation = async (start, stop) => {
        const details = await this.getCoordinatesLocationDetails(start, stop)
        return details.location
    }

    getCoordinatesLocationDetails = async (start, stop) => {
        const startCoordinate = normalizeCoordinate(start)
        const stopCoordinate = normalizeCoordinate(stop)

        if (!startCoordinate && !stopCoordinate) {
            return formatJourneyLocationDetails()
        }

        const startLocation = startCoordinate ? await this.getCoordinateLocationDetails(startCoordinate) : null
        const stopLocation = stopCoordinate ? await this.getCoordinateLocationDetails(stopCoordinate) : null

        return formatJourneyLocationDetails(startLocation, stopLocation)
    }

    /** Retrieve one cached reverse-geocoding feature for a coordinate. */
    #getCoordinateFeature = async coordinate => {
        const key = `${coordinate.longitude.toFixed(5)}:${coordinate.latitude.toFixed(5)}`

        if (!this.#reverseFeatureCache.has(key)) {
            this.#reverseFeatureCache.set(key, this.#fetchReverseFeature(coordinate).catch(error => {
                this.#reverseFeatureCache.delete(key)
                this.#handleReverseLocationError(error)
                return null
            }))
        }

        return this.#reverseFeatureCache.get(key)
    }

    /** Fetch the configured reverse-geocoding feature for a coordinate. */
    #fetchReverseFeature = async ({longitude, latitude}) => {
        const url = new URL(`${this.url}/${this.#reverse}`)
        url.searchParams.append('lon', longitude)
        url.searchParams.append('lat', latitude)
        url.searchParams.append('format', this.format)
        url.searchParams.append('email', this.email)
        url.searchParams.append('addressdetails', 1)
        url.searchParams.append('namedetails', 1)
        // Building-level results include names for POIs while keeping address fields available for city extraction.
        url.searchParams.append('zoom', 18)

        return this.fetch(url)
    }

    /**
     * Resolves the display location for a journey using its start and end coordinates.
     * @param {Journey} journey - The journey to resolve.
     * @returns {Promise<string>} A single place or "start - end" when places differ.
     */
    getJourneyLocation = async (journey) => {
        const details = await this.getJourneyLocationDetails(journey)
        return details.location
    }

    getJourneyLocationDetails = async (journey) => {
        const {start, stop} = journeyLocationCoordinates(journey)

        const details = await this.getCoordinatesLocationDetails(start, stop)
        applyLocationDetails(journey, details)

        return details
    }

    /**
     * Resolves the display location for a track using its start and end coordinates.
     * @param {Track} track - The track to resolve.
     * @returns {Promise<string>} A single place or "start - end" when places differ.
     */
    getTrackLocation = async (track) => {
        const details = await this.getTrackLocationDetails(track)
        return details.location
    }

    getTrackLocationDetails = async (track) => {
        const {start, stop} = trackLocationCoordinates(track)

        return this.getCoordinatesLocationDetails(start, stop)
    }

    getPOILocationDetails = async (poi, {journey} = {}) => {
        const existing = normalizeLocationDetails(poi)

        if ((poi?.type === POI_FLAG_START || poi?.type === POI_FLAG_STOP) && journey) {
            const journeyLocation = await this.getJourneyLocationDetails(journey)
            const endpoint = poi.type === POI_FLAG_START ? journeyLocation.start : journeyLocation.stop

            if (endpoint?.location || endpoint?.country || endpoint?.countryCode) {
                return endpoint
            }

            return existing
        }

        if (existing.location && existing.country && existing.countryCode) {
            return existing
        }

        return this.getCoordinateLocationDetails(poi)
    }

    /**
     * Fetches data from the geocoding API.
     * @param {URL} url - The URL to fetch data from.
     * @returns {Promise<Object>} The API response data.
     */
    fetch = async (url) => {
        const response = await lgs.axios.get(this.#getFetchUrl(url))
        return response.data
    }

    #getFetchUrl = url => {
        const targetUrl = url instanceof URL ? url.toString() : String(url)
        const proxyUrl = normalizePlaceName(this.proxy)

        return proxyUrl ? `${proxyUrl}${encodeURIComponent(targetUrl)}` : targetUrl
    }

    #isReverseLocationUnavailable = () => Date.now() < this.#reverseLocationUnavailableUntil

    #handleReverseLocationError = error => {
        const now = Date.now()
        this.#reverseLocationUnavailableUntil = now + REVERSE_GEOCODING_RETRY_DELAY

        if (now - this.#lastReverseLocationWarningAt < REVERSE_GEOCODING_RETRY_DELAY) {
            return
        }

        const status = error?.response?.status
        const statusText = error?.response?.statusText
        const message = status
                        ? `${status}${statusText ? ` ${statusText}` : ''}`
                        : (error?.message ?? 'request failed')

        console.warn(`[Geocoder] Reverse geocoding unavailable (${message}). Retrying later.`)
        this.#lastReverseLocationWarningAt = now
    }

}
