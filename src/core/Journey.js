import { gpx, kml }                     from '@tmcw/togeojson'
import {
    getGeom,
}                                       from '@turf/invariant'
import {
    JUST_ICON,
}                                       from '@Utils/cesium/POIUtils'
import {
    FEATURE_COLLECTION, FEATURE_LINE_STRING, FEATURE_MULTILINE_STRING, FEATURE_POINT, TrackUtils,
}                                       from '@Utils/cesium/TrackUtils'
import {
    UIToast,
}                                       from '@Utils/UIToast'
import {
    MapElement,
}                                       from './MapElement'
import { POI, POI_VERTICAL_ALIGN_TOP }  from './POI'
import { Track }                        from './Track'
import {
    Camera,
}                                       from './ui/Camera.js'
import { JOURNEYS_STORE, ORIGIN_STORE } from './VT3D'

export class Journey extends MapElement {

    tracks = new Map()          // List of tracks
    pois = new Map()            // List of pois
    poisOnLimits = true               // Add POIs start/stop on journey limits or on each track
    type                                       // File type  GPX,KML,GEOJSON  //TODO KMZ

    title = ''                          // Journey Title

    origin                                     // initial geoJson
    POIsVisible = true

    metrics = {}
    camera = {}
    cameraOrigin = {}

    constructor(title, type, options) {
        super()

        const save = async () => {
            await this.saveToDB()
        }

        if (title) {
            this.title = this.singleTitle(title)
            this.type = type

            // If options property exists, we get them, else
            // we set the value to a default.
            this.slug = options.slug ?? __.app.slugify(`${title}-${type}`)
            this.visible = options.visible ?? true
            this.POIsVisible = options.POIsVisible ?? true

            this.description = options.description ?? ''

            this.DEMServer = options.DEMServer ?? NO_DEM_SERVER

            this.camera = options.camera ?? null


            // Transform content to GeoJson
            this.getGeoJson(options.content ?? '')

            // Get all tracks
            this.getTracksFromGeoJson()

            // Get Metrics
            this.metrics = options.metrics ?? {}

            // Get all POIs
            this.getPOIsFromGeoJson()

            // Finally saveToDB
            save().then()


            const prepare = async () => {
                await this.prepareDrawing()
            }
            prepare()

        }

        /**
         * If we're on the current journey, we register to the camera updates events
         * in order to save camera information
         */
        vt3d.events.on(Camera.UPDATE_EVENT, (data) => {
            if (data) {
                console.log(data,
                )
            }
            if (this.isCurrent()) {
                this.camera = __.ui.camera.get()
                vt3d.saveJourney(this)
                this.addToContext()
                vt3d.theJourney.camera = this.camera
                save()
            }
        })
    }

    /**
     * Get all journeys from DB
     *
     * Each journey is added to the global context
     *
     * @return {Promise<Awaited<unknown>[]|*[]>}
     */
    static readAllFromDB = async () => {
        try {
            // get all slugs
            const slugs = await vt3d.db.journeys.keys(JOURNEYS_STORE)
            // Get each journey content
            const journeyPromises = slugs.map(async (slug) => {
                const object = await vt3d.db.journeys.get(slug, JOURNEYS_STORE)
                const journey = Journey.deserialize({object: object})
                return journey
            })
            return await Promise.all(journeyPromises)
        } catch (error) {
            console.error('Error when trying to get journeys from browser database :', error)
            return []
        }

    }

    static deserialize = (props) => {
        props.instance = new Journey()
        let instance = super.deserialize(props)

        // Transform POIs from object to class
        instance.pois.forEach((poi, slug) => {
            instance.pois.set(slug, new POI(poi))
        })

        // Transform Tracks from object to class
        instance.tracks.forEach((track, slug) => {
            const object = new Track(track.title, track)
            object.flags.start = new POI(object.flags.start)
            object.flags.stop = new POI(object.flags.stop)
            instance.tracks.set(slug, new Track(track.title, track))
        })

        return instance

    }

    static unproxify = (object) => {
        return super.serialize({...object, ...{__class: Journey}})
    }

