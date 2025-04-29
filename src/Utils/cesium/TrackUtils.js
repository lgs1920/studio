/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TrackUtils.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-04-29
 * Last modified: 2025-04-29
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import {
    ADD_JOURNEY, CURRENT_JOURNEY, CURRENT_POI, CURRENT_STORE, CURRENT_TRACK, DRAWING, DRAWING_FROM_DB, DRAWING_FROM_UI,
    FOCUS_ON_FEATURE, NO_FOCUS, REFRESH_DRAWING, SCENE_MODE_2D,
}                                                      from '@Core/constants'
import { Journey }                                     from '@Core/Journey'
import { default as centroid }                         from '@turf/centroid'
import { SceneUtils }                                  from '@Utils/cesium/SceneUtils'
import {
    Cartesian3, Cartographic, Color as CColor, CustomDataSource, GeoJsonDataSource, Math as M,
    PolylineOutlineMaterialProperty, Rectangle, sampleTerrainMostDetailed,
}                                                      from 'cesium'
import Color                                           from 'color'
import { UIToast }                                     from '../UIToast.js'
import { POI_FLAG, POI_FLAG_START, POI_STD, POIUtils } from './POIUtils'

export const SUPPORTED_EXTENSIONS = ['geojson', 'json', 'kml', 'gpx' /* TODO 'kmz'*/]
export const FEATURE                  = 'Feature',
             FEATURE_COLLECTION       = 'FeatureCollection',
             FEATURE_LINE_STRING      = 'LineString',
             FEATURE_MULTILINE_STRING = 'MultiLineString',
             FEATURE_POINT            = 'Point'

export const JOURNEY_KO      = 0,
             JOURNEY_OK      = 1,
             JOURNEY_EXISTS  = 2,
             JOURNEY_WAITING = 3,
             JOURNEY_DENIED = 4


export class TrackUtils {

    static MIMES = {
        gpx: ['application/gpx+xml', 'vnd.gpxsee.map+xml', 'application/octet-stream'],
        geojson: ['application/geo+json', 'application/json'],
        kml: ['vnd.google-earth.kml+xml'], // kmz: ['vnd.google-earth.kmz'], //TODO KMZ files
    }

    /**
     * Check if the current feature contains times and altitudes
     *
     * @return  {hasAltitude: boolean, hasTime: boolean}
     */
    static checkIfDataContainsAltitudeOrTime = (feature => {
        let hasAltitude = true
        for (const coordinate of feature.geometry.coordinates) {
            if (coordinate.length === 2) {
                hasAltitude = false
                break
            }
        }
        return {
            hasAltitude: hasAltitude, hasTime: feature.properties?.coordinateProperties?.times !== undefined,
        }
    })

    /**
     * Prepare all the Datasources for the tacks and POIs drawings for aJourney
     *
     * For Each Track we create a GeoJson Data source, named with the track slug
     * For all the POIs, flags included, we create a Custom Data Source named with journey slug.
     *
     * @param {Journey} journey
     * @return {Promise<void>}
     */
    static prepareDrawing = async journey => {

        const dataSources = []

        // We create first a GeoJson Data Source for the tracks
        journey.tracks.forEach(track => {
            dataSources.push(
                lgs.viewer.dataSources.add(new GeoJsonDataSource(track.slug)))
        })

        // Then a Custom we'll use for POIs or al other entities related to
        // the journey
        dataSources.push(
            lgs.viewer.dataSources.add(new CustomDataSource(journey.slug)))

        await Promise.all(dataSources)
    }

