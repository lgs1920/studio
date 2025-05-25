/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Journey.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-05-25
 * Last modified: 2025-05-25
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import {
    CURRENT_JOURNEY, DRAWING_FROM_DB, DRAWING_FROM_UI, FOCUS_ON_FEATURE, GEOJSON, GPX, JOURNEYS_STORE, JSON_, KML, KMZ,
    NO_FOCUS, ORIGIN_STORE, POI_FLAG_START, POI_FLAG_STOP, POI_STANDARD_TYPE, REFRESH_DRAWING, SIMULATE_ALTITUDE,
    TRACK_SLUG, UPDATE_JOURNEY_SILENTLY,
}                   from '@Core/constants'
import { MapPOI }   from '@Core/MapPOI'
import { gpx, kml } from '@tmcw/togeojson'
import { getGeom }  from '@turf/invariant'

import {
    FEATURE_COLLECTION, FEATURE_LINE_STRING, FEATURE_MULTILINE_STRING, FEATURE_POINT, TrackUtils,
}                          from '@Utils/cesium/TrackUtils'
import { UIToast }         from '@Utils/UIToast'
import { ElevationServer } from './Elevation/ElevationServer'
import { MapElement }      from './MapElement'
import { Track }           from './Track'


export class Journey extends MapElement {

    tracks = new Map()          // List of tracks
    pois = []            // List of pois
    poisOnLimits = true               // Add POIs start/stop on journey limits or on each track
    type                                       // File type  GPX,KML,GEOJSON  //TODO KMZ

    title = ''                          // Journey Title

    origin                                     // initial geoJson
    POIsVisible = true

    metrics = {}
    camera = {}
    cameraOrigin = {}

    hasElevation = false
    hasTime = false

    constructor(title, type, options) {
        super(CURRENT_JOURNEY)


        if (title) {
            this.title = (options.allowRename ?? true) ? this.singleTitle(title) : title

            this.type = type

            // If options property exists, we get them, else
            // we set the value to a default.
            this.slug = options.slug ?? __.app.setSlug({content: [title, type]})
            this.visible = options.visible ?? true
            this.POIsVisible = options.POIsVisible ?? true

            this.description = options.description ?? ''

            this.camera = options.camera ?? null



        }

    }

    /**
     * Creates and initializes a new Journey instance with the specified parameters.
     *
     * @param {string} title - The title of the journey.
     * @param {string} type - The type of the journey.
     * @param {Object} options - Additional options for initializing the journey.
     * @return {Promise<Journey>} A promise that resolves to the created and initialized Journey instance.
     */
    static async create(title, type, options) {
        const journey = new Journey(title, type, options)
        await journey.initializeJourney(options)
        return journey
    }