    /**
     * Check if it is the current Journey
     *
     * @return {boolean}
     */
    isCurrent = () => {
        return vt3d.theJourney && vt3d.theJourney.slug === this.slug
    }

    prepareDrawing = async () => {
        await TrackUtils.prepareDrawing(this)
    }

    /**
     * create a single title for the journey
     *
     * @param title       the titleto check
     * @return {string}   the single title
     *
     */
    singleTitle = title => {
        return __.app.singleTitle(title, vt3d.journeys)
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
            switch (this.type) {
                case GPX:
                    this.geoJson = gpx(new DOMParser().parseFromString(content, 'text/xml'))
                    break
                case KMZ :
                    // TODO unzip to get kml. but what to do with the assets files that are sometimes embedded
                    break
                case KML:
                    this.geoJson = kml(new DOMParser().parseFromString(content, 'text/xml'))
                    break
                case GEOJSON :
                    this.geoJson = JSON.parse(content)
            }
            //Save original data
            this.origin = this.geoJson

        } catch (error) {
            console.error(error)
            // Error => we notify
            UIToast.error({
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
    getTracksFromGeoJson = () => {
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
                        hasAltitude: this.#hasAltitude(geometry),
                        description: feature.properties.desc ?? '',
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

    /**
     * Check if data contains time information
     *
     * @param properties
     * @return {boolean}
     */
    #hasTime = (properties) => {
        return properties?.coordinateProperties?.times !== undefined
    }

    /**
     * Check if data contains altitude
     *
     * @param geometry
     * @return {boolean}
     */
    #hasAltitude = (geometry) => {
        switch (geometry.type) {
            // We check the length of the points coordinates
            case FEATURE_LINE_STRING:
                return geometry.coordinates[0].length === 3
            case FEATURE_MULTILINE_STRING:
                return geometry.coordinates[0][0].length === 3
        }
    }

    /**
     * Extract pois from GeoJson
     *
     * Populate this.pois
     *
     */
    getPOIsFromGeoJson = () => {

        if (this.geoJson.type === FEATURE_COLLECTION) {
            const flags = []
            // Extracts all POIs from FEATURE_POINT data and adds
            // POI on track limits
            this.geoJson.features.forEach((feature, index) => {
                const geometry = getGeom(feature)
                const common = {
                    description: feature.properties.desc, size: vt3d.POI_DEFAULT_SIZE, visible: true,
                }

                // We need to change coordinates array if it is a line string
                let coordinates = []
                let times = []
                switch (geometry.type) {
                    case FEATURE_LINE_STRING :
                        coordinates = [geometry.coordinates]
                        times = [feature?.properties?.coordinateProperties?.times]
                        break
                    case FEATURE_MULTILINE_STRING :
                        coordinates = geometry.coordinates
                        times = feature?.properties?.coordinateProperties?.times
                        break
                }

                // We build the POI
                switch (geometry.type) {
                    case FEATURE_POINT: {
                        // Create a POI
                        const point = geometry.coordinates
                        const parameters = {
                            journey: this.slug,
                            name: feature.properties.name,
                            slug: this.#setPOISlug(index),
                            coordinates: [point[0], point[1]],
                            altitude: point[2] ?? undefined,
                            time: feature.properties?.time ?? undefined,
                            type: JUST_ICON,
                            icon: feature.properties?.sym ?? feature.properties?.type,
                            foregroundColor: vt3d.configuration.journey.pois.color,
                        }
                        this.pois.set(parameters.slug, new POI({...common, ...parameters}))
                        break
                    }
                    case FEATURE_LINE_STRING :
                    case FEATURE_MULTILINE_STRING:
                        const parentSlug = this.#setTrackSlug(feature.properties.name)
                        // Create Track Start Flag
                        const start = coordinates[0][0]
                        const timeStart = this.#hasTime(feature.properties) ? times[0][0] : undefined
                        const startParameters = {
                            track: parentSlug,
                            journey: this.slug,
                            name: 'Track start',
                            slug: this.#setPOISlug(`${__.app.slugify(feature.properties.name)}-${FLAG_START}`, POI_FLAG),
                            coordinates: [start[0], start[1]],
                            altitude: start[2] ?? undefined,
                            time: timeStart,
                            type: JUST_ICON,
                            icon: FLAG_START,
                            verticalOrigin: POI_VERTICAL_ALIGN_TOP,
                            foregroundColor: vt3d.configuration.journey.pois.start.color,
                        }
                        const startFlag = new POI({...common, ...startParameters})
                        this.tracks.get(parentSlug).flags.start = startFlag
                        flags.push(startFlag)

                        // Create Track Stop Flag
                        const length = coordinates.length - 1
                        const last = coordinates[length].length - 1
                        const stop = coordinates[length][last]

                        const timeStop = this.#hasTime(feature.properties) ? times[length][last] : undefined
                        const stopParameters = {
                            track: parentSlug,
                            journey: this.slug,
                            name: 'Track stop',
                            slug: this.#setPOISlug(`#${__.app.slugify(feature.properties.name)}-${FLAG_STOP}`, POI_FLAG),
                            coordinates: [stop[0], stop[1]],
                            altitude: stop[2] ?? undefined,
                            time: timeStop,
                            type: JUST_ICON,
                            icon: FLAG_STOP,
                            verticalOrigin: POI_VERTICAL_ALIGN_TOP,
                            foregroundColor: vt3d.configuration.journey.pois.stop.color,
                        }
                        const stopFlag = new POI({...common, ...stopParameters})
                        this.tracks.get(parentSlug).flags.stop = stopFlag
                        flags.push(stopFlag)

                        break
                }

            })

            // If we need to have Flags  on limits only (ie first on first track, last of last track)
            // we adapt the visibility for the flagged POIs
            if (this.poisOnLimits) {
                flags.forEach((poi, index) => {
                    this.tracks.get(poi.track).flags[(poi.slug.endsWith(FLAG_START)) ? 'start' : 'stop'].visible = (index === 0 || index === (flags.length - 1))
                })
            }
        }
    }

    /**
     * Define the slug of a POI
     *
     * @param suffix {string|number}
     * @param prefix  {string|number} optional (default = poi)
     *
     * @return {string}
     */
    #setPOISlug = (suffix, prefix = 'poi') => {
        return this.#setSlug(suffix, prefix)
    }

    /**
     * Define the slug of a track
     **
     * @param suffix {string|number}
     * @param prefix {string|number}
     *
     * @return {string}
     */
    #setTrackSlug = (suffix, prefix = 'track') => {
        return this.#setSlug(suffix, prefix)
    }

