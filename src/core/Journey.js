/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Journey.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-08
 * Last modified: 2026-05-08
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    CURRENT_JOURNEY, DRAWING_FROM_DB, DRAWING_FROM_UI, FOCUS_ON_FEATURE, GEOJSON, GPX, JOURNEYS_STORE, JSON_, KML, KMZ,
    NO_FOCUS, ORIGIN_STORE, POI_FLAG_START, POI_FLAG_STOP, POI_STANDARD_TYPE, SIMULATE_ALTITUDE, TRACK_SLUG,
    UPDATE_JOURNEY_SILENTLY,
}                                        from '@Core/constants'
import { MapPOI }                        from '@Core/MapPOI'
import { gpx, kml }                      from '@tmcw/togeojson'
import { getGeom }                       from '@turf/invariant'
import { defaultTrackRenderSmoothing, normalizeTrackRenderSmoothing } from '@Utils/cesium/trackRenderSmoothing'

import {
    FEATURE_COLLECTION, FEATURE_LINE_STRING, FEATURE_MULTILINE_STRING, FEATURE_POINT, IMPORT_LOADING_ERROR, TrackUtils,
}                             from '@Utils/cesium/TrackUtils'
import {
    applyGpxStyleExtensionProperties, extractJourneyMetadataFromGeoJson, extractJourneyMetadataFromGpxDocument, extractLgsPoiProperties,
    extractLgsTrackProperties,
}                             from '@Utils/JourneyGpxUtils'
import { decodeHTMLEntities } from '@Utils/TextUtils'
import { UIToast }            from '@Utils/UIToast'
import { ElevationServer }    from './Elevation/ElevationServer'
import { MapElement }         from './MapElement'
import { getOrbitSettings }   from './OrbitSettings'
import { Track }              from './Track'

