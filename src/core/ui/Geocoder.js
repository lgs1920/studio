import { featureEach } from '@turf/meta'

export class Geocoder {

    excludePlaces = []
    results = new Map()
    limit = 0
    email
    url
    #search
    #reverse
    format
    email


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

    init = () => {
        this.excludePlaces.length = 0
        this.results.clear()
    }

    search = async (location) => {

        // Build the query
        const url = new URL(`${this.url}/${this.#search}`)
        //add the searched location
        url.searchParams.append('q', location)

        url.searchParams.append('limit', this.limit)
        url.searchParams.append('format', this.format)
        //  url.searchParams.append('email', this.email)
        url.searchParams.append('dedupe', true) // Returns doublon
        url.searchParams.append(`polygon_${this.format}`, true)
        url.searchParams.append('timestamp', new Date().getTime())
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
                // we exclude this result for the next time
                if (!this.excludePlaces.includes(feature.properties.place_id)) {
                    this.excludePlaces.push(feature.properties.place_id)
                }
            })
        }
        catch (error) {
            console.error(error)
            return false
        }
        return this.results

    }

    fetch = async (url, params) => {
        const response = await lgs.axios.get(url)
        return response.data
    }
}