    /**
     * Asynchronously initializes the journey by executing a series of tasks in sequence.
     *
     * The method performs the following steps:
     * 1. Fetches points of interest (POIs) data from a GeoJSON file.
     * 2. Saves the fetched data to the database.
     * 3. Prepares the visual drawing or configuration for the initialized journey.
     *
     * If any step fails, an error is caught and logged to the console.
     *
     * This method is designed to be called at the start of the journey initialization process.
     *
     * @async
     * @function
     * @throws Will log an error to the console if any of the asynchronous operations fail.
     */
    initializeJourney = async (options) => {
        try {
            // Transform content to GeoJson
            this.getGeoJson(options.content ?? '')

            // Get all tracks
            this.getTracksFromGeoJson()

            this.globalSettings()

            // Get Metrics
            this.metrics = options.metrics ?? {}

            this.prepareDrawing().then(async () => {
                await this.getPOIsFromGeoJson()
                await this.persistToDatabase()
            })
        }
        catch (error) {
            console.error('Failed to initialize journey:', error)
        }
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
            const slugs = await lgs.db.lgs1920.keys(JOURNEYS_STORE)
            // Get each journey content
            const journeyPromises = slugs.map(async (slug) => {
                return Journey.deserialize(
                    {
                        object: await lgs.db.lgs1920.get(slug, JOURNEYS_STORE),
                        reset:  true,
                    },
                )
            })
            return await Promise.all(journeyPromises)
        }
        catch (error) {
            console.error('Error when trying to get journeys from browser database :', error)
            return []
        }

    }

    static deserialize = (props) => {
        props.instance = new Journey()
        let instance = super.deserialize(props)
        
        // Transform Tracks from object to class
        instance.tracks.forEach((track, slug) => {
            const object = new Track(track.title, track)
            instance.tracks.set(slug, new Track(track.title, object))
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
        return lgs.theJourney && lgs.theJourney.slug === this.slug
    }

    /**
     * Set some global  parameters
     *
     *   hasTime  =>  null, true , false
     *   hasElevation  =>  null, true , false
     *
     */
    globalSettings = () => {
        const tracks = Array.from(this.tracks.values())
        this.hasTime = tracks.every(track => track.hasTime) ? true :
                       (tracks.some(track => track.hasTime) ? null : false)

        this.hasElevation = tracks.every(track => track.hasAltitude) ? true :
                            (tracks.some(track => track.hasAltitude) ? null : false)

        this.elevationServer = this.hasElevation ? ElevationServer.FILE_CONTENT : ElevationServer.NONE
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
        return __.app.singleTitle(title, lgs.journeys)
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
                case JSON_:
                case GEOJSON :
                    this.geoJson = JSON.parse(content)
            }

        }
        catch (error) {
            console.error(error)
            // Error => we notify
            UIToast.error({
                              caption: `An error occurs during loading <strong>${this.title}<strong>!`, text: error,
                          })
            this.geoJson = undefined
        }
    }

    /**
     * Extract tracks from GeoJson
     *
     * Populate this.tracks
     *
     * @param keepContext {boolean} when true, we update only some data related to position
     *                              and elevation.
     *
     */
    getTracksFromGeoJson = (keepContext = false) => {
        if (this.geoJson.type === FEATURE_COLLECTION) {
            this.geoJson.features.forEach((feature) => {
                const geometry = getGeom(feature)
                const title = feature.properties.name

                const slug = this.#setTrackSlug({
                                                    content: [
                                                        this.slug,
                                                        feature.properties.name,
                                                    ],
                                                })
                const track = keepContext ? this.tracks.get(slug) : null

                if ([FEATURE_LINE_STRING, FEATURE_MULTILINE_STRING].includes(geometry.type)) {
                    // Let's define some tracks parameters
                    const parameters = {
                        parent:      this.slug,
                        name:        keepContext ? track.name : slug,
                        slug:        slug,
                        hasTime:     this.#hasTime(feature.properties),
                        hasAltitude: this.#hasAltitude(geometry),
                        description: keepContext ? track.description : feature.properties.desc ?? '',
                        segments:    geometry.coordinates.length,
                        visible:     keepContext ? track.visible : true,
                        color:       keepContext ? track.color : __.ui.editor.journey.newColor(),
                        thickness:   keepContext ? track.thickness : lgs.settings.getJourney.thickness,
                        flags:       keepContext ? track.flags : {start: undefined, stop: undefined},
                        content:     feature,
                    }
                    this.tracks.set(slug, new Track(title, parameters))
                }
            })
        }
    }

    /**
     * Get track index
     *
     * @param slug {string} track slug
     * @return {number}
     */
    getTrackIndex = slug => {
        return Array.from(this.tracks.keys()).indexOf(slug)
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
    getPOIsFromGeoJson = async () => {
        if (this.geoJson.type === FEATURE_COLLECTION) {
            // Extracts all POIs from FEATURE_POINT data and adds
            // POI on track limits

            for (const feature of this.geoJson.features) {
                const index = this.geoJson.features.indexOf(feature)
                const geometry = getGeom(feature)

                const common = {
                    description: feature.properties.desc, visible: true,
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
                        const clampedHeight = await __.ui.poiManager.getHeightFromTerrain({
                                                                                              coordinates: {
                                                                                                  longitude: point[0],
                                                                                                  latitude:  point[1],
                                                                                                  height:    point[2] ?? 0,
                                                                                              },
                                                                                          })
                        const parameters = {
                            parent:   this.slug,
                            type:            POI_STANDARD_TYPE,
                            title:           feature.properties.name,
                            description: feature.properties.description ?? '',
                            longitude:       point[0],
                            latitude:        point[1],
                            height:          point[2] ?? undefined,
                            simulatedHeight: clampedHeight,

                            time:     feature.properties?.time ?? undefined,
                            expanded: false,
                            visible:  true,
                        }
                        const poi = new MapPOI({...common, ...parameters})
                        await __.ui.poiManager.add(poi, false)
                        this.pois.push(poi.id)

                        break
                    }
                    case FEATURE_LINE_STRING :
                    case FEATURE_MULTILINE_STRING: {
                        const parentSlug = this.#setTrackSlug({
                                                                  content: [
                                                                      this.slug,
                                                                      feature.properties.name,
                                                                  ],
                                                              })
                        // Create Track Start Flag
                        const start = coordinates[0][0]
                        const timeStart = this.#hasTime(feature.properties) ? times[0][0] : undefined
                        const clampedStart = await __.ui.poiManager.getHeightFromTerrain({
                                                                                             coordinates: {
                                                                                                 longitude: start[0],
                                                                                                 latitude:  start[1],
                                                                                                 height:    start[2] ?? 0,
                                                                                             },
                                                                                         })
                        const startParameters = {
                            parent:  parentSlug,
                            type:        POI_FLAG_START,
                            title:       'Start',
                            description: 'Track start',

                            longitude:       start[0],
                            latitude:        start[1],
                            height:          start[2] ?? undefined,
                            simulatedHeight: clampedStart,

                            time:     timeStart,
                            distance: 0,

                            color:   lgs.settings.journey.pois.start.color,
                            bgColor: lgs.settings.journey.pois.start.bgColor,
                            expanded: false,
                            visible: true,
                        }
                        const startFlag = new MapPOI({...common, ...startParameters})
                        await __.ui.poiManager.add(startFlag, false)
                        this.pois.push(startFlag.id)
                        this.tracks.get(parentSlug).flags.start = startFlag.id

                        // Create Track Stop Flag
                        const length = coordinates.length - 1
                        const last = coordinates[length].length - 1
                        const stop = coordinates[length][last]

                        const timeStop = this.#hasTime(feature.properties) ? times[length][last] : undefined
                        const clampedStop = await __.ui.poiManager.getHeightFromTerrain({
                                                                                            coordinates: {
                                                                                                longitude: stop[0],
                                                                                                latitude:  stop[1],
                                                                                                height:    stop[2] ?? 0,
                                                                                            },
                                                                                        })
                        const stopParameters = {
                            parent: parentSlug,
                            type:        POI_FLAG_STOP,
                            title:       'End',
                            description: 'Track end',

                            longitude:       stop[0],
                            latitude:        stop[1],
                            height:          stop[2] ?? undefined,
                            simulatedHeight: clampedStop,

                            time:            timeStop,
                            distance: 0,

                            icon:        POI_FLAG_STOP,
                            color:           lgs.settings.getJourney.pois.stop.color,
                            expanded:        false,
                            visible: true,
                        }

                        const stopFlag = new MapPOI({...common, ...stopParameters})
                        await __.ui.poiManager.add(stopFlag, false)
                        this.pois.push(stopFlag.id)
                        this.tracks.get(parentSlug).flags.stop = stopFlag.id
                    }
                        break
                }

            }

            // If we need to have Flags  on limits only (ie first on first track, last of last track)
            // we adapt the visibility for the flagged POIs
            if (this.poisOnLimits) {
                Array.from(this.tracks.values()).forEach((track, index) => {
                    Object.assign(__.ui.poiManager.list.get(track.flags.start), {
                        visible: index === 0,
                    })
                    Object.assign(__.ui.poiManager.list.get(track.flags.stop), {
                        visible: index === this.tracks.size - 1,
                    })

                })
            }


        }
    }

    /**
     * Define the slug of a POI
     *
     * @param suffix {string|number}
     * @param content {string|number}
     * @param prefix  {string|number} optional (default = poi)
     *
     * @return {string}
     */
    #setPOISlug = ({suffix = '', content = '', prefix = POI_STD}) => {
        if (typeof content === 'number') {
            content = content.toString()
        }
        return __.app.setSlug({suffix: suffix, content: content, prefix: prefix})
    }

    /**
     * Define the slug of a track
     **
     * @param suffix {string|number}
     * @param content {string|number}
     * @param prefix {string|number}
     *
     * @return {string}
     */
    #setTrackSlug = ({suffix = '', content = '', prefix = TRACK_SLUG}) => {
        return __.app.setSlug({suffix: suffix, content: content, prefix: prefix})
    }

    /**
     * Save a journey to DB
     *
     * @return {Promise<void>}
     */
    persistToDatabase = async () => {
        await lgs.db.lgs1920.put(this.slug, Journey.unproxify(this), JOURNEYS_STORE)
    }

    /**
     * Save journey original data to DB
     *
     * @type {boolean}
     */
    saveOriginDataToDB = async () => {
        await lgs.db.lgs1920.put(this.slug, JSON.stringify(this.geoJson), ORIGIN_STORE)
    }

    /**
     * Remove a journey fromDB
     *
     * @return {Promise<void>}
     */
    removeFromDB = async () => {
        await lgs.db.lgs1920.delete(this.slug, ORIGIN_STORE)
        await lgs.db.lgs1920.delete(this.slug, JOURNEYS_STORE)
    }

    /**
     * Add this theJourney to the application context
     *
     */
    addToContext = (setToCurrent = true) => {
        lgs.saveJourneyInContext(this)
        if (setToCurrent) {
            lgs.theJourney = this
        }
    }

    addToEditor = () => {
        lgs.theJourneyEditorProxy.journey = this
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
    draw = async ({action = DRAWING_FROM_UI, mode = FOCUS_ON_FEATURE}) => {
        const promises = []

        // Draw Tracks and flags
        this.tracks.forEach(track => {
            // If journey is not visible, we force tracks to be hidden, whatever their visibility
            // else we use their status.
            promises.push(track.draw({
                                         action: action, mode: NO_FOCUS, forcedToHide: !this.visible,
                                     }))
        })

        await Promise.all(promises)

        //Ready
        const texts = new Map([
                                  [DRAWING_FROM_UI, 'Loaded succesfully!'],
                                  [DRAWING_FROM_DB, 'Loaded succesfully!'],
                                  [SIMULATE_ALTITUDE, 'Updated succesfully!'],
                                  [REFRESH_DRAWING, 'Updated succesfully!'],
                              ])
        UIToast.success({
                            caption: `${this.title}`, text: texts.get(action),
                        })

        if (mode === FOCUS_ON_FEATURE && action !== DRAWING_FROM_DB && action !== UPDATE_JOURNEY_SILENTLY) {
            this.focus({action: action, rotate: lgs.settings.ui.camera.start.rotate.journey})
        }


    }

    focus = (props = {}) => {
        props.journey = this
        props.target = this
        __.ui.sceneManager.focusOnJourney(props)
    }

    showAfterHeightSimulation = async () => {
        await this.draw({action: SIMULATE_ALTITUDE})
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
            allMetrics.forEach((point) => {
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
            // If there's ontrack we'll use the track metrics
            this.metrics = this.tracks.entries().next().value[1].metrics
            return
        }
        // For a multi track journey, let's compute journey level metrics
        this.metrics = this.setGlobalMetrics()
    }

    /**
     * Check if the current journey contains only one track
     *
     * @return {boolean}
     */
    hasOneTrack = () => {
        return this.tracks.size === 1
    }

    remove = async () => {
        // Remove from context
        lgs.journeys.delete(this.slug)
        // Remove tracks
        TrackUtils.removeAllTracks(this.slug)


        // Remove POIs bound to the track
        this.tracks.forEach(track => {
            const poisToRemove = Array.from(__.ui.poiManager.list.values())
                .filter(poi => poi.parent === track.slug)
                .map(poi => poi.id)
            poisToRemove.forEach(poiId => {
                __.ui.poiManager.remove({id: poiId, force: true})
            })
        })

        // Remove POIs bound to the journey
        const poisToRemove = Array.from(__.ui.poiManager.list.values())
            .filter(poi => poi.parent === this.slug)
            .map(poi => poi.id)
        poisToRemove.forEach(poiId => {
            __.ui.poiManager.remove({id: poiId, force: true})
        })


        // Remove journey in DB
        await this.removeFromDB()
    }

}
