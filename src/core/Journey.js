/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Journey.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-26
 * Last modified: 2026-04-26
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
}                             from '@Utils/cesium/TrackUtils'
import {
    extractJourneyMetadataFromGeoJson, extractJourneyMetadataFromGpxDocument, extractLgsPoiProperties,
    extractLgsTrackProperties,
}                             from '@Utils/JourneyGpxUtils'
import { decodeHTMLEntities } from '@Utils/TextUtils'
import { UIToast }            from '@Utils/UIToast'
import { ElevationServer }    from './Elevation/ElevationServer'
import { MapElement }         from './MapElement'
import { getOrbitSettings }   from './OrbitSettings'
import { Track }              from './Track'


export class Journey extends MapElement {

    tracks = new Map()          // List of tracks
    pois = []            // List of pois
    poisOnLimits = true               // Add POIs start/stop on journey limits or on each track
    type                                       // File type  GPX,KML,GEOJSON  //TODO KMZ

    title = ''                          // Journey Title
    location = ''
    country = ''
    countryCode = ''
    countries = []
    countryCodes = []
    activity
    activitySettings

    origin                                     // initial geoJson
    POIsVisible = true

    metrics = {global: {}, user: {}, external: {}, points: []}
    camera = {}
    cameraOrigin = {}
    rotation = {}
    panorama = {}

    hasElevation = false
    hasTime = false

    tracksLoaded = false
    poisLoaded = false