    /**
     * Show the TRack on the map
     *
     * @param {Track} track
     * @param action
     * @param mode
     * @param forcedToHide
     */
    static draw = async (track, {action = DRAWING_FROM_UI, mode = FOCUS_ON_FEATURE, forcedToHide = false}) => {
        // Load Geo Json for track then set visibility
        const source = lgs.viewer.dataSources.getByName(track.slug)[0]
        const color = Color(track.color)
        const [r, g, b] = color.color
        switch (action) {
            case DRAWING_FROM_DB:
            case ADD_JOURNEY:
                await source.load(track.content,
                            {
                                clampToGround: true,
                                name:          track.title,
                            },
                )
            // No break, show must go on
            case REFRESH_DRAWING:
            case DRAWING_FROM_UI:
                const material = new PolylineOutlineMaterialProperty({
                                                                         color: CColor.fromCssColorString(track.color),
                                                                         // outlineColor: false,
                                                                         outlineWidth: 0,
                                                                     },
                )
                source.entities.values.forEach(entity => {
                    if (entity.polyline) {
                        entity.polyline.material = material
                        entity.polyline.width = track.thickness
                    }
                })
                break
        }
        source.show = forcedToHide ? false : track.visible

        lgs.viewer.scene.requestRender()
    }

    /**
     * Focus on a journey
     *
     * We need, at least, one journey or one track, but not both
     *
     * @param {number} action
     * @param {Journey } journey
     * @param {Track} track
     * @param {boolean} showBbox
     */
    static focus = async (
        {
            action = 0,
            journey = null,
            track = null,
            showBbox = false,
            resetCamera = false,
        }) => {

        // If track not provided, we'll get the first one of the journey
        if (track === null) {
            // But we need to set the journey to the current one if there is no information
            if (journey === null) {
                journey = lgs.theJourney
            }
            track = journey.tracks.values().next().value
        }
        else {
            // We have a track, let's force the journey (even if there is one provided)
            journey = lgs.journeys.get(track.parent)
        }

        // We calculate the Bounding Box and enlarge it by 25%
        // in order to be sure to have the full track inside the window
        const bbox = TrackUtils.extendBbox(extent(track.content), 0)
        let rectangle = Rectangle.fromDegrees(bbox[0], bbox[1], bbox[2], bbox[3])

        // Get the right camera information
        let destination
        if (journey.camera === null || resetCamera) {
            // Let's center to the rectangle
            destination = lgs.camera.getRectangleCameraCoordinates(rectangle)
            var cartographic = Cartographic.fromCartesian(destination)
            // Get the centroid of the track
            const center = centroid(track.content.geometry.coordinates)

            // Get the right position according to Scene Mode
            let position = {}
            switch (lgs.settings.scene.mode.value) {
                case SCENE_MODE_2D.value:
                    // We use centroid
                    position = {
                        longitude: center.geometry.coordinates[0],
                        latitude:  center.geometry.coordinates[1],
                    }
                    break
                default:
                    // We use destination
                    position = {
                        longitude: M.toDegrees(cartographic.longitude),
                        latitude:  M.toDegrees(cartographic.latitude),
                    }

            }
            position.pitch = -90
            position.height = M.toDegrees(cartographic.height)

            __.ui.cameraManager.settings = {
                position: position,
                // target is based on centroid
                target: {
                    longitude: center.geometry.coordinates[0],
                    latitude:  center.geometry.coordinates[1],
                    height:    cartographic.height,
                },
            }

            journey.camera = __.ui.cameraManager.settings

        }
        else {
            __.ui.cameraManager.settings = (action === DRAWING_FROM_UI || action === DRAWING_FROM_DB) ? journey.cameraOrigin : journey.camera
            destination = Cartesian3.fromDegrees(
                __.ui.cameraManager.settings.position.longitude,
                __.ui.cameraManager.settings.position.latitude,
                __.ui.cameraManager.settings.position.height,
            )
        }

        // Depending on what we are doing, we need to convert the destination
        // from world coordinates to scene coordinates
        let convert = false
        if (__.ui.sceneManager.is2D && (action === DRAWING || action === DRAWING_FROM_DB)) {
            convert = true
        }

        SceneUtils.focusOnJourney(bbox)

        // let's go to focus !
        // lgs.camera.flyTo({
        //                      destination:    destination,                               // Camera
        //                      orientation:    {                                         // Offset and Orientation
        //                          heading: M.toRadians(__.ui.cameraManager.settings.position.heading),
        //                          pitch:   M.toRadians(__.ui.cameraManager.settings.position.pitch),
        //                          roll:    M.toRadians(__.ui.cameraManager.settings.position.roll),
        //                      },
        //                      maximumHeight:     lgs.camera.maximumHeight,
        //                      pitchAdjustHeight: lgs.camera.pitchAdjustHeight,
        //                      convert:        convert,
        //                      duration:       lgs.settings.camera.flyingTime,
        //                      endTransform:   Matrix4.IDENTITY,
        //                      easingFunction: EasingFunction.LINEAR_NONE,
        //                  })
        //Show BBox if requested
        if (true) {
            const id = `BBox#${track.slug}`
            // We remove the BBox if it already exists
            if (lgs.viewer.entities.getById(id)) {
                lgs.viewer.entities.removeById(id)
            }
            // Add the BBox
            lgs.viewer.entities.add({
                                        id:        id,
                                        name:      id,
                                        rectangle: {
                                            coordinates: rectangle,
                                            material: Color.WHITE.withAlpha(0.2),
                                        },
                                    })
        }
    }



