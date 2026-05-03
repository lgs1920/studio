/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TrackUtils.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-20
 * Last modified: 2026-04-20
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    ADD_JOURNEY, CURRENT_JOURNEY, CURRENT_POI, CURRENT_STORE, CURRENT_TRACK, DEFAULT_2D_FOCUS_PITCH, DRAWING_FROM_DB,
    DRAWING_FROM_UI, FOCUS_ON_FEATURE, NO_FOCUS, REFRESH_DRAWING, SCENE_MODE_2D,
}                                                      from '@Core/constants'
import { Journey }                                     from '@Core/Journey'
import bbox                                            from '@turf/bbox'
import { default as centroid }                         from '@turf/centroid'
import { SceneUtils }                                  from '@Utils/cesium/SceneUtils'
import { getTrackRenderContent, trackRenderSmoothingKey } from '@Utils/cesium/trackRenderSmoothing'
import {
    normalizeTrackRenderStyle,
    TRACK_RENDER_WIDTH_UNITS,
}                                                      from '@Utils/cesium/trackRenderStyle'
import {
    CallbackProperty, Cartesian2, Cartesian3, Cartographic, Color as CColor, CustomDataSource,
    GeoJsonDataSource, Math as M, PolylineDashMaterialProperty, PolylineOutlineMaterialProperty,
    Rectangle, sampleTerrainMostDetailed, SceneTransforms,
}                                                      from 'cesium'
import { UIToast }                                     from '../UIToast.js'
import { POI_FLAG, POI_FLAG_START, POI_STD, POIUtils } from './POIUtils'

export const FEATURE = 'Feature'
export const FEATURE_COLLECTION = 'FeatureCollection'
export const FEATURE_LINE_STRING = 'LineString'
export const FEATURE_MULTILINE_STRING = 'MultiLineString'
export const FEATURE_POINT = 'Point'

export const JOURNEY_KO = 0
export const JOURNEY_OK = 1
export const JOURNEY_EXISTS = 2
export const JOURNEY_WAITING = 3
export const JOURNEY_DENIED = 4

const TRACK_STYLE_ENTITY_MARKER = '#lgs-track-style#'
const EARTH_RADIUS_METERS = 6378137

const isTrackStyleEntity = entity => `${entity?.id ?? ''}`.includes(TRACK_STYLE_ENTITY_MARKER)

export const ALREADY_IMPORTED = {
    /** The file or resource is already present */
    caption: 'Already exists!',
    text:    'has already been imported. Please select another file.',
}

export const IMPORT_SUCCESS = {
    /** Confirmation of successful processing */
    caption: 'Import successful!',
    text:    'has been imported successfully.',
}

export const IMPORT_FAILED = {
    /** General failure notification */
    caption: 'Import failed!',
    text:    'has failed to import. Maybe the format is wrong!',
}
export const IMPORT_NOT_SUPPORTED = {
    /** General failure notification */
    caption: 'Invalid Format!',
    text:    'is not supported.',
}

export const IMPORT_LOADING_ERROR = {
    caption: 'Import failed!',
    text:    'An error occurred while loading',
}

export class TrackUtils {

    static MIMES = {
        gpx: ['application/gpx+xml', 'vnd.gpxsee.map+xml', 'application/octet-stream'],
        geojson: ['application/geo+json', 'application/json'],
        kml: ['vnd.google-earth.kml+xml'],
    }
    /**
     * Check if the current feature contains times and altitudes
     *
     * @return {Object} {hasAltitude: boolean, hasTime: boolean}
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
            hasAltitude: hasAltitude,
            hasTime:     feature.properties?.coordinateProperties?.times !== undefined,
        }
    })

    /**
     * Filter a list of files to import only new and valid ones.
     * Prevents re-testing already loaded files and handles errors individually.
     * * @param {Array} files List of files to process
     * @returns {Promise<Array>} The list of files that were successfully added
     */
    static bulkLoadJourneys = async (files) => {
        const successfulImports = []

        for (const file of files) {
            // Check existence by slug before processing to avoid overhead
            const slug = Journey.generateSlug(file.name)

            if (lgs.journeys.has(slug)) {
                UIToast.warning({
                                    caption: ALREADY_IMPORTED.caption,
                                    text:    `${file.name} ${ALREADY_IMPORTED.text}`,
                                })
                continue
            }

            const result = await TrackUtils.loadJourneyFromFile(file)
            if (result === JOURNEY_OK) {
                successfulImports.push(file)
            }
        }
        return successfulImports
    }

    /**
     * Process a single journey file
     *
     * @param {Object} journey {name, extension, content}
     * @return {Promise<number>} Result status
     */
    static loadJourneyFromFile = async (journey) => {
        const mainStore = lgs.stores.main
        mainStore.fullSize = false

        try {
            if (!journey) {
                return JOURNEY_KO
            }

            let theJourney = await Journey.create(journey.name, journey.extension, {
                content:     journey.content,
                allowRename: false,
            })

            // Final check on generated instance slug
            if (!lgs.journeys.has(theJourney.slug)) {
                theJourney.globalSettings()
                theJourney.extractMetrics()
                theJourney.addToContext()
                theJourney.addToEditor()

                const theTrack = lgs.theJourney.tracks.entries().next().value?.[1]
                theTrack?.addToContext()
                theTrack?.addToEditor()

                TrackUtils.setProfileVisibility(lgs.theJourney)

                await theJourney.persistToDatabase()
                await theJourney.saveOriginDataToDB()

                mainStore.canViewJourneyData = true
                await theJourney.draw({action: ADD_JOURNEY})

                await __.ui.cameraManager.stopRotate()
                __.ui.profiler.draw()

                return JOURNEY_OK
            }

            return JOURNEY_EXISTS

        }
        catch (error) {
            console.error('Import failed:', error)
            UIToast.error({
                              caption: IMPORT_FAILED.caption,
                              text:    `${journey.name} ${IMPORT_FAILED.text}`,
                          })
            return JOURNEY_KO
        }
    }

    /**
     * Prepare all the Datasources for the tacks and POIs drawings
     *
     * @param {Journey} journey
     * @return {Promise<void>}
     */
    static prepareDrawing = async journey => {
        const dataSources = []

        journey.tracks.forEach(track => {
            dataSources.push(
                lgs.viewer.dataSources.add(new GeoJsonDataSource(track.slug)))
        })

        dataSources.push(
            lgs.viewer.dataSources.add(new CustomDataSource(journey.slug)))

        await Promise.all(dataSources)
    }

    static getTrackRenderStyle = track => normalizeTrackRenderStyle(track?.renderStyle, {
        color:     track?.color,
        thickness: track?.thickness,
    })

    static cssColor = (value, fallback = CColor.WHITE) => CColor.fromCssColorString(value ?? '') ?? fallback

    static createTrackMaterial = (style, color = style.color) => {
        if (style.dash.enabled) {
            return new PolylineDashMaterialProperty({
                                                        color:       TrackUtils.cssColor(color),
                                                        gapColor:    TrackUtils.cssColor(style.dash.gapColor, CColor.TRANSPARENT),
                                                        dashLength:  style.dash.dashLength,
                                                        dashPattern: style.dash.dashPattern,
                                                    })
        }

        return new PolylineOutlineMaterialProperty({
                                                       color:        TrackUtils.cssColor(color),
                                                       outlineWidth: 0,
                                                   })
    }

    static getTrackReferencePoint = track => {
        try {
            const center = centroid(track.content)
            const coordinates = center?.geometry?.coordinates
            if (!Array.isArray(coordinates) || coordinates.length < 2) {
                return null
            }

            return {
                longitude: coordinates[0],
                latitude:  coordinates[1],
                height:    coordinates[2] ?? 0,
            }
        }
        catch {
            return null
        }
    }

    static meterWidthToPixels = (track, meters) => {
        const referencePoint = TrackUtils.getTrackReferencePoint(track)
        if (!referencePoint || !lgs?.scene || !lgs?.camera) {
            return 0
        }

        const latitudeRad = M.toRadians(referencePoint.latitude)
        const cosLatitude = Math.max(0.05, Math.abs(Math.cos(latitudeRad)))
        const longitudeOffset = M.toDegrees(meters / (EARTH_RADIUS_METERS * cosLatitude))
        const height = referencePoint.height ?? 0
        const start = SceneTransforms.wgs84ToWindowCoordinates(
            lgs.scene,
            Cartesian3.fromDegrees(referencePoint.longitude, referencePoint.latitude, height),
        )
        const end = SceneTransforms.wgs84ToWindowCoordinates(
            lgs.scene,
            Cartesian3.fromDegrees(referencePoint.longitude + longitudeOffset, referencePoint.latitude, height),
        )

        return start && end ? Cartesian2.distance(start, end) : 0
    }

    static createTrackWidthProperty = (track, style, meterWidth, pixelWidth) => {
        if (style.widthUnit !== TRACK_RENDER_WIDTH_UNITS.METERS) {
            return pixelWidth
        }

        return new CallbackProperty(() => {
            const meterPixels = TrackUtils.meterWidthToPixels(track, meterWidth)
            return meterPixels > style.meterPixelThreshold ? meterPixels : pixelWidth
        }, false)
    }

    static removeTrackStyleEntities = source => {
        source.entities.values
              .filter(isTrackStyleEntity)
              .forEach(entity => source.entities.remove(entity))
    }

    static applyTrackRenderStyle = (source, track) => {
        const style = TrackUtils.getTrackRenderStyle(track)
        TrackUtils.removeTrackStyleEntities(source)

        const baseEntities = source.entities.values.filter(entity => entity.polyline && !isTrackStyleEntity(entity))
        const mainMaterial = TrackUtils.createTrackMaterial(style)

        baseEntities.forEach(entity => {
            const positions = entity.polyline.positions
            if (style.underlay.enabled) {
                source.entities.add({
                                        id:       `${entity.id}${TRACK_STYLE_ENTITY_MARKER}underlay`,
                                        polyline: {
                                            positions,
                                            clampToGround: true,
                                            width:         TrackUtils.createTrackWidthProperty(
                                                track,
                                                style,
                                                style.underlay.meterWidth,
                                                style.underlay.pixelWidth,
                                            ),
                                            material:      TrackUtils.createTrackMaterial({
                                                                                              ...style,
                                                                                              dash: {
                                                                                                  ...style.dash,
                                                                                                  enabled: false,
                                                                                              },
                                                                                          },
                                                                                          style.underlay.color),
                                            zIndex:        1,
                                        },
                                    })
            }

            entity.polyline.clampToGround = true
            entity.polyline.material = mainMaterial
            entity.polyline.width = TrackUtils.createTrackWidthProperty(
                track,
                style,
                style.meterWidth,
                style.farPixelWidth,
            )
            entity.polyline.zIndex = 2
        })
    }

    /**
     * Show the Track on the map
     *
     * @param {Track} track
     * @param {Object} options
     */
    static draw = async (track, {action = DRAWING_FROM_UI, forcedToHide = false}) => {
        const source = lgs.viewer.dataSources.getByName(track.slug)[0]
        if (!source) {
            return
        }

        switch (action) {
            case DRAWING_FROM_DB:
            case ADD_JOURNEY:
            case REFRESH_DRAWING:
            case DRAWING_FROM_UI: {
                const smoothingKey = trackRenderSmoothingKey(track)
                const needsGeometryLoad = [DRAWING_FROM_DB, ADD_JOURNEY].includes(action)
                                          || source.entities.values.length === 0
                                          || source.__lgsRenderSmoothingKey !== smoothingKey
                if (needsGeometryLoad) {
                    await source.load(getTrackRenderContent(track), {
                        clampToGround: true,
                        name:          track.title,
                    })
                    source.__lgsRenderSmoothingKey = smoothingKey
                }
                TrackUtils.applyTrackRenderStyle(source, track)
                break
            }
        }
        source.show = forcedToHide ? false : track.visible
        lgs.viewer.scene.requestRender()
    }

    /**
     * Focus on a journey or track
     */
    static focus = async ({
                              action = 0,
                              journey = null,
                              track = null,
                              showBbox = false,
                              resetCamera = false,
                          }) => {

        if (track === null) {
            if (journey === null) {
                journey = lgs.theJourney
            }
            track = journey.tracks.values().next().value
        }
        else {
            journey = lgs.journeys.get(track.parent)
        }

        const trackBbox = TrackUtils.extendBbox(bbox(track.content), 0)
        let rectangle = Rectangle.fromDegrees(trackBbox[0], trackBbox[1], trackBbox[2], trackBbox[3])

        if (journey.camera === null || resetCamera) {
            const destination = lgs.camera.getRectangleCameraCoordinates(rectangle)
            const cartographic = Cartographic.fromCartesian(destination)
            const center = centroid(track.content.geometry.coordinates)

            let position
            switch (lgs.settings.scene.mode.value) {
                case SCENE_MODE_2D.value:
                    position = {
                        longitude: center.geometry.coordinates[0],
                        latitude:  center.geometry.coordinates[1],
                    }
                    break
                default:
                    position = {
                        longitude: M.toDegrees(cartographic.longitude),
                        latitude:  M.toDegrees(cartographic.latitude),
                    }
            }
            position.pitch = DEFAULT_2D_FOCUS_PITCH
            position.height = M.toDegrees(cartographic.height)

            __.ui.cameraManager.settings = {
                position: position,
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
        }

        SceneUtils.focusOnJourney(trackBbox)

        if (showBbox) {
            const id = `BBox#${track.slug}`
            if (lgs.viewer.entities.getById(id)) {
                lgs.viewer.entities.removeById(id)
            }
            lgs.viewer.entities.add({
                                        id:        id,
                                        name:      id,
                                        rectangle: {
                                            coordinates: rectangle,
                                            material: CColor.WHITE.withAlpha(0.2),
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
     * Aggregate Geo Json data for metrics
     */
    static prepareDataForMetrics = async function () {
        const dataExtract = []
        const type = this.content.geometry.type
        if (this.content.type === FEATURE && [FEATURE_LINE_STRING, FEATURE_MULTILINE_STRING].includes(type)) {
            const segments = type === FEATURE_LINE_STRING
                             ? [this.content.geometry.coordinates]
                             : this.content.geometry.coordinates
            segments.forEach(() => {
                const newLine = []
                dataExtract.push(newLine)
            })
        }
        return dataExtract
    }

    /**
     * Get elevation from Cesium Terrain
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

        const altitude = []
        const temp = await sampleTerrainMostDetailed(lgs.viewer.terrainProvider, positions)
        temp.forEach(coordinate => {
            altitude.push(coordinate.height)
        })

        return multi ? altitude : altitude[0]
    }

    /**
     * Search datasource by entity id
     */
    static getDataSourceNameByEntityId = (entityId) => {
        for (let i = 0; i < lgs.viewer.dataSources.length; i++) {
            const item = lgs.viewer.dataSources.get(i)
            for (let j = 0; j < item.entities.values.length; j++) {
                const child = item.entities.values[j]
                if (child.id === entityId) {
                    return item
                }
            }
        }
        return undefined
    }

    static getDescription(feature) {
        return feature?.properties?.desc ?? undefined
    }

    /**
     * Initialize state from DB
     */
    static readAllFromDB = async () => {
        const journeys = await Journey.readAllFromDB()

        if (journeys.length === 0) {
            lgs.stores.main.readyForTheShow = true
            lgs.theJourney = null
            lgs.theTrack = null
            lgs.thePOI = null
            return
        }

        journeys.forEach(journey => {
            journey.cameraOrigin = journey.camera
        })

        let currentJourneyName = await lgs.db.lgs1920.get(CURRENT_JOURNEY, CURRENT_STORE)
        const tmp = journeys.filter(value => value.slug === currentJourneyName)
        const currentJourney = (tmp.length > 0) ? tmp[0] : journeys[0]

        if (currentJourney) {
            lgs.theJourney = currentJourney
            lgs.stores.main.readyForTheShow = true
            await TrackUtils.setTheTrack()
        }

        journeys.forEach(journey => {
            lgs.saveJourneyInContext(journey)
        })

        lgs.theJourney.addToContext()
        lgs.theJourney.addToEditor()
        lgs.theTrack?.addToContext()
        lgs.theTrack?.addToEditor()

        TrackUtils.setProfileVisibility(lgs.theJourney)

        for (const journey of journeys) {
            await journey.prepareDrawing()
        }

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
        if (lgs.theJourney.tracks.size === 0) {
            lgs.theTrack = null
            return
        }

        let currentTrack = null
        if (fromDB) {
            currentTrack = await lgs.db.lgs1920.get(CURRENT_TRACK, CURRENT_STORE)
        }

        if (currentTrack && lgs.theJourney.tracks.has(currentTrack)) {
            lgs.theTrack = lgs.theJourney.tracks.get(currentTrack)
        }
        else {
            try {
                lgs.theTrack = lgs.theJourney.tracks.values().next().value ?? null
            }
            catch {
                lgs.theTrack = null
            }
        }
        lgs.theTrack?.addToEditor()
    }

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

    static saveCurrentJourneyToDB = async current => {
        await lgs.db.lgs1920.put(CURRENT_JOURNEY, current.slug, CURRENT_STORE)
    }

    static saveCurrentTrackToDB = async current => {
        await lgs.db.lgs1920.put(CURRENT_TRACK, current, CURRENT_STORE)
    }

    static saveCurrentPOIToDB = async current => {
        await lgs.db.lgs1920.put(CURRENT_POI, current, CURRENT_STORE)
    }

    static updatePOIsVisibility = (journey, visibility) => {
        TrackUtils.getDataSourcesByName(journey.slug, true)[0]?.entities.values.forEach(entity => {
            if (entity.id.startsWith(POI_STD)) {
                entity.show = POIUtils.setPOIVisibility(__.ui.poiManager.get(entity.id), visibility)
            }
        })
    }

    static updateFlagsVisibility = (journey, track, type = 'start', visibility) => {
        TrackUtils.getDataSourcesByName(journey.slug, true)[0]?.entities.values.forEach(entity => {
            const current = TrackUtils.getTrackFromEntityId(journey, entity.id)
            if (entity.id.startsWith(POI_FLAG) && entity.id.endsWith(type) && current?.slug === track.slug) {
                entity.show = POIUtils.setPOIVisibility(
                    track.flags[entity.id.endsWith(POI_FLAG_START) ? 'start' : 'stop'], visibility,
                )
            }
        })
    }

    static updateJourneyVisibility = (journey, visibility) => {
        TrackUtils.getDataSourcesByName(journey.slug).forEach(dataSource => {
            if (dataSource.name === journey.slug) {
                dataSource.show = visibility
            }
            else {
                dataSource.show = visibility ? journey.tracks.get(dataSource.name).visible : false
            }
        })
    }

    static getTrackFromEntityId = (journey, entityId) => {
        for (const track of journey.tracks.values()) {
            if (entityId.includes(track.slug.split('#')[2])) {
                return track
            }
        }
    }

    static updateTrackVisibility = (journey, track, visibility) => {
        TrackUtils.getDataSourcesByName(track.slug).forEach(dataSource => {
            dataSource.show = visibility ? journey.tracks.get(dataSource.name).visible : false
        })
    }

    static setProfileVisibility(journey) {
        lgs.stores.main.canViewProfile =
            lgs.settings.widgets['profile-widget'].configuration.default.show &&
            journey !== undefined &&
            journey !== null &&
            journey.visible &&
            lgs.stores.main.canViewJourneyData &&
            Array.from(journey.tracks.values()).every(track => track.hasAltitude)
    }

    static removeAllTracks = (slug) => {
        const dataSources = TrackUtils.getDataSourcesByName(slug)
        dataSources.forEach(dataSource => {
            lgs.viewer.dataSources.remove(dataSource)
        })
        lgs.viewer.scene.requestRender()
    }
}
