import * as extent                                                      from '@mapbox/geojson-extent'
import * as Cesium                                                      from 'cesium'
import { Color, GeoJsonDataSource }                                     from 'cesium'
import { DRAW_ANIMATE, INITIAL_LOADING, RE_LOADING, SIMULATE_ALTITUDE } from '../../classes/Journey'
import { FileUtils }                                                    from '../FileUtils.js'
import { UINotifier }                                                   from '../UINotifier'
import { EntitiesUtils }                                                from './EntitiesUtils'

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
     * Load a theJourney file
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
    static loadTrack = async (track, action = INITIAL_LOADING, mode = DRAW_ANIMATE) => {
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
                if (mode === DRAW_ANIMATE) {
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
     * Focus on track
     *
     *
     * @param track Track instance
     */
    static focus = (track) => {
        const cameraOffset = new Cesium.HeadingPitchRange(Cesium.Math.toRadians(vt3d.configuration.center.camera.heading), Cesium.Math.toRadians(vt3d.configuration.center.camera.pitch), vt3d.configuration.center.camera.range)

        const dataSource = vt3d.viewer.dataSources.getByName(track.slug)[0]
        // ext we get the bounding box and focus on it.
        const bbox = extent.default(track.geoJson)
        let rectangle = Cesium.Rectangle.fromDegrees(bbox[0], bbox[1], bbox[2], bbox[3])

        const rectCarto = Cesium.Cartographic.fromCartesian(vt3d.camera.getRectangleCameraCoordinates(rectangle))
        // zoom out 30% from whatever height camera at
        rectCarto.height = rectCarto.height + (rectCarto.height * 0.3)
        const destination = Cesium.Cartographic.toCartesian(rectCarto)

        vt3d.camera.flyTo({
            destination: destination, duration: 2, orientation: {
                heading: 0.0, pitch: -Cesium.Math.PI_OVER_TWO,
            },
        })

        // vt3d.viewer.entities.add({
        //     name: 'B Box',
        //     rectangle: {
        //         coordinates: rectangle,
        //         material: Cesium.Color.GRAY.withAlpha(0.1),
        //     },
        // })
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
        // // Let's read tracks in DB
        // const tracks = await Track.allFromDB()
        // if (tracks.length === 0) {
        //     vt3d.theJourney = null
        //     return
        // }
        // // Current track slug
        // let current = await vt3d.db.tracks.get(CURRENT_JOURNEY, CURRENT_STORE)
        // // Set current if it exists in tracks. If not, let's use the first track or null
        // const tmp = tracks.filter(value => value.slug === current)
        // current = (tmp.length > 0) ? tmp[0].slug : tracks[0].slug
        //
        // if (current) {
        //     vt3d.theJourney = vt3d.tracks.get(current)
        //     vt3d.addToEditor(vt3d.theJourney)
        // }
        // // Draw all tracks but show only the current one
        // vt3d.tracks.forEach(track => {
        //     track.draw(INITIAL_LOADING, track.slug === current ? DRAW_ANIMATE : DRAW_SILENT)
        // })

    }

}