    /**
     * Filters an array of objects using custom predicates.
     *
     * from https://gist.github.com/jherax/f11d669ba286f21b7a2dcff69621eb72
     *
     * @param  array {Array}   the array to filter
     * @param  filters {Object}  an object with the filter criteria
     * @return {Array}
     */
    static filterArray = (array, filters) => {
        const filterKeys = Object.keys(filters)
        return array.filter(item => {
            // validates all filter criteria
            return filterKeys.every(key => {
                // ignores non-function predicates
                if (typeof filters[key] !== 'function') {
                    return true
                }
                return filters[key](item[key])
            })
        })
    }

    /**
     * Aggregate Geo Json data in order to have longitude, latitude, altitude,time
     * for each point (altitude and time
     *
     * @return {[[{longitude, latitude, altitude,time}]]}
     *
     */
    static prepareDataForMetrics = async () => {
        const dataExtract = []
        // Only for Feature Collections that are Line or multi line string typ
        const type = this.content.geometry.type
        if (this.content.type === FEATURE &&
            [FEATURE_LINE_STRING, FEATURE_MULTILINE_STRING].includes(type)) {
            // According to type (Line or multiline), we transform the
            // coordinates in order to be  in (real or simulated) multiline mode
            const segments = type === FEATURE_LINE_STRING
                             ? [this.content.geometry.coordinates]
                             : this.content.geometry.coordinates
            segments.forEach((segment, index) => {
                const properties = TrackUtils.checkIfDataContainsAltitudeOrTime(feature)
                const newLine = []
                //
                // for (const coordinates of feature.geometry.coordinates) {
                //     let point = {
                //         longitude: coordinates[0], latitude: coordinates[1], altitude: coordinates[2],
                //     }
                //     if (properties.hasTime) {
                //         point.time = feature.properties?.coordinateProperties?.times[index]
                //     }
                //     newLine.push(point)
                // }
                dataExtract.push(newLine)
            })
        }
        return dataExtract
    }

    /**
     * Get elevation from Cesium Terrain
     *
     * @param coordinates
     * @return {altitude}
     */
    static getElevationFromTerrain = async (coordinates) => {
        const positions = []
        let multi = true
        if (!Array.isArray(coordinates)) {
            multi = false
            coordinates = [coordinates]
        }

        coordinates.forEach(point => {
            positions.push(Cartographic.fromDegrees(point.longitude, point.latitude))
        })

        //TODO apply only if altitude is missing for some coordinates
        const altitude = []
        const temp = await sampleTerrainMostDetailed(lgs.viewer.terrainProvider, positions)
        temp.forEach(coordinate => {
            altitude.push(coordinate.height)
        })

        return multi ? altitude : altitude[0]

    }

