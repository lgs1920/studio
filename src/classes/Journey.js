import { gpx, kml }                     from '@tmcw/togeojson'
import { getGeom }                      from '@turf/invariant'
import {
    JUST_ICON, MARKER_SIZE,
}                                       from '../Utils/cesium/MarkerUtils'
import {
    FEATURE_COLLECTION, FEATURE_LINE_STRING, FEATURE_MULTILINE_STRING, FEATURE_POINT,
}                                       from '../Utils/cesium/TrackUtils'
import { MapElement }                   from './MapElement'
import { POI }                          from './POI'
import { Track }                        from './Track'
import { JOURNEYS_STORE, ORIGIN_STORE } from './VT3D'

export class Journey extends MapElement {

    tracks = new Map()          // List of tracks
    pois = new Map()            // List of pois
    poisOnLimits = true               // Add POIs start/stop on journey limits or on each track
    type                                       // File type  GPX,KML,GEOJSON  //TODO KMZ

    title = ''                          // Journey Title

    origin                                     // initial geoJson


    constructor(title, type, options) {
        super()
        this.title = this.singleTitle(title)
        this.type = type

        // If options property exists, we get them, else
        // we set the value to a default.
        this.slug = options.slug ?? _.app.slugify(`${title}-${type}`)
        this.visible = options.visible ?? true
        this.description = options.description ?? 'This is a journey'

        this.DEMServer = options.DEMServer ?? NO_DEM_SERVER

        // Transform content to GeoJson
        this.getGeoJson(options.content ?? '')

        // Get all tracks
        this.getTracks()

        // Get all POIs
        this.getPOIs()

        //Finally save it in DB
        this.save()
    }

    /**
     * Get all journeys from DB
     *
     * Each journey is added to the global context
     *
     * @return {Promise<Awaited<unknown>[]|*[]>}
     */
    static readAll = async () => {
        try {
            // get all slugs
            const slugs = await vt3d.db.journeys.keys(JOURNEYS_STORE)
            // Get each journey content
            const journeyPromises = slugs.map(async (slug) => {
                const object = await vt3d.db.journeys.get(slug, JOURNEYS_STORE)
                const journey = Journey.clone(object, {slug: slug})
                journey.addToContext()
                return journey
            })
            return await Promise.all(journeyPromises)
        } catch (error) {
            console.error('Error when trying to get journeys from browser database :', error)
            return []
        }

    }

    /**
     * create a single title for the journey
     *
     * @param title       the titleto check
     * @return {string}   the single title
     *
     */
    singleTitle = title => {
        return _.app.singleTitle(title, vt3d.journeys)
    }

    /**
     * Get the theJourney data and set the GeoJson Structure
     *
     * @param content content of the theJourney file
     *
     * @exception {any} in case of ay error, we return undefined
     */
    getGeoJson = (content) => {
        // We translate kml and gpx to GeoJson format in order to manipulate json
        // instead of XML
        try {
            let geoJson
            switch (this.type) {
                case 'gpx':
                    this.geoJson = gpx(new DOMParser().parseFromString(content, 'text/xml'))
                    break
                case 'kmz' :
                    // TODO unzip to get kml. but what to do with the assets files that are sometimes embedded
                    break
                case 'kml':
                    this.geoJson = kml(new DOMParser().parseFromString(content, 'text/xml'))
                    break
                case 'geojson' :
                    this.geoJson = JSON.parse(content)
            }
            //Save original data
            this.origin = this.geoJson

        } catch (error) {
            console.error(error)
            // Error => we notify
            UINotifier.notifyError({
                caption: `An error occurs during loading <strong>${trackFile.title}<strong>!`, text: error,
            })
            this.geoJson = undefined
        }
    }

    /**
     * Extract tracks from GeoJson
     *
     * Populate this.tracks
     *
     */
    getTracks = () => {
        if (this.geoJson.type === FEATURE_COLLECTION) {
            this.geoJson.features.forEach((feature, index) => {
                const geometry = getGeom(feature)
                const title = feature.properties.name
                if ([FEATURE_LINE_STRING, FEATURE_MULTILINE_STRING].includes(geometry.type)) {
                    // Let's define some tracks parameters
                    const parameters = {
                        parent: this.slug,
                        name: feature.properties.name,
                        slug: this.#setTrackSlug(feature.properties.name),
                        hasTime: this.#hasTime(feature.properties),
                        hasAltitude: this.#hasAltitude(geometry.coordinates),
                        description: feature.properties.desc,
                        segments: geometry.coordinates.length,
                        content: feature,
                        visible: true,
                        geoJson: feature,
                    }
                    this.tracks.set(parameters.slug, new Track(title, parameters))
                }
            })
        }
    }