const START_STOP_TOO_CLOSE_DISTANCE = 100


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
    renderSmoothing

    origin                                     // initial geoJson
    POIsVisible = true

    metrics = {global: {}, user: {}, external: {}, points: []}
    camera = {}
    cameraOrigin = {}
    rotation = {}
    panorama = {}
    replay = {
        start: [],
        stop:  [],
    }

    hasElevation = false
    hasTime = false

    tracksLoaded = false

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
            this.renderSmoothing = normalizeTrackRenderSmoothing(
                options.renderSmoothing,
                defaultTrackRenderSmoothing(),
            )

            this.camera = options.camera ?? null
            this.rotation = options.rotation ?? {}
            this.panorama = options.panorama ?? {}
            this.replay = options.replay ?? {
                start: [],
                stop:  [],
            }
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
    static readFromDB = async slug => {
        if (!slug) {
            return null
        }

        const data = await lgs.db.lgs1920.get(slug, JOURNEYS_STORE)
        if (!data) {
            return null
        }

        return Journey.deserialize({
                                       object: data,
                                       reset:  true,
                                   })
    }

    static readAllFromDB = async ({excludeSlugs = []} = {}) => {
        try {
            const excluded = new Set(excludeSlugs)
            // get all slugs
            const slugs = await lgs.db.lgs1920.keys(JOURNEYS_STORE)
            // Get each journey content
            const journeyPromises = slugs
                .filter(slug => !excluded.has(slug))
                .map(slug => Journey.readFromDB(slug))
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
        instance.renderSmoothing = normalizeTrackRenderSmoothing(
            instance.renderSmoothing,
            defaultTrackRenderSmoothing(),
        )
        instance.replay = {
            start: Array.isArray(instance.replay?.start) ? instance.replay.start : [],
            stop:  Array.isArray(instance.replay?.stop) ? instance.replay.stop : [],
        }

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
                    applyGpxStyleExtensionProperties(this.geoJson, gpxDocument)
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
        if (metadata.renderSmoothing) {
            this.renderSmoothing = normalizeTrackRenderSmoothing(metadata.renderSmoothing)
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
                        parent:          this.slug,
                        id:              keepContext ? track.id : lgsTrack.id,
                        name:            keepContext ? track.name : slug,
                        slug:            slug,
                        hasTime:         this.#hasTime(feature.properties),
                        hasAltitude:     this.#hasAltitude(geometry),
                        description:     keepContext ? track.description : decodeHTMLEntities(feature.properties.desc ?? ''),
                        activity:        this.activity,
                        activitySettings: this.activitySettings,
                        renderSmoothing: keepContext ? track.renderSmoothing : lgsTrack.renderSmoothing,
                        renderStyle:     keepContext ? track.renderStyle : lgsTrack.renderStyle,
                        segments:        geometry.coordinates.length,
                        visible:         keepContext ? track.visible : (lgsTrack.visible ?? true),
                        color:           keepContext ? track.color : (lgsTrack.color ?? __.ui.editor.journey.newColor()),
                        thickness:       keepContext ? track.thickness : (lgsTrack.thickness ?? lgs.settings.getJourney.thickness),
                        flags:           keepContext ? track.flags : {start: undefined, stop: undefined},
                        content:         feature,
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
        const times = properties?.coordinateProperties?.times
        return Array.isArray(times) && times.length > 0
    }

    /**
     * Check if data contains altitude
     *
     * @param geometry
     * @return {boolean}
     */
    #hasAltitude = (geometry) => {
        const hasAltitude = coordinate => Array.isArray(coordinate) && Number.isFinite(Number(coordinate[2]))

        switch (geometry.type) {
            // We check the length of the points coordinates
            case FEATURE_LINE_STRING:
                return Array.isArray(geometry.coordinates) && geometry.coordinates.some(hasAltitude)
            case FEATURE_MULTILINE_STRING:
                return Array.isArray(geometry.coordinates)
                    && geometry.coordinates.some(segment => Array.isArray(segment) && segment.some(hasAltitude))
            default:
                return false
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
        const existingPOIs = Array.from(__.ui.poiManager.list.values())
        const existingById = new Map(existingPOIs.filter(p => p?.id).map(p => [p.id, p]))
        const existingLookup = new Map(
            existingPOIs
                .filter(p => p.parent === this.slug || trackSlugs.includes(p.parent))
                .map(p => [getCoordKey(p.longitude, p.latitude), p]),
        )
        const rememberImportedPOI = poi => {
            if (!poi?.id) {
                return
            }

            existingById.set(poi.id, poi)
            existingLookup.set(getCoordKey(poi.longitude, poi.latitude), poi)
        }

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
                    const existingPoi = (lgsPoi.id ? existingById.get(lgsPoi.id) : null) ?? existingLookup.get(key)
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
                        color:   lgsPoi.color ?? lgs.colors.dark,
                        bgColor: lgsPoi.bgColor ?? lgs.colors.light,
                        visible:         lgsPoi.visible ?? true,
                        expanded:        lgsPoi.expanded ?? false,
                        animated:        lgsPoi.animated ?? false,
                        time:            lgsPoi.time ?? properties.time,
                        distance:        lgsPoi.distance,
                        cameraDistance:  lgsPoi.cameraDistance,
                        camera:          lgsPoi.camera,
                    }

                    if (existingPoi) {
                        const updatedPOI = await __.ui.poiManager.updatePOI(existingPoi.id, poiData, {
                            immediate:          true,
                            skipLocationUpdate: Boolean(poiData.location && poiData.country && poiData.countryCode),
                        })
                        rememberImportedPOI(updatedPOI)
                    }
                    else {
                        if (lgsPoi.id && !__.ui.poiManager.list.has(lgsPoi.id)) {
                            poiData.id = lgsPoi.id
                        }

                        // We need colors
                        poiData.color = lgsPoi.color ?? lgs.colors.dark
                        poiData.bgColor = lgsPoi.bgColor ?? lgs.colors.light

                        const poi = new MapPOI({
                                                   ...poiData,
                                               })
                        const addedPOI = await __.ui.poiManager.add(poi, false)
                        rememberImportedPOI(addedPOI)
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
                        const previousFlagId = isStart ? track.flags.start : track.flags.stop
                        const existingPoi = existingLookup.get(key)

                        const clampedHeight = await __.ui.poiManager.getHeightFromTerrain({
                                                                                              coordinates: {
                                                                                                  longitude: lon,
                                                                                                  latitude:  lat,
                                                                                                  height:    z ?? 0,
                                                                                              },
                                                                                          })
                        const startPoi = isStart ? null : __.ui.poiManager.list.get(track.flags.start)
                        const tooClose = !isStart
                            && startPoi
                            && __.ui.poiManager.haversineDistance(
                                startPoi,
                                {longitude: lon, latitude: lat},
                            ) < START_STOP_TOO_CLOSE_DISTANCE

                        const flagUpdates = {
                            longitude:       lon,
                            latitude:        lat,
                            height:          z ?? undefined,
                            simulatedHeight: clampedHeight,
                            tooClose:        tooClose === true,
                        }

                        if (existingPoi) {
                            await __.ui.poiManager.updatePOI(existingPoi.id, flagUpdates, {
                                immediate:          true,
                                skipLocationUpdate: true,
                            })
                            if (existingPoi.type === type) {
                                if (isStart) {
                                    track.flags.start = existingPoi.id
                                }
                                else {
                                    track.flags.stop = existingPoi.id
                                }
                            }
                        }
                        else {
                            const previousFlag = previousFlagId ? __.ui.poiManager.list.get(previousFlagId) : null
                            if (previousFlag?.type === type && previousFlag.parent === trackSlug) {
                                await __.ui.poiManager.remove({id: previousFlagId})
                            }

                            const newPoi = new MapPOI({
                                                          ...common,
                                                          parent:          trackSlug,
                                                          type:            type,
                                                          title:           isStart ? 'Start' : 'End',
                                                          ...flagUpdates,
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
            const tracks = Array.from(this.tracks.values())
            tracks.forEach((track, index) => {
                const startPoi = __.ui.poiManager.list.get(track.flags.start)
                const stopPoi = __.ui.poiManager.list.get(track.flags.stop)

                if (startPoi) {
                    startPoi.visible = index === 0
                }
                if (stopPoi) {
                    stopPoi.visible = index === this.tracks.size - 1
                }
            })

            const firstStartPoi = __.ui.poiManager.list.get(tracks[0]?.flags?.start)
            const lastStopPoi = __.ui.poiManager.list.get(tracks[tracks.length - 1]?.flags?.stop)
            const tooClose = firstStartPoi && lastStopPoi
                && __.ui.poiManager.haversineDistance(firstStartPoi, lastStopPoi) < START_STOP_TOO_CLOSE_DISTANCE
            if (lastStopPoi && lastStopPoi.tooClose !== (tooClose === true)) {
                await __.ui.poiManager.updatePOI(lastStopPoi.id, {tooClose: tooClose === true}, {
                    immediate:          true,
                    skipLocationUpdate: true,
                })
            }
        }
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
    draw = async ({
                      action = DRAWING_FROM_UI,
                      mode = FOCUS_ON_FEATURE,
                      hideOtherJourneys = false,
                      currentJourneySlug = lgs.theJourney?.slug ?? null,
                      forceCurrentVisible = false,
                  } = {}) => {
        const promises = []
        const isCurrentJourney = currentJourneySlug !== null && this.slug === currentJourneySlug
        const isVisibleJourney = forceCurrentVisible && isCurrentJourney
                                 ? true
                                 : this.visible !== false
        const forcedToHide = !isVisibleJourney || (hideOtherJourneys && !isCurrentJourney)

        // Draw Tracks and flags
        this.tracks.forEach(track => {
            // If journey is not visible, we force tracks to be hidden, whatever their visibility
            // else we use their status.
            promises.push(track.draw({
                                         action:      action,
                                         mode:        NO_FOCUS,
                                         forcedToHide: forcedToHide,
                                     }))
        })

        await Promise.all(promises)
        this.updateVisibility(isVisibleJourney && (!hideOtherJourneys || isCurrentJourney))

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
        return __.ui.sceneManager.focusOnJourney(props)
    }

    showAfterHeightSimulation = async () => {
        await this.draw({action: SIMULATE_ALTITUDE})
    }

    updateVisibility = (visibility) => {
        TrackUtils.updateJourneyVisibility(this, visibility)
    }

    setGlobalMetrics = () => {
        const tracks = Array.from(this.tracks.values())
        const global = {}
        const points = []
        let distance = 0
        let duration = 0
        let idleTime = 0
        let movingDistance = 0
        let movingDuration = 0
        let minSpeed
        let maxSpeed
        let minPace
        let maxPace
        let minHeight
        let maxHeight
        let minSlope
        let maxSlope

        const createElevationBucket = () => ({elevation: 0, distance: 0, duration: 0, pace: 0, speed: 0, points: 0})
        const addToElevationBucket = (bucket, source) => {
            bucket.elevation += source.elevation ?? 0
            bucket.distance += source.distance ?? 0
            bucket.duration += source.duration ?? 0
            bucket.points += source.points ?? 0
        }

        if (this.hasAltitude) {
            global.positive = createElevationBucket()
            global.negative = createElevationBucket()
            global.flat = createElevationBucket()
        }

        tracks.forEach((track) => {
            const trackPoints = Array.isArray(track.metrics?.points) ? track.metrics.points : []
            if (trackPoints.length > 0) {
                for (const point of trackPoints) {
                    points.push(point)
                }
            }

            const trackGlobal = track.metrics?.global ?? {}
            distance += Number(trackGlobal.distance) || 0

            if (this.hasTime) {
                duration += Number(trackGlobal.duration) || 0
                idleTime += Number(trackGlobal.idleTime) || 0
                movingDistance += Number(trackGlobal.movingDistance) || 0
                movingDuration += Number(trackGlobal.movingDuration) || 0
                const trackMinSpeed = Number(trackGlobal.minSpeed)
                const trackMaxSpeed = Number(trackGlobal.maxSpeed)
                const trackMinPace = Number(trackGlobal.minPace)
                const trackMaxPace = Number(trackGlobal.maxPace)
                if (Number.isFinite(trackMinSpeed) && trackMinSpeed > 0) {
                    minSpeed = minSpeed === undefined ? trackMinSpeed : Math.min(minSpeed, trackMinSpeed)
                }
                if (Number.isFinite(trackMaxSpeed) && trackMaxSpeed > 0) {
                    maxSpeed = maxSpeed === undefined ? trackMaxSpeed : Math.max(maxSpeed, trackMaxSpeed)
                }
                if (Number.isFinite(trackMinPace) && trackMinPace > 0) {
                    minPace = minPace === undefined ? trackMinPace : Math.min(minPace, trackMinPace)
                }
                if (Number.isFinite(trackMaxPace) && trackMaxPace > 0) {
                    maxPace = maxPace === undefined ? trackMaxPace : Math.max(maxPace, trackMaxPace)
                }
            }

            if (this.hasAltitude) {
                const trackMinHeight = Number(trackGlobal.minHeight)
                const trackMaxHeight = Number(trackGlobal.maxHeight)
                const trackMinSlope = Number(trackGlobal.minSlope)
                const trackMaxSlope = Number(trackGlobal.maxSlope)
                if (Number.isFinite(trackMinHeight)) {
                    minHeight = minHeight === undefined ? trackMinHeight : Math.min(minHeight, trackMinHeight)
                }
                if (Number.isFinite(trackMaxHeight)) {
                    maxHeight = maxHeight === undefined ? trackMaxHeight : Math.max(maxHeight, trackMaxHeight)
                }
                if (Number.isFinite(trackMinSlope)) {
                    minSlope = minSlope === undefined ? trackMinSlope : Math.min(minSlope, trackMinSlope)
                }
                if (Number.isFinite(trackMaxSlope)) {
                    maxSlope = maxSlope === undefined ? trackMaxSlope : Math.max(maxSlope, trackMaxSlope)
                }

                addToElevationBucket(global.positive, trackGlobal.positive ?? {})
                addToElevationBucket(global.negative, trackGlobal.negative ?? {})
                addToElevationBucket(global.flat, trackGlobal.flat ?? {})
            }
        })

        global.distance = distance
        if (this.hasTime) {
            global.duration = duration
            global.idleTime = idleTime
            global.movingDistance = movingDistance
            global.movingDuration = movingDuration
            global.averageSpeed = duration > 0 ? distance / duration : 0
            global.averagePace = distance > 0 ? duration / distance : 0
            global.averageSpeedMoving = movingDuration > 0 ? movingDistance / movingDuration : 0
            global.averagePaceMoving = movingDistance > 0 ? movingDuration / movingDistance : 0
            global.minSpeed = minSpeed ?? 0
            global.maxSpeed = maxSpeed ?? 0
            global.minPace = minPace ?? 0
            global.maxPace = maxPace ?? 0
        }

        if (this.hasAltitude) {
            global.minHeight = minHeight
            global.maxHeight = maxHeight
            global.minSlope = minSlope
            global.maxSlope = maxSlope

            global.positive.speed = global.positive.duration > 0 ? global.positive.distance / global.positive.duration : 0
            global.positive.pace = global.positive.distance > 0 ? global.positive.duration / global.positive.distance : 0
            global.negative.speed = global.negative.duration > 0 ? global.negative.distance / global.negative.duration : 0
            global.negative.pace = global.negative.distance > 0 ? global.negative.duration / global.negative.distance : 0
            global.flat.speed = global.flat.duration > 0 ? global.flat.distance / global.flat.duration : 0
            global.flat.pace = global.flat.distance > 0 ? global.flat.duration / global.flat.distance : 0
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
        const metricsPoints = []
        this.tracks.forEach(track => {
            if (Array.isArray(track.metrics?.points) && track.metrics.points.length > 0) {
                for (const point of track.metrics.points) {
                    metricsPoints.push(point)
                }
            }
        })
        this.metrics.points = metricsPoints
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
