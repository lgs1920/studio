/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Journey.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-19
 * Last modified: 2026-04-19
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    CURRENT_JOURNEY, DRAWING_FROM_DB, DRAWING_FROM_UI, FOCUS_ON_FEATURE, GEOJSON, GPX, JOURNEYS_STORE, JSON_, KML, KMZ,
    NO_FOCUS, ORIGIN_STORE, POI_FLAG_START, POI_FLAG_STOP, POI_STANDARD_TYPE, SIMULATE_ALTITUDE, TRACK_SLUG,
    UPDATE_JOURNEY_SILENTLY,
}                   from '@Core/constants'
import { MapPOI }   from '@Core/MapPOI'
import { gpx, kml } from '@tmcw/togeojson'
import { getGeom }  from '@turf/invariant'

import {
    FEATURE_COLLECTION, FEATURE_LINE_STRING, FEATURE_MULTILINE_STRING, FEATURE_POINT, IMPORT_LOADING_ERROR, TrackUtils,
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

    metrics = {global: {}, user: {}, eternal: {}, points: {}}
    camera = {}
    cameraOrigin = {}

    hasElevation = false
    hasTime = false

    tracksLoaded = false
    poisLoaded = false

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
     * Get metrics and union
     *
     * @return {{global: NodeJS.Global|{}, user: *|{}, union: *}}
     */
    getMetrics = () => {
        const global = this.metrics.global
        const user = this.metrics.user ?? {}
        const external = this.metrics.external ?? {}
        const points = this.metrics.points

        // Deep merge to properly handle nested objects like positive.elevation
        const deepMerge = (target, ...sources) => {
            if (!sources.length) {
                return target
            }
            const source = sources.shift()

            if (source === undefined || source === null) {
                return deepMerge(target, ...sources)
            }

            for (const key in source) {
                if (Object.prototype.hasOwnProperty.call(source, key)) {
                    const sourceValue = source[key]
                    const targetValue = target[key]

                    // Skip empty objects - they should not override existing values
                    if (sourceValue && typeof sourceValue === 'object' &&
                        !Array.isArray(sourceValue) && Object.keys(sourceValue).length === 0) {
                        continue
                    }

                    if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
                        target[key] = deepMerge(targetValue && typeof targetValue === 'object' ? {...targetValue} : {}, sourceValue)
                    }
                    else {
                        target[key] = sourceValue
                    }
                }
            }

            return deepMerge(target, ...sources)
        }

        return {
            global, external, user, points, metrics: deepMerge({}, global, external, user),
        }
    }

    getDate = () => {
        const {points} = this.getMetrics()
        return {
            start: points[0]?.time,
            stop:  points[points.length - 1]?.time,
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
            const filename = `<strong>${this.title}<strong>`
            UIToast.error({
                              caption: IMPORT_LOADING_ERROR.caption,
                              text:    `${IMPORT_LOADING_ERROR.text} ${filename}<br/>${error.message}`,
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
            this.tracksLoaded = true
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
     * Extract POIs from GeoJson with coordinate-based synchronization.
     * Updates existing POIs if they match the same location to preserve identity.
     * Manages Start/Stop flag visibility based on journey limits.
     * * @async
     * @function getPOIsFromGeoJson
     * @returns {Promise<void>}
     */
    getPOIsFromGeoJson = async () => {
        if (this.geoJson.type !== FEATURE_COLLECTION) {
            return
        }

        // Precision helper for coordinate comparison (approx. 1cm)
        const getCoordKey = (lon, lat) => `${Number(lon).toFixed(7)}_${Number(lat).toFixed(7)}`

        // Build spatial index for existing POIs linked to this journey or its tracks
        const trackSlugs = Array.from(this.tracks.keys())
        const existingLookup = new Map(
            Array.from(__.ui.poiManager.list.values())
                .filter(p => p.parent === this.slug || trackSlugs.includes(p.parent))
                .map(p => [getCoordKey(p.longitude, p.latitude), p]),
        )

        for (const feature of this.geoJson.features) {
            const geometry = getGeom(feature)
            const common = {
                description: feature.properties.desc ?? feature.properties.description ?? '',
                visible:     true,
            }

            switch (geometry.type) {
                case FEATURE_POINT: {
                    const [lon, lat, z] = geometry.coordinates
                    const key = getCoordKey(lon, lat)
                    const existingPoi = existingLookup.get(key)

                    const clampedHeight = await __.ui.poiManager.getHeightFromTerrain({
                                                                                          coordinates: {
                                                                                              longitude: lon,
                                                                                              latitude:  lat,
                                                                                              height:    z ?? 0,
                                                                                          },
                                                                                      })

                    if (existingPoi) {
                        existingPoi.height = z ?? undefined
                        existingPoi.simulatedHeight = clampedHeight
                        existingPoi.title = feature.properties.name
                        existingPoi.description = common.description
                    }
                    else {
                        const poi = new MapPOI({
                                                   ...common,
                                                   parent:          this.slug,
                                                   type:            POI_STANDARD_TYPE,
                                                   title:           feature.properties.name,
                                                   longitude:       lon,
                                                   latitude:        lat,
                                                   height:          z ?? undefined,
                                                   simulatedHeight: clampedHeight,
                                                   visible:         true,
                                               })
                        await __.ui.poiManager.add(poi, false)
                    }
                    break
                }

                case FEATURE_LINE_STRING:
                case FEATURE_MULTILINE_STRING: {
                    const trackSlug = this.#setTrackSlug({
                                                             content: [this.slug, feature.properties.name],
                                                         })
                    const track = this.tracks.get(trackSlug)
                    if (!track) {
                        continue
                    }

                    const coords = geometry.type === FEATURE_LINE_STRING ? [geometry.coordinates] : geometry.coordinates

                    const processFlag = async (isStart) => {
                        const segment = isStart ? coords[0] : coords[coords.length - 1]
                        const point = isStart ? segment[0] : segment[segment.length - 1]
                        const [lon, lat, z] = point

                        const key = getCoordKey(lon, lat)
                        const type = isStart ? POI_FLAG_START : POI_FLAG_STOP

                        // Priority to lookup key, then fallback to existing track flag ID
                        const existingPoi = existingLookup.get(key) || __.ui.poiManager.list.get(isStart ? track.flags.start : track.flags.stop)

                        const clampedHeight = await __.ui.poiManager.getHeightFromTerrain({
                                                                                              coordinates: {
                                                                                                  longitude: lon,
                                                                                                  latitude:  lat,
                                                                                                  height:    z ?? 0,
                                                                                              },
                                                                                          })

                        if (existingPoi) {
                            existingPoi.longitude = lon
                            existingPoi.latitude = lat
                            existingPoi.height = z ?? undefined
                            existingPoi.simulatedHeight = clampedHeight
                        }
                        else {
                            const newPoi = new MapPOI({
                                                          ...common,
                                                          parent:          trackSlug,
                                                          type:            type,
                                                          title:           isStart ? 'Start' : 'End',
                                                          longitude:       lon,
                                                          latitude:        lat,
                                                          height:          z ?? undefined,
                                                          simulatedHeight: clampedHeight,
                                                          color:           isStart ? lgs.settings.journey.pois.start.color : lgs.settings.journey.pois.stop.color,
                                                      })
                            await __.ui.poiManager.add(newPoi, false)

                            if (isStart) {
                                track.flags.start = newPoi.id
                            }
                            else {
                                track.flags.stop = newPoi.id
                            }
                        }
                    }

                    await processFlag(true)  // Start
                    await processFlag(false) // Stop
                    break
                }
            }
        }

        // Adjust visibility for flagged POIs if limited to journey boundaries
        if (this.poisOnLimits) {
            Array.from(this.tracks.values()).forEach((track, index) => {
                const startPoi = __.ui.poiManager.list.get(track.flags.start)
                const stopPoi = __.ui.poiManager.list.get(track.flags.stop)

                if (startPoi) {
                    startPoi.visible = index === 0
                }
                if (stopPoi) {
                    stopPoi.visible = index === this.tracks.size - 1
                }
            })
        }

        this.poisLoaded = true
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

        // //Ready
        // const texts = new Map([
        //                           [DRAWING_FROM_UI, 'File loaded succesfully!'],
        //                           [DRAWING_FROM_DB, 'File loaded succesfully!'],
        //                           [SIMULATE_ALTITUDE, 'File updated succesfully!'],
        //                           [REFRESH_DRAWING, 'File updated succesfully!'],
        //                       ])
        // UIToast.success({
        //                     caption: `${this.title}`, text: texts.get(action),
        //                 })

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

        return global
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
        this.metrics.global = this.setGlobalMetrics()
    }

    /**
     * Check if the current journey contains only one track
     *
     * @return {boolean}
     */
    hasOneTrack = () => {
        return this.tracks.size === 1
    }

    hasSeveralTracks = () => {
        return this.tracks.size > 1
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