    #hasTime = (properties) => {
        return properties?.coordinateProperties?.times !== undefined
    }

    #hasAltitude = (coordinates) => {
        return coordinates[0][0].length === 3
    }

    /**
     * Extract pois from GeoJson
     *
     * Populate this.pois
     *
     */
    getPOIs = () => {
        if (this.geoJson.type === FEATURE_COLLECTION) {
            const justTracks = []
            // Extracts all POIs from FEATURE_POINT data and adds
            // POI on track limits
            this.geoJson.features.forEach((feature, index) => {
                const geometry = getGeom(feature)
                const common = {
                    description: feature.properties.desc,
                    size: MARKER_SIZE,
                    foregroundColor: vt3d.configuration.journey.pois.color,
                    visible: true,
                }
                switch (geometry.type) {
                    case FEATURE_POINT: {
                        // Create a POI
                        const point = geometry.coordinates
                        const parameters = {
                            parent: this.slug,
                            name: feature.properties.name,
                            slug: this.#setPOISlug(index),
                            coordinates: [point[0], point[1]],
                            altitude: point[2] ?? undefined,
                            time: feature.properties?.time ?? undefined,
                            type: JUST_ICON,
                            icon: feature.properties?.sym ?? feature.properties?.type,
                        }
                        this.pois.set(parameters.slug, new POI({...common, ...parameters}))
                        break
                    }
                    case FEATURE_LINE_STRING :
                        geometry.coordinates = [geometry.coordinates]
                    case FEATURE_MULTILINE_STRING:
                        // Create Track Start Flag
                        const start = geometry.coordinates[0][0]
                        const timeStart = this.hasTime ? feature.properties.coordinateProperties.times[0] : undefined
                        const startParameters = {
                            parent: this.#setTrackSlug(feature.properties.name),
                            name: 'Track start',
                            slug: this.#setPOISlug(`${FLAG_START}-${index}`),
                            coordinates: [start[0], start[1]],
                            altitude: start[2] ?? undefined,
                            time: timeStart,
                            type: JUST_ICON,
                            icon: FLAG_START,
                        }
                        this.pois.set(startParameters.slug, new POI({...common, ...startParameters}))
                        justTracks.push(startParameters.slug)

                        // Create Track Stop Flag
                        const length = geometry.coordinates.length - 1
                        const last = geometry.coordinates[length].length - 1
                        const stop = feature.geometry.coordinates[length][last]

                        const timeStop = this.hasTime ? feature.properties.coordinateProperties.times[geometry.coordinates.length - 1] : undefined
                        const stopParameters = {
                            parent: this.#setTrackSlug(feature.properties.name),
                            name: 'Track stop',
                            slug: this.#setPOISlug(`${FLAG_STOP}-${index}`),
                            coordinates: [stop[0], stop[1]],
                            altitude: stop[2] ?? undefined,
                            time: timeStop,
                            type: JUST_ICON,
                            icon: FLAG_START,
                        }
                        this.pois.set(stopParameters.slug, new POI({...common, ...stopParameters}))
                        justTracks.push(stopParameters.slug)
                        break
                }

            })

            // If we need to have POIs on limits only (ie first on first track, last of last track)
            // we adapt the visibility

            if (this.poisOnLimits) {
                justTracks.forEach((poi, index) => {
                    const last = poi.split('#')[2]
                    if (last.startsWith(FLAG_START) || last.startsWith(FLAG_STOP)) {
                        this.pois.get(poi).visible = index === 0 || index === justTracks.length - 1
                    }
                })

            }
        }
    }

    /**
     * Define the slug of a POI
     *
     * @param id {string|number}
     * @return {`poi#${string}#${string}`}
     */
    #setPOISlug = (id) => {
        return `poi#${this.slug}#${_.app.slugify(id)}`
    }

    /**
     * Define the slug of a track
     *
     * @param id {string|number}
     * @return {`track#${string}#${string}`}
     */
    #setTrackSlug = (id) => {
        return `track#${this.slug}#${_.app.slugify(id)}`
    }

    /**
     * Read a journey
     *
     * @param store
     * @return {Promise<void>}
     */
    read = async (store = '') => {
        // TODO read data and add origine
    }

    /**
     * Save a journey to DB
     *
     * @return {Promise<void>}
     */
    save = async () => {
        await vt3d.db.journeys.put(this.slug, this.serialize(), JOURNEYS_STORE)
    }

    /**
     * Save journey original data to DB
     *
     * @type {boolean}
     */
    saveOrigin = async () => {
        await vt3d.db.journeys.put(this.slug, this.geoJson, ORIGIN_STORE)
    }

    /**
     * Remove a journey fromDB
     *
     * @return {Promise<void>}
     */
    remove = async () => {
        if (this.origin === undefined) {
            await vt3d.db.journeys.delete(this.slug, ORIGIN_STORE)
        }

        await vt3d.db.journeys.delete(this.slug, JOURNEYS_STORE)
    }

    /**
     * Add this theJourney to the application context
     *
     */
    addToContext = (setToCurrent = true) => {
        vt3d.saveJourney(this)
        if (setToCurrent) {
            vt3d.theJourney = this
        }
    }

    draw = async (action = INITIAL_LOADING, mode = DRAW_ANIMATE) => {
        const tracks = []
        for (const track of this.tracks.values()) {
            tracks.push(await track.draw(action, mode))
        }
        await Promise.all(tracks)

        const pois = []
        for (const poi of this.pois.values()) {
            pois.push(await poi.draw())
        }
        await Promise.all(pois)

    }

    serialize(json = false) {
        return super.serialize(json)
    }

}

export const GPX = 'gpx'
export const KML = 'kml'
export const KMZ = 'kmz'
export const GEOJSON = 'geojson'

export const FLAG_START = 'start'
export const FLAG_STOP = 'stop'

export const NO_DEM_SERVER = 'none'
export const SIMULATE_ALTITUDE = 'simulate-altitude'
export const INITIAL_LOADING = 1
export const RE_LOADING = 2
export const DRAW_ANIMATE = 1
export const DRAW_SILENT = 2