    /**
     * Search the datasource that contains an entity with a specific id.
     *
     * @param entityId the id of the required entities.
     *
     * @return {DataSource}
     */
    static getDataSourceNameByEntityId = (entityId) => {

        // loop all data sources
        for (let i = 0; i < lgs.viewer.dataSources.length; i++) {
            const item = lgs.viewer.dataSources.get(i)
            // loop all entities inside a data source
            for (let j = 0; j < item.entities.values.length; j++) {
                const child = item.entities.values[j]
                // Until we found one
                if (child.id === entityId) {
                    return item
                }
            }
        }
        // or none
        return undefined
    }

    static getDescription(feature) {
        return feature?.properties?.desc ?? undefined
    }

    /**
     * Read tracks from DB and draw them.
     *
     * Set
     * - lgs.theJourney
     * - lgs.theTrack
     *
     * Add information to the editor.
     *
     */
    static readAllFromDB = async () => {
        // Let's read tracks in DB
        const journeys = await Journey.readAllFromDB()

        // Bail early if there's nothing to read
        if (journeys.length === 0) {
            lgs.mainProxy.readyForTheShow = true
            lgs.theJourney = null
            lgs.theTrack = null
            lgs.thePOI = null
            return
        }

        // We're ready for rendering so let's save journeys
        journeys.forEach(journey => {
            journey.cameraOrigin = journey.camera
        })

        // Get the Current Journey. Then we Set current if it exists in journeys.
        // If not, let's use the first track or null.
        let currentJourney = await lgs.db.lgs1920.get(CURRENT_JOURNEY, CURRENT_STORE)
        const tmp = journeys.filter(value => value.slug === currentJourney)
        currentJourney = (tmp.length > 0) ? tmp[0] : journeys[0]

        if (currentJourney) {
            lgs.theJourney = currentJourney
            lgs.mainProxy.readyForTheShow = true
            await TrackUtils.setTheTrack()
        }
        else {
            // Something's wrong. exit
            return
        }

        // We're ready for rendering so let's save journeys
        journeys.forEach(journey => {
            lgs.saveJourneyInContext(journey)
        })

        // Now instantiate some contexts
        lgs.theJourney.addToContext()
        lgs.theJourney.addToEditor()
        lgs.theTrack.addToContext()
        lgs.theTrack.addToEditor()

        TrackUtils.setProfileVisibility(lgs.theJourney)


        // One step further, let's prepare the drawings
        for (const journey of journeys) {
            await journey.prepareDrawing()
        }


        // Now it's time for the show. Draw all journeys but focus on the current one
        const items = []
        lgs.journeys.forEach(journey => {
            items.push(journey.draw({
                                        action: DRAWING_FROM_DB,
                                        mode:   journey.slug === currentJourney.slug ? FOCUS_ON_FEATURE : NO_FOCUS,
                                    }))
        })
        await Promise.all(items)

        __.ui.cameraManager.settings = lgs.theJourney.cameraOrigin

    }

    static setTheTrack = async (fromDB = true) => {
        // Same for current Track.
        // If we have one, we get it then check if it's part
        // of the current journey. Else we use the first of the list and ad it
        // to the app context.
        let currentTrack = 'nothing'
        if (fromDB) {
            currentTrack = await lgs.db.lgs1920.get(CURRENT_TRACK, CURRENT_STORE)
        }
        if (lgs.theJourney.tracks.has(currentTrack)) {
            lgs.theTrack = lgs.theJourney.tracks.get(currentTrack)
        }
        else {
            lgs.theTrack = lgs.theJourney.tracks.entries().next().value[1]
        }
        // Add it to editor context
        lgs.theTrack.addToEditor()
    }

    /**
     * Get data source by name
     *
     * @param {string} name  name or part of name
     * @param {boolean} strict true find the name, else find all those whose name contains a part of name
     *
     * @return {[DataSource]} array of DataSource
     */
    static getDataSourcesByName(name, strict = false) {
        if (strict) {
            return lgs.viewer.dataSources.getByName(name)
        }
        const dataSources = []
        for (let i = 0; i < lgs.viewer.dataSources.length; i++) {
            const item = lgs.viewer.dataSources.get(i)
            if (item.name.includes(name)) {
                dataSources.push(item)
            }
        }
        return dataSources
    }

    /**
     * Save the current journey into DB
     *
     * @param value
     * @return {Promise<void>}
     */
    static saveCurrentJourneyToDB = async (current) => {
        await lgs.db.lgs1920.put(CURRENT_JOURNEY, current, CURRENT_STORE)
    }

    /**
     * Save the current Track into DB
     *
     * @param value
     * @return {Promise<void>}
     */
    static saveCurrentTrackToDB = async (current) => {
        await lgs.db.lgs1920.put(CURRENT_TRACK, current, CURRENT_STORE)
    }

    /**
     * Save the current POI into DB
     *
     * @param value
     * @return {Promise<void>}
     */
    static saveCurrentPOIToDB = async (current) => {
        await lgs.db.lgs1920.put(CURRENT_POI, current, CURRENT_STORE)
    }

    /**
     * Update POIs visibility
     *
     * For each POI entity in the dedicated data source
     * Dedicated flags are excluded.
     *
     * @param {Journey} journey       the journey on which POIs are to be hidden or displayed
     * @param {Boolean} visibility    the visibility value (true = hide)
     */
    static updatePOIsVisibility = (journey, visibility) => {
        TrackUtils.getDataSourcesByName(journey.slug, true)[0]?.entities.values.forEach(entity => {
            if (entity.id.startsWith(POI_STD)) {
                entity.show = POIUtils.setPOIVisibility(journey.pois.get(entity.id), visibility)
            }
        })

    }

    /**
     * Update Flags visibility
     *
     * For each Flag entity in the dedicated data source
     *
     * @param {Journey}  journey        the track on which flags are to be hidden or displayed
     * @param {Track}  track            the track on which flags are to be hidden or displayed
     * @param {string} type             flag type (start | stop)
     * @param {Boolean} visibility      the visibility value (true = hide)
     *
     */
    static updateFlagsVisibility = (journey, track, type = 'start', visibility) => {
        TrackUtils.getDataSourcesByName(journey.slug, true)[0].entities.values.forEach(entity => {
            // Filter flags on the right track
            const current = TrackUtils.getTrackFromEntityId(journey, entity.id)
            if (entity.id.startsWith(POI_FLAG) && entity.id.endsWith(type) && current.slug === track.slug) {
                entity.show = POIUtils.setPOIVisibility(
                    track.flags[entity.id.endsWith(POI_FLAG_START) ? 'start' : 'stop'], visibility,
                )
            }
        })
    }

    /**
     * Update journey visibility
     *
     * We force all the tracks datasource and the dedicated flags entities
     * to <visibility>
     *
     * @param {Journey} journey       the journey to hide or show
     * @param {Boolean} visibility    the visibility value (true = hide)
     *
     */
    static updateJourneyVisibility = (journey, visibility) => {
        // We get all data sources associated to the journey
        TrackUtils.getDataSourcesByName(journey.slug).forEach(dataSource => {
            // For flags, we need to manage entities.
            if (dataSource.name === journey.slug) {
                dataSource.show = visibility
            }
            else {
                // We set the datasource with all entities.
                dataSource.show = visibility ? journey.tracks.get(dataSource.name).visible : false
            }
        })
    }

    /**
     * Get the track that contains a flag with given slug
     *
     * @param {Journey} journey       the journey
     * @param {string}  entityId      the id
     *
     * @return {Track}
     */
    static getTrackFromEntityId = (journey, entityId) => {
        for (const track of journey.tracks.values()) {
            // Entity id = <track|flag>#<journey>#<track>[-<start|stop>]
            // Track slug is : track#<journey>#<track>
            // flag slug is  flag#<journey>#<track>-<start|stop>
            if (entityId.includes(track.slug.split('#')[2])) {
                return track
            }
        }
    }

    /**
     * Update Track visibility
     *
     * We force the track datasource and the dedicated flags entities
     * to <visibility>
     *
     * @param {Journey} journey     The journey
     * @param {Track} track         The track to hide or show
     * @param {boolean} visibility  The visibility value (true = hide)
     *
     */
    static updateTrackVisibility = (journey, track, visibility) => {
        // Update the track visibility
        TrackUtils.getDataSourcesByName(track.slug).forEach(dataSource => {
            dataSource.show = visibility ? journey.tracks.get(dataSource.name).visible : false
        })

    }

    /**
     * Set the profil visibility, according to some criterias
     *
     * @return {boolean}
     */
    static setProfileVisibility(journey) {
        lgs.mainProxy.canViewProfile =
            lgs.settings.getProfile.show &&              // By configuration
            journey !== undefined &&                        // During init
            journey !== null &&                             // same
            journey.visible &&                              // Journey visible
            lgs.mainProxy.canViewJourneyData &&            // can view data
            Array.from(journey.tracks.values())             // Has Altitude for each track
                .every(track => track.hasAltitude)

    }

    /**
     * Read a journey
     *
     *
     * @param {} journey {
     *           name:      file name,
     *           extension: file extension
     *           content : content
     * }
     *
     * @return {Promise<number>}
     */
    static loadJourneyFromFile = async (journey) => {

        // uploading a file exits full screen mode, so we force the state
        const mainStore = lgs.mainProxy
        mainStore.fullSize = false

        try {
            // File is correct let's work with
            if (journey !== undefined) {

                // if (journey.extension === 'json' && typeof journey.content === 'string') {
                //     journey.content = JSON.parse(journey.content)
                // }

                let theJourney = await Journey.create(journey.name, journey.extension, {
                    content:     journey.content,
                    allowRename: false,
                })
                // Check if the track already exists in context
                // If not we manage and show it.
                if (lgs.getJourneyBySlug(theJourney.slug)?.slug === undefined) {

                    theJourney.globalSettings()

                    // Need stats
                    theJourney.extractMetrics()
                    // Prepare the contexts and current values
                    theJourney.addToContext()
                    theJourney.addToEditor()

                    const theTrack = lgs.theJourney.tracks.entries().next().value[1]
                    theTrack.addToContext()
                    theTrack.addToEditor()

                    TrackUtils.setProfileVisibility(lgs.theJourney)

                    await theJourney.persistToDatabase()
                    await theJourney.saveOriginDataToDB()

                    mainStore.canViewJourneyData = true
                    await theJourney.draw({action: ADD_JOURNEY})

                    await __.ui.cameraManager.stopRotate()

                    __.ui.profiler.draw()

                    return JOURNEY_OK
                }
                else {
                    // It exists, we notify it
                    UIToast.warning({
                                        caption: `This journey has already been loaded!`,
                                        text:    'Please select another one!',
                                    })
                    return JOURNEY_EXISTS
                }
            }
        }
        catch (error) {
            console.error(error)
            UIToast.error({
                              caption: `We're having problems reading this journey file!`,
                              text: 'Maybe the format is wrong!',
                          })
            return JOURNEY_KO
        }
    }

    static removeAllTracks = (slug) => {
        const dataSources = TrackUtils.getDataSourcesByName(slug)
        dataSources.forEach(dataSource => {
            lgs.viewer.dataSources.remove(dataSource)
        })
        lgs.scene.requestRender()
    }
}

