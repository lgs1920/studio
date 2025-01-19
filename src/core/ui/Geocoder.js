export class Geocoder {

    excludePlaces = []
    results = new Map()
    limit = 0
    url
    search
    reverse
    format
    email


    constructor() {
        // Singleton
        if (Geocoder.instance) {
            return Geocoder.instance
        }

        this.url = lgs.settings.ui.geocoder.url
        this.limit = lgs.settings.ui.geocoder.limit
        this.search = lgs.settings.ui.geocoder.search
        this.reverse = lgs.settings.ui.geocoder.reverse
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
        const url = new URL(`${this.url}/${this.search}`)
        url.searchParams.append('limit', this.limit)
        url.searchParams.append('format', this.format)
        url.searchParams.append('email', this.email)
        url.searchParams.append('dedupe', 0) // Returns doublon
        url.searchParams.append(`polygon_${this.format}`)

        url.searchParams.append('q', location)
        // Add exclude place
        if (this.excludePlaces.length > 0) {
            url.searchParams.append('exclude_place_ids', this.excludePlaces.join(','))
        }


    }
}