import { gpx, kml }                     from '@tmcw/togeojson'
import { getGeom }                      from '@turf/invariant'
import {
    JUST_ICON, MARKER_SIZE,
}                                       from '../Utils/cesium/MarkerUtils'
import {
    FEATURE_COLLECTION, FEATURE_LINE_STRING, FEATURE_MULTILINE_STRING, FEATURE_POINT,
}                                       from '../Utils/cesium/TrackUtils'
import { POI }                          from './POI'
import { NO_DEM_SERVER, Track }         from './Track'
import { JOURNEYS_STORE, ORIGIN_STORE } from './VT3D'

export class Journey {

    tracks = new Map()          // List of tracks
    pois = new Map()            // List of pois
    poisOnLimits = true               // Add POIs start/stop on journey limits or on each track
    type                                       // File type  GPX,KML,GEOJSON  //TODO KMZ

    visible = true                    // All is visible or hidden
    title = ''                          // Journey Title
    slug = ''                           // Journey slug
    description                                // Journey description

    geoJson                                    // geoJson
    origin                                     // initial geoJson

    geoJson                                    // All data are translated to GeoJson
    attributes = [
        'title',
        'visible',
        'pois',
        'tracks',
        'type',
    ]

    constructor(title, type, options) {
        this.title = this.singleTitle(title)
        this.type = type

        // If options property exists, we get them, else
        // we set the value to a default.
        this.slug = options.slug ?? _utils.app.slugify(`${title}-${type}`)
        this.visible = options.visible ?? true
        this.description = options.description ?? 'This is a journey'

        this.DEMServer = options.DEMServer ?? NO_DEM_SERVER

        // Transform content to GeoJson
        this.extractGeoJson(options.content ?? '')

        // Get all tracks
        this.extractTracks()

        // Get all POIs
        this.extractPOIs()

        // this.save()
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
     * Clone a Journey Instance
     *
     * @param options {slug}
     * @return {Journey} the new journey
     */
    static clone = (source, exceptions = {}) => {
        const journey = new Journey(source.title, source.type, exceptions)

        source.attributes.forEach(attribute => {
            if (exceptions[attribute]) {
                // TODO manage exceptions for markers
                journey[attribute] = exceptions[attribute]
            } else {
                //Specific case for markers, we need to rebuild the Map
                if (attribute === 'markers') {
                    if (source[attribute] instanceof Array) {
                        const tmpMarkers = new Map()
                        source[attribute].forEach(marker => {
                            tmpMarkers.set(marker.slug, POI.clone(marker))
                        })
                        source[attribute] = tmpMarkers
                    }
                }
                journey[attribute] = source[attribute]
            }
        })
        return journey
    }

    /**
     * create a single title for the journey
     *
     * @param title       the titleto check
     * @return {string}   the single title
     *
     */
    singleTitle = title => {
        return _utils.app.singleTitle(title, vt3d.journeys)
    }

    /**
     * Get the theJourney data and set the GeoJson Structure
     *
     * @param content content of the theJourney file
     *
     * @exception {any} in case of ay error, we return undefined
     */
    extractGeoJson = (content) => {
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
    extractTracks = () => {
        if (this.geoJson.type === FEATURE_COLLECTION) {
            this.geoJson.features.forEach((feature, index) => {
                const geometry = getGeom(feature)
                const title = feature.properties.name
                if ([FEATURE_LINE_STRING, FEATURE_MULTILINE_STRING].includes(geometry.type)) {
                    // Let's define some tracks parameters
                    const parameters = {
                        parent: this.slug,
                        name: feature.properties.name,
                        slug: _utils.app.slugify(`${feature.properties.name}`),
                        hasTime: this.#hasTime(feature.properties),
                        hasAltitude: this.#hasAltitude(geometry.coordinates),
                        description: feature.properties.desc,
                        segments: geometry.coordinates.length,
                        content: feature,
                        visible: true,
                    }
                    this.tracks.set(parameters.slug, new Track(title, geometry.type, parameters))
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
    extractPOIs = () => {
        if (this.geoJson.type === FEATURE_COLLECTION) {
            const justTracks = []
            // Extracts all POIs from FEATURE_POINT data and adds
            // POI on track limits
            this.geoJson.features.forEach((feature, index) => {
                const geometry = getGeom(feature)
                const common = {
                    description: feature.properties.desc,
                    parent: this.slug,
                    type: JUST_ICON,
                    size: MARKER_SIZE,
                    foregroundColor: vt3d.configuration.track.markers.color,
                    visible: true,
                }
                switch (geometry.type) {
                    case FEATURE_POINT: {
                        // Create a POI
                        const point = geometry.coordinates
                        const parameters = {
                            name: feature.properties.name,
                            slug: this.#setMarkerSlug(index),
                            coordinates: [point[0], point[1]],
                            altitude: point[2] ?? undefined,
                            time: feature.properties?.time ?? undefined,
                            icon: {
                                type: feature.properties?.type,
                                symbol: feature.properties?.sym,
                            },
                        }
                        this.pois.set(parameters.slug, new POI({...common, ...parameters}))
                        break
                    }
                    case FEATURE_MULTILINE_STRING:
                    case FEATURE_LINE_STRING :
                        // Create Track Start Flag
                        const start = geometry.coordinates[0]
                        const timeStart = this.hasTime ? feature.properties.coordinateProperties.times[0] : undefined
                        const startParameters = {
                            name: 'Track start',
                            slug: this.#setMarkerSlug(`${FLAG_START}-${index}`),
                            coordinates: [start[0], start[1]],
                            altitude: start[2] ?? undefined,
                            time: timeStart,
                            icon: {
                                symbol: FLAG_START,
                            },
                        }
                        this.pois.set(startParameters.slug, new POI({...common, ...startParameters}))
                        justTracks.push(startParameters.slug)

                        // Create Track Stop Flag
                        const stop = feature.geometry.coordinates[0]
                        const timeStop = this.hasTime ? feature.properties.coordinateProperties.times[geometry.coordinates.length - 1] : undefined
                        const stopParameters = {
                            name: 'Track stop',
                            slug: this.#setMarkerSlug(`${FLAG_STOP}-${index}`),
                            coordinates: [stop[0], stop[1]],
                            altitude: stop[2] ?? undefined,
                            time: timeStop,
                            icon: {
                                symbol: FLAG_START,
                            },
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
     * Define the slug of a marker
     *
     * @param id {string|number}
     * @return {`marker#${string}#${string}`}
     */
    #setMarkerSlug = (id) => {
        return `poi#${this.slug}#${_utils.app.slugify(id)}`
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
        // Markers are transformed to objects
        let temp = Journey.clone(this, {slug: this.slug})
        let markers = temp.markers
        temp.markers = []
        markers.forEach((marker, key) => {
            temp.markers.push(POI.extractObject(marker))
        })
        await vt3d.db.journeys.put(this.slug, temp.extractObject(), JOURNEYS_STORE)
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
}

export const GPX = 'gpx'
export const KML = 'kml'
export const KMZ = 'kmz'
export const GEOJSON = 'geojson'

export const FLAG_START = 'start'
export const FLAG_STOP = 'stop'
