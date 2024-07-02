import { default as extent }                                         from '@mapbox/geojson-extent'
import { default as centroid }                                       from '@turf/centroid'
import * as Cesium                                                   from 'cesium'
import { Color, CustomDataSource, GeoJsonDataSource, Math, Matrix4 } from 'cesium'
import {
    FLAG_START, FOCUS_ON_FEATURE, INITIAL_LOADING, Journey, NO_FOCUS, POI_FLAG, POI_STD,
}                                                                    from '../../core/Journey'
import {
    APP_KEY, CURRENT_JOURNEY, CURRENT_POI, CURRENT_STORE, CURRENT_TRACK,
}                                                                    from '../../core/LGS1920Context.js'
import {
    Camera as CameraManager,
}                                                                    from '../../core/ui/Camera.js'
import { FileUtils }                                                 from '../FileUtils.js'
import { UIToast }                                                   from '../UIToast.js'
import { POIUtils }                                                  from './POIUtils'

export const SUPPORTED_EXTENSIONS = ['geojson', 'json','kml', 'gpx' /* TODO 'kmz'*/]
export const FEATURE                  = 'Feature',
             FEATURE_COLLECTION       = 'FeatureCollection',
             FEATURE_LINE_STRING      = 'LineString',
             FEATURE_MULTILINE_STRING = 'MultiLineString',
             FEATURE_POINT            = 'Point'

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
     * We need to create a common data source for some elements that are note related to tracks nor journeys
     */
    static createCommonMapObjectsStore = async () => {
        if (lgs.viewer.dataSources.getByName(APP_KEY, true).length === 0) {
            await lgs.viewer.dataSources.add(new CustomDataSource(APP_KEY))
        }
    }

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

        // Manage Tracks
        journey.tracks.forEach(track => {
            dataSources.push(
                lgs.viewer.dataSources.add(new GeoJsonDataSource(track.slug)))
        })

        // Manage POIs
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
    static draw = async (track, {action = INITIAL_LOADING, mode = FOCUS_ON_FEATURE, forcedToHide = false}) => {
        // Load Geo Json for track then set visibility
        const source = lgs.viewer.dataSources.getByName(track.slug)[0]
        return source.load(track.content,
            {
                stroke: Color.fromCssColorString(track.color),
                strokeWidth: track.thickness,
                // Common options
                clampToGround: true,
                name: track.title,
            },
        ).then(dataSource => {
            dataSource.show = forcedToHide ? false : track.visible
        })
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
    static focus = async ({action = 0, journey = null, track = null, showBbox = false}) => {

        // If track not provided, we'll get the first one of the journey
        if (track === null) {
            // But we need to set the journey to the current one if there is no information
            if (journey === null) {
                journey = lgs.theJourney
            }
            track = journey.tracks.values().next().value
        } else {
            // We have a track, let's force the journey (even if there is one provided)
            journey = lgs.journeys.get(track.parent)
        }

        // We calculate the Bounding Box and enlarge it by 20%
        // in order to be sure to have the full track inside the window
        const bbox = TrackUtils.extendBbox(extent(track.content), 20)
        let rectangle = Cesium.Rectangle.fromDegrees(bbox[0], bbox[1], bbox[2], bbox[3])

        // Get the right camera information
        let camera,destination
        if (journey.camera === null) {
            // Let's center to the rectangle
            destination = lgs.camera.getRectangleCameraCoordinates(rectangle)

            // Get the camera target that we defined to the centroid of the track
            const centroiid = centroid(track.content)
            const target = {
                longitude:centroiid.geometry.coordinates[1],
                latitude:centroiid.geometry.coordinates[0],
                height:Cesium.Math.toDegrees(destination.z), // We take the same
            }
            camera = new CameraManager({
                longitude:Cesium.Math.toDegrees(destination.x),
                latitude:Cesium.Math.toDegrees(destination.y),
                height:Cesium.Math.toDegrees(destination.z),
                target:target,
            })
            camera.pitch = -90



        } else {
            camera = (action === INITIAL_LOADING) ? journey.cameraOrigin : journey.camera
            destination =Cesium.Cartesian3.fromDegrees(camera.longitude, camera.latitude, camera.height)
        }
//      destination =Cesium.Cartesian3.fromDegrees(camera.longitude, camera.latitude, camera.height)


        lgs.camera.flyTo({
            destination: destination,                               // Camera
             orientation: {                                         // Offset and Orientation
                heading: Math.toRadians(camera.heading),
                 pitch: Math.toRadians(camera.pitch),
                 roll: Math.toRadians(camera.roll),
             },
            maximumHeight: camera.target.height + 2000,
            pitchAdjustHeight: 200,
            endTransform:Matrix4.IDENTITY,
        })
        //Show BBox if requested
        if (showBbox) {
            lgs.viewer.entities.add({
                name: `BBox#${track.slug}`,
                rectangle: {
                    coordinates: rectangle,
                    material: Cesium.Color.WHITE.withAlpha(0.1),
                },
            })
        }
    }

    static extendBbox = (bbox, x, y = undefined) => {
        if (!y) {
            y = x
        }
        x /= 100
        y /= 100

        const w = bbox[2] - bbox[0]
        const h = bbox[3] - bbox[1]

        return [bbox[0] - x * w, bbox[1] - y * h, bbox[2] + x * w, bbox[3] + y * h]
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
                if (typeof filters[key] !== 'function') return true
                return filters[key](item[key])
            })
        })
    }

    /**
     * Aggregate Geo Json data in order to have longitude, latitude, altitude,time
     * for each point (altitude and time
     *
     * @param geoJson
     * @return {[[{longitude, latitude, altitude,time}]]}
     *
     */
    static prepareDataForMetrics = async geoJson => {
        const dataExtract = [] = []
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
        coordinates.forEach(coordinate => {
            positions.push(Cesium.Cartographic.fromDegrees(coordinate[0], coordinate[1]))
        })

        //TODO apply only if altitude is missing for some coordinates
        const altitude = []
        const temp = await Cesium.sampleTerrainMostDetailed(lgs.viewer.terrainProvider, positions)
        temp.forEach(coordinate => {
            altitude.push(coordinate.altitude)
        })

        return altitude

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

        // The add event for the camera
        __.ui.camera.addUpdateEvent()

        // Bail early if there's nothing to read
        if (journeys.length === 0) {
            lgs.theJourney = null
            lgs.theTrack = null
            lgs.thePOI = null
            return
        }

        // We're ready for rendering so let's ave journeys
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
            await TrackUtils.setTheTrack()
        } else {
            // Something's wrong. exit
            return
        }

        // We're ready for rendering so let's save journeys
        journeys.forEach(journey => {
            lgs.saveJourney(journey)
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
                action: INITIAL_LOADING,
                mode: journey.slug === currentJourney.slug ? FOCUS_ON_FEATURE : NO_FOCUS,
            }))
        })
        await Promise.all(items)

        await TrackUtils.createCommonMapObjectsStore()

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
        } else {
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
    static  updatePOIsVisibility = (journey, visibility) => {
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
    static  updateFlagsVisibility = (journey, track, type = 'start', visibility) => {
        TrackUtils.getDataSourcesByName(journey.slug, true)[0].entities.values.forEach(entity => {
            // Filter flags on the right track
            const current = TrackUtils.getTrackFromEntityId(journey, entity.id)
            if (entity.id.startsWith(POI_FLAG) && entity.id.endsWith(type) && current.slug === track.slug) {
                entity.show = POIUtils.setPOIVisibility(
                    track.flags[entity.id.endsWith(FLAG_START) ? 'start' : 'stop'], visibility,
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
                dataSource.entities.values.forEach(entity => {
                    // Filter flags
                    if (entity.id.startsWith(POI_FLAG)) {
                        const track = TrackUtils.getTrackFromEntityId(journey, entity.id)
                        entity.show = POIUtils.setPOIVisibility(
                            track.flags[entity.id.endsWith(FLAG_START) ? 'start' : 'stop'], visibility,
                        )
                    }
                })
            } else {
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
        // Update the associated flags
        TrackUtils.updateFlagsVisibility(journey, track, 'start', visibility)
        TrackUtils.updateFlagsVisibility(journey, track, 'stop', visibility)

    }

    /**
     * Set the profil visibility, according to some criterias
     *
     * @return {boolean}
     */
    static setProfileVisibility(journey) {
        lgs.mainProxy.canViewProfile =
            lgs.configuration.profile.show &&              // By configuration
            journey !== undefined &&                        // During init
            journey !== null &&                             // same
            journey.visible &&                              // Journey visible
            lgs.mainProxy.canViewJourneyData &&            // can view data
            Array.from(journey.tracks.values())             // Has Altitude for each track
                .every(track => track.hasAltitude)

    }

    static uploadJourneyFile = async () => {

        // uploading a file exits full screen mode, so we force the state
        const mainStore = lgs.mainProxy
        mainStore.fullSize = false

        const journey = await  FileUtils.uploadFileFromFrontEnd({
                accepted: SUPPORTED_EXTENSIONS, mimes: TrackUtils.MIMES,
            })

        // File is correct let's work with
        if (journey !== undefined) {
            let theJourney = new Journey(journey.name, journey.extension, {content: journey.content})
            // Check if the track already exists in context
            // If not we manage and show it.
            if (lgs.getJourneyBySlug(theJourney.slug)?.slug === undefined) {
                if (!theJourney.hasAltitude) {
                    mainStore.modals.altitudeChoice.show = true
                }
                // Need stats
                theJourney.extractMetrics()
                // Prepare the contexts and current values
                theJourney.addToContext()
                theJourney.addToEditor()

                const theTrack = lgs.theJourney.tracks.entries().next().value[1]
                theTrack.addToEditor()

                TrackUtils.setProfileVisibility(lgs.theJourney)

                await theJourney.saveToDB()
                await theJourney.saveOriginDataToDB()

                mainStore.canViewJourneyData = true
                await theJourney.draw({})

                await TrackUtils.createCommonMapObjectsStore()
                __.ui.profiler.draw()

                __.ui.camera.stop360()
                __.ui.camera.addUpdateEvent()

            } else {
                // It exists, we notify it
                UIToast.warning({
                    caption: `This journey has already been loaded!`,
                    text: 'Please select another one !',
                })
            }
        }
    }
}