    /**
     * Define ageneric slug
     *
     * @param suffix {string|number}
     * @param prefix {string|number}
     *
     * @return {string}
     */
    #setSlug = (suffix, prefix = '') => {
        return `${__.app.slugify(prefix)}#${this.slug}#${__.app.slugify(suffix)}`
    }

    /**
     * Read a journey
     *
     * @param store
     * @return {Promise<void>}
     */
    readFromDB = async (store = '') => {
        // TODO read data and add origine
    }

    /**
     * Save a journey to DB
     *
     * @return {Promise<void>}
     */
    saveToDB = async () => {
        await vt3d.db.journeys.put(this.slug, Journey.unproxify(this), JOURNEYS_STORE)
    }

    /**
     * Save journey original data to DB
     *
     * @type {boolean}
     */
    saveOriginDataToDB = async () => {
        await vt3d.db.journeys.put(this.slug, this.geoJson, ORIGIN_STORE)
    }

    /**
     * Remove a journey fromDB
     *
     * @return {Promise<void>}
     */
    removeFromDB = async () => {
        await vt3d.db.journeys.delete(this.slug, ORIGIN_STORE)
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

    addToEditor = () => {
        vt3d.theJourneyEditorProxy.journey = this
    }

    /**
     * Draw the full Journey (all Tracks and POIs)
     *
     * Tracks with attached flags are first drawn then we add all POIs
     *
     * @param action
     * @param mode
     * @return {Promise<void>}
     */
    draw = async ({action = INITIAL_LOADING, mode = FOCUS_ON_FEATURE}) => {
        const promises = []

        // Draw Tracks and flags
        this.tracks.forEach(track => {
            // If journey is not visible, we force tracks to be hidden, whatever their visibility
            // else we use their status.
            promises.push(track.draw({
                action: action, mode: NO_FOCUS, forcedToHide: !this.visible,
            }))
        })
        // Draw POIs
        this.pois.forEach(poi => {
            promises.push(poi.draw(this.POIsVisible))
        })

        await Promise.all(promises)

        //Ready
        UIToast.success({
            caption: `${this.title}`, text: 'loaded succesfully!',
        })

        if (mode === FOCUS_ON_FEATURE) {
            this.focus({action: action})
        }


    }

    focus = () => {
        TrackUtils.focus(this)
    }

    showAfterHeightSimulation = async () => {
        await this.draw(SIMULATE_ALTITUDE)
    }

    updateVisibility = (visibility) => {
        TrackUtils.updateJourneyVisibility(this, visibility)
    }

    setGlobalMetrics = () => {

        const allMetrics = []

        this.tracks.forEach(track => allMetrics.push(track.metrics.global))

        let global = {}, tmp = []

        // Min Height
        global.minHeight = this.hasAltitude ? Math.min(...allMetrics.map(a => a?.altitude)) : undefined

        // Max Height
        global.maxHeight = this.hasAltitude ? Math.max(...allMetrics.map(a => a?.altitude)) : undefined

        // If the first have duration time, all the data set have time
        if (this.hasTime) {
            // Max speed
            tmp = TrackUtils.filterArray(allMetrics, {
                speed: speed => speed !== 0 && speed !== undefined,
            })
            global.maxSpeed = Math.max(...tmp.map(a => a?.speed))

            // Average speed (we exclude 0 and undefined values)
            global.averageSpeed = tmp.reduce((s, o) => {
                return s + o.speed
            }, 0) / tmp.length

            // Todo  Add average speed in motion

            // Max Pace
            global.maxPace = Math.max(...tmp.map(a => a?.pace))

            // Todo  Add average pace in motion
        }

        if (this.hasAltitude) {
            // Max Slope
            global.maxSlope = this.hasAltitude ? Math.max(...allMetrics.map(a => a?.slope)) : undefined

            // Positive elevation and distance
            global.positiveElevation = 0
            global.positiveDistance = 0
            allMetrics.forEach((point) => {
                if (point.elevation > 0) {
                    global.positiveElevation += point.elevation
                    global.positiveDistance += point.distance
                }
            })

            // Negative elevation
            global.negativeElevation = 0
            global.negativeDistance = 0
            allMetrics.forEach((point, index) => {
                if (point.elevation < 0) {
                    global.negativeElevation += point.elevation
                    global.negativeDistance += point.distance
                }
            })
        }
        // Total duration
        global.duration = allMetrics.reduce((s, o) => {
            return s + o.duration
        }, 0)

        // Total Distance
        global.distance = allMetrics.reduce((s, o) => {
            return s + o.distance
        }, 0)

        this.metrics = global
    }

    /**
     * Extract the Metrics
     *
     * We loop over tracks to compute tracks metrics
     */
    extractMetrics = () => {
        this.tracks.forEach(track => {
            track.extractMetrics()
        })

        if (this.tracks.size === 1) {
            this.metrics = this.tracks.entries().next().value[1].metrics
            return
        }
        this.metrics = this.setGlobalMetrics()
    }

}

export const GPX = 'gpx'
export const KML = 'kml'
export const KMZ = 'kmz'
export const GEOJSON = 'geojson'

export const FLAG_START = 'start'
export const FLAG_STOP = 'stop'
export const POI_FLAG = 'flag'
export const POI_STD = 'poi'
export const TRACK_SLUG = 'track'

export const NO_DEM_SERVER = 'none'
export const SIMULATE_ALTITUDE = 'simulate-altitude'
export const INITIAL_LOADING = 1
export const RE_LOADING = 2
export const FOCUS_ON_FEATURE = 1
export const NO_FOCUS = 2