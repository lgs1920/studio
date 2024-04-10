import { default as extent }        from '@mapbox/geojson-extent'
import * as Cesium                  from 'cesium'
import { Color, GeoJsonDataSource } from 'cesium'
import {
    FOCUS_ON_FEATURE, INITIAL_LOADING, Journey, NO_FOCUS, RE_LOADING, SIMULATE_ALTITUDE,
}                                   from '../../classes/Journey'
import {
    CURRENT_JOURNEY, CURRENT_STORE,
}                                   from '../../classes/VT3D'
import { FileUtils }                from '../FileUtils.js'
import { UINotifier }               from '../UINotifier'
import { EntitiesUtils }            from './EntitiesUtils'

export const ACCEPTED_TRACK_FILES = ['.geojson', '.kml', '.gpx' /* TODO '.kmz'*/]
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
        const test = feature.properties?.coordinateProperties?.times
        return {
            hasAltitude: hasAltitude, hasTime: feature.properties?.coordinateProperties?.times !== undefined,
        }
    })

    /**
     * Load a Journey file
     *
     * return
     *
     * @return {Promise}
     *
     */
    static async loadJourneyFromFile() {
        return FileUtils.uploadFileFromFrontEnd({
            accepted: ACCEPTED_TRACK_FILES, mimes: TrackUtils.MIMES,
        })
    }

    /**
     * Show theJourney on the map
     *
     * @param {Track} track
     * @param action
     * @param mode
     */
    static loadTrack = async (track, action = INITIAL_LOADING, mode = FOCUS_ON_FEATURE) => {
        const configuration = vt3d.configuration

        const trackStroke = {
            color: Color.fromCssColorString(track.color), thickness: track.thickness,
        }
        const routeStroke = {
            color: Color.fromCssColorString(configuration.route.color), thickness: configuration.route.thickness,
        }
        const commonOptions = {
            clampToGround: true, name: track.title,
        }

        // Load Geo Json
        let source = null
        if (action === RE_LOADING) {
            // We get existing datasource
            source = vt3d.viewer.dataSources.getByName(track.slug)[0]
        } else {
            // It's a new track... But with strict mode, in developermode, we got twice, so let's
            // check to have only one
            source = /*vt3d.viewer.dataSources.getByName(track.slug)[0] ??*/ new GeoJsonDataSource(track.slug)
        }

        return source.load(track.content, {
            ...commonOptions, stroke: trackStroke.color, strokeWidth: trackStroke.thickness,
        }).then(dataSource => {

            dataSource.entities.values.forEach(entity => {
                // Masks  the legacy POIs then for all other entities, visibility is
                // based ontrack visibility
                if (entity.billboard) {
                    if (!entity.id.startsWith('marker#')) {
                        // Masks all legacy POI
                        entity.show = false
                    }
                } else {
                    entity.show = track.visible
                }

            })
            const text = `Track loaded and displayed on the map.`
            if (action === RE_LOADING) {
                UINotifier.notifySuccess({
                    caption: `<strong>${track.title}</strong> updated !`, text: text,
                })
            } else {
                try {
                    vt3d.viewer.dataSources.add(dataSource).then(function (dataSource) {


                        // Ok => we notify
                        let caption = ''
                        switch (action) {
                            case
                            SIMULATE_ALTITUDE : {
                                caption = `<strong>${track.title}</strong> updated !`
                                break
                            }
                            default: {
                                caption = `<strong>${track.title}</strong> Loaded!`
                            }
                        }
                        UINotifier.notifySuccess({
                            caption: caption, text: text,
                        })

                    })
                } catch (error) {
                    console.error(error)
                    // Error => we notify
                    UINotifier.notifyError({
                        caption: `An error occurs during loading <strong>${name}<strong>!`, text: error,
                    })
                }

                // Focus on track
                if (mode === FOCUS_ON_FEATURE) {
                    TrackUtils.focus(track)
                }


            }
        }).catch(error => {
            // Error => we notify
            UINotifier.notifyError({
                caption: `An error occurs during loading <strong>${name}<strong>!`, text: error,
            })
            return false
        })

    }


    /**
     * Focus on a track
     *
     *
     * @param {boolean }track Track instance
     */
    static focus = (track, showBbox = false) => {
        const cameraOffset = new Cesium.HeadingPitchRange(Cesium.Math.toRadians(vt3d.configuration.center.camera.heading), Cesium.Math.toRadians(vt3d.configuration.center.camera.pitch), vt3d.configuration.center.camera.range)

        // Let's focus on the right datasource
        const dataSource = vt3d.viewer.dataSources.getByName(track.slug)[0]

        // We calculateth Bounding Box and enlarge it by 30%
        const bbox = TrackUtils.extendBbox(extent(track.content), 30)
        // Then we map it to the camera view
        let rectangle = Cesium.Rectangle.fromDegrees(bbox[0], bbox[1], bbox[2], bbox[3])
        const rectCarto = Cesium.Cartographic.fromCartesian(vt3d.camera.getRectangleCameraCoordinates(rectangle))
        const destination = Cesium.Cartographic.toCartesian(rectCarto)

        vt3d.camera.flyTo({
            destination: destination, duration: 1, orientation: {
                heading: 0.0, pitch: -Cesium.Math.PI_OVER_TWO,
            },
        })

        //Show BBox if requested
        if (showBbox) {
            vt3d.viewer.entities.add({
                name: 'B Box',
                rectangle: {
                    coordinates: rectangle,
                    material: Cesium.Color.WHITE.withAlpha(0.05),
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
     * Prepare  geojson data to be managed by vt3d
     *
     * > longitude, latitude, altitude,time
     *
     * If altitude is missing, we try to get it from Terrain.
     *
     * @param geoJson
     * @return {[[{longitude, latitude, altitude,time}]]}
     *
     */
    static prepareDataForMetrics = async geoJson => {
        const dataExtract = [] = []
        if (geoJson.type === FEATURE_COLLECTION) {
            for (const feature of geoJson.features) {
                if (feature.type === 'Feature' && feature.geometry.type === FEATURE_LINE_STRING) {

                    const properties = TrackUtils.checkIfDataContainsAltitudeOrTime(feature)
                    let index = 0
                    const newLine = []

                    for (const coordinates of feature.geometry.coordinates) {
                        let point = {
                            longitude: coordinates[0], latitude: coordinates[1], altitude: coordinates[2],
                        }
                        if (properties.hasTime) {
                            point.time = feature.properties?.coordinateProperties?.times[index]
                        }
                        newLine.push(point)
                        index++
                    }
                    dataExtract.push(newLine)
                }
            }
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
        const temp = await Cesium.sampleTerrainMostDetailed(vt3d.viewer.terrainProvider, positions)
        temp.forEach(coordinate => {
            altitude.push(coordinate.altitude)
        })

        return altitude

    }

    /**
     * Retrieve the entities
     *
     * @param name  {string|null}   name of the datasource
     */
    static getEntitiesByDataSourceName = (name) => {
        // if we do not have datasource name, we'll find in all datasource
        let dataSource
        for (let i = 0; i < vt3d.viewer.dataSources.length; i++) {
            const item = vt3d.viewer.dataSources.get(i)
            if (item.name === name) {
                return item.entities
            }
        }
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
        for (let i = 0; i < vt3d.viewer.dataSources.length; i++) {
            const item = vt3d.viewer.dataSources.get(i)
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

    static cleanTrack = (track) => {
        // Search  data source associated tothe track
        // const dataSource = vt3d.viewer.dataSources.getByName(track.slug)[0]
        // // Now get the entities
        // dataSource.entities.values.forEach(entity => {
        //     entity.show = track.visible
        // })
    }

    static getTrackChildById = (track, id) => {
        return EntitiesUtils.getEntityById(`${track.slug}#${id}`)
    }

    static getDescription(feature) {
        return feature?.properties?.desc ?? undefined
    }

    /**
     * Read tracks from DB and draw them.
     *
     */
    static readAllFromDB = async () => {
        // Let's read tracks in DB
        const journeys = await Journey.readAllFromDB()
        if (journeys.length === 0) {
            vt3d.theJourney = null
            return
        }
        // Current track slug
        let current = await vt3d.db.journeys.get(CURRENT_JOURNEY, CURRENT_STORE)
        // Set current if it exists in tracks. If not, let's use the first track or null
        const tmp = journeys.filter(value => value.slug === current)
        current = (tmp.length > 0) ? tmp[0].slug : journeys[0].slug

        if (current) {
            vt3d.theJourney = vt3d.journeys.get(current)
            vt3d.addToEditor(vt3d.theJourney)
        }
        // Draw all tracks but show only the current one
        await vt3d.journeys.forEach(async journey => {
            await journey.draw(INITIAL_LOADING, journey.slug === current ? FOCUS_ON_FEATURE : NO_FOCUS)
        })

    }

}