    constructor(title, type, options = {}) {
        super(CURRENT_JOURNEY)


        if (title) {
            this.title = (options.allowRename ?? true) ? this.singleTitle(title) : title

            this.type = type

            // If options property exists, we get them, else
            // we set the value to a default.
            this.slug = options.slug ?? __.app.setSlug({content: [title, type]})
            this.visible = options.visible ?? true
            this.POIsVisible = options.POIsVisible ?? true

            this.description = decodeHTMLEntities(options.description ?? '')
            this.location = options.location ?? ''
            this.country = options.country ?? ''
            this.countryCode = options.countryCode ?? ''
            this.countries = options.countries ?? []
            this.countryCodes = options.countryCodes ?? []
            this.activity = options.activity ?? Journey.defaultActivity()
            this.activitySettings = Journey.activityProfile(this.activity, options.activitySettings)

            this.camera = options.camera ?? null
            this.rotation = options.rotation ?? {}
            this.panorama = options.panorama ?? {}


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

    static defaultActivity = () => Track.defaultActivity()

    static activityProfiles = () => Track.activityProfiles()

    static activityProfile = (activity = Journey.defaultActivity(), overrides = undefined) => Track.activityProfile(activity, overrides)

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
            this.metrics = {
                global:   {},
                user:     {},
                external: {},
                points:   [],
                ...(options.metrics ?? {}),
            }

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
        const metrics = this.metrics ?? {}
        const global = metrics.global ?? {}
        const user = metrics.user ?? {}
        const external = metrics.external ?? {}
        const points = Array.isArray(metrics.points) ? metrics.points : []

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

        if (points.length === 0) {
            return {
                start: undefined,
                stop:  undefined,
            }
        }

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
        instance.activity ??= Journey.defaultActivity()
        instance.activitySettings = Journey.activityProfile(instance.activity, instance.activitySettings)

        // Transform Tracks from object to class
        instance.tracks.forEach((track, slug) => {
            track.activity ??= instance.activity
            track.activitySettings ??= instance.activitySettings
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
                case GPX: {
                    const gpxDocument = new DOMParser().parseFromString(content, 'text/xml')
                    this.geoJson = gpx(gpxDocument)
                    this.#applyJourneyMetadata(extractJourneyMetadataFromGpxDocument(gpxDocument))
                    break
                }
                case KMZ :
                    // TODO unzip to get kml. but what to do with the assets files that are sometimes embedded
                    break
                case KML:
                    this.geoJson = kml(new DOMParser().parseFromString(content, 'text/xml'))
                    break
                case JSON_:
                case GEOJSON :
                    this.geoJson = JSON.parse(content)
                    this.#applyJourneyMetadata(extractJourneyMetadataFromGeoJson(this.geoJson))
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

    #applyJourneyMetadata = (metadata = {}) => {
        if (metadata.title) {
            this.title = decodeHTMLEntities(metadata.title)
        }
        if (metadata.description !== undefined) {
            this.description = decodeHTMLEntities(metadata.description)
        }
        if (metadata.activity) {
            this.activity = metadata.activity
        }
        if (metadata.activitySettings) {
            this.activitySettings = Journey.activityProfile(this.activity, metadata.activitySettings)
        }
        if (metadata.visible !== undefined) {
            this.visible = metadata.visible
        }
        if (metadata.POIsVisible !== undefined) {
            this.POIsVisible = metadata.POIsVisible
        }
        if (metadata.elevationServer) {
            this.elevationServer = metadata.elevationServer
        }
        if (metadata.camera) {
            this.camera = metadata.camera
        }
        if (metadata.rotation) {
            this.rotation = metadata.rotation
        }
        if (metadata.panorama) {
            this.panorama = metadata.panorama
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
                const lgsTrack = extractLgsTrackProperties(feature.properties)

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
                        id:          keepContext ? track.id : lgsTrack.id,
                        name:        keepContext ? track.name : slug,
                        slug:        slug,
                        hasTime:     this.#hasTime(feature.properties),
                        hasAltitude: this.#hasAltitude(geometry),
                        description: keepContext ? track.description : decodeHTMLEntities(feature.properties.desc ?? ''),
                        activity:    this.activity,
                        activitySettings: this.activitySettings,
                        segments:    geometry.coordinates.length,
                        visible:     keepContext ? track.visible : (lgsTrack.visible ?? true),
                        color:       keepContext ? track.color : (lgsTrack.color ?? __.ui.editor.journey.newColor()),
                        thickness:   keepContext ? track.thickness : (lgsTrack.thickness ?? lgs.settings.getJourney.thickness),
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

        const resolveImportedPoiParent = (poiMetadata) => {
            if (poiMetadata.parentKind !== 'track') {
                return this.slug
            }

            if (this.tracks.has(poiMetadata.parent)) {
                return poiMetadata.parent
            }

            const matchingTrack = Array.from(this.tracks.values())
                .find(track => track.title === poiMetadata.parentTrackTitle)

            return matchingTrack?.slug ?? this.slug
        }

        for (const feature of this.geoJson.features) {
            const geometry = getGeom(feature)
            const properties = feature.properties ?? {}
            const common = {
                description: decodeHTMLEntities(properties.desc ?? properties.description ?? ''),
                visible:     true,
            }

            switch (geometry.type) {
                case FEATURE_POINT: {
                    const [lon, lat, z] = geometry.coordinates
                    const lgsPoi = extractLgsPoiProperties(properties)
                    if ([POI_FLAG_START, POI_FLAG_STOP].includes(lgsPoi.type)) {
                        break
                    }

                    const key = getCoordKey(lon, lat)
                    const existingPoi = existingLookup.get(key)
                    const importedHeight = lgsPoi.height ?? (lgsPoi.simulatedHeight !== undefined ? undefined : z ?? undefined)
                    const importedParent = resolveImportedPoiParent(lgsPoi)
                    const importedType = lgsPoi.type ?? POI_STANDARD_TYPE
                    const importedCategory = lgsPoi.category ?? POI_STANDARD_TYPE
                    const importedTitle = properties.name ?? 'POI'

                    const clampedHeight = lgsPoi.simulatedHeight ?? await __.ui.poiManager.getHeightFromTerrain({
                                                                                                                     coordinates: {
                                                                                                                         longitude: lon,
                                                                                                                         latitude:  lat,
                                                                                                                         height:    importedHeight ?? 0,
                                                                                                                     },
                                                                                                                 })

                    const poiData = {
                        ...common,
                        parent:          importedParent,
                        type:            importedType,
                        category:        importedCategory,
                        location:        lgsPoi.location,
                        country:         lgsPoi.country,
                        countryCode:     lgsPoi.countryCode,
                        title:           importedTitle,
                        longitude:       lon,
                        latitude:        lat,
                        height:          importedHeight,
                        simulatedHeight: clampedHeight,
                        color:           lgsPoi.color,
                        bgColor:         lgsPoi.bgColor,
                        visible:         lgsPoi.visible ?? true,
                        expanded:        lgsPoi.expanded ?? false,
                        animated:        lgsPoi.animated ?? false,
                        time:            lgsPoi.time ?? properties.time,
                        distance:        lgsPoi.distance,
                        cameraDistance:  lgsPoi.cameraDistance,
                        camera:          lgsPoi.camera,
                    }

                    if (existingPoi) {
                        Object.assign(existingPoi, poiData)
                    }
                    else {
                        if (lgsPoi.id && !__.ui.poiManager.list.has(lgsPoi.id)) {
                            poiData.id = lgsPoi.id
                        }
                        const poi = new MapPOI({
                                                   ...poiData,
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
        if (props.rotate) {
            const rotationSettings = getOrbitSettings(this, 'rotation')
            props.rpm ??= rotationSettings.rpm
            props.direction ??= rotationSettings.direction
        }
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
        const tracks = Array.from(this.tracks.values())
        const points = tracks.flatMap(track => Array.isArray(track.metrics?.points) ? track.metrics.points : [])
        const global = Track.calculateGlobalMetrics({
                                                        points:      points,
                                                        rawPoints:   points,
                                                        hasTime:     this.hasTime,
                                                        hasAltitude: this.hasAltitude,
                                                        activityProfile: Journey.activityProfile(this.activity, this.activitySettings),
                                                    })

        if (this.hasAltitude) {
            const minHeights = tracks.map(track => track.metrics?.global?.minHeight).filter(value => Number.isFinite(value))
            const maxHeights = tracks.map(track => track.metrics?.global?.maxHeight).filter(value => Number.isFinite(value))

            global.minHeight = minHeights.length ? Math.min(...minHeights) : undefined
            global.maxHeight = maxHeights.length ? Math.max(...maxHeights) : undefined
        }

        return global
    }

    /**
     * Extract the Metrics
     *
     * We loop over tracks to compute tracks metrics
     */
    extractMetrics = () => {
        this.activity ??= Journey.defaultActivity()
        this.activitySettings = Journey.activityProfile(this.activity)

        this.tracks.forEach(track => {
            track.activity = this.activity
            track.activitySettings = this.activitySettings
            track.extractMetrics()
        })

        if (this.tracks.size === 1) {
            // If there's ontrack we'll use the track metrics
            this.metrics = this.tracks.entries().next().value[1].metrics
            return
        }
        // For a multi track journey, let's compute journey level metrics
        this.metrics.points = Array.from(this.tracks.values())
            .flatMap(track => Array.isArray(track.metrics?.points) ? track.metrics.points : [])
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
