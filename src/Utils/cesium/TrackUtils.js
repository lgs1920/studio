import * as Cesium                                      from 'cesium'
import { Color, GeoJsonDataSource }                     from 'cesium'
import { INITIAL_LOADING, RE_LOADING, SIMULATE_HEIGHT } from '../../classes/Track'
import { FileUtils }                                    from '../FileUtils.js'
import { UINotifier }                                   from '../UINotifier'
import { EntitiesUtils }                                from './EntitiesUtils'

export const ACCEPTED_TRACK_FILES = ['.geojson', '.kml', '.gpx' /* TODO '.kmz'*/]
export const FEATURE = 'Feature', FEATURE_COLLECTION = 'FeatureCollection', LINE_STRING = 'LineString'

export class TrackUtils {

    static MIMES = {
        gpx: ['application/gpx+xml', 'vnd.gpxsee.map+xml', 'application/octet-stream'],
        geojson: ['application/geo+json', 'application/json'],
        kml: ['vnd.google-earth.kml+xml'], // kmz: ['vnd.google-earth.kmz'], //TODO KMZ files
    }
    static checkIfDataContainsHeightOrTime = (feature => {
        let hasHeight = true
        for (const coordinate of feature.geometry.coordinates) {
            if (coordinate.length === 2) {
                hasHeight = false
                break
            }
        }
        return {
            hasHeight: hasHeight, hasTime: feature.properties?.coordinateProperties?.times !== undefined,
        }
    })

    /**
     * Load a currentTrack file
     *
     * return
     *
     * @return {Promise}
     *
     */
    static async loadTrackFromFile() {
        return FileUtils.uploadFileFromFrontEnd({
            accepted: ACCEPTED_TRACK_FILES, mimes: TrackUtils.MIMES,
        })
    }

    /**
     * Show currentTrack on the map
     *
     * @param track
     * @param line
     * @param action
     */
    static loadTrack = async (track = '', action = INITIAL_LOADING) => {
        const configuration = vt3d.configuration

        const trackStroke = {
            color: Color.fromCssColorString(track.color), thickness: track.thickness,
        }
        const routeStroke = {
            color: Color.fromCssColorString(configuration.route.color), thickness: configuration.route.thickness,
        }
        const commonOptions = {
            clampToGround: true,
            name: track.title,
            markerSymbol: '?',
        }

        // Load Geo Json
        let source = null
        if (action === RE_LOADING) {
            // We get existing datasource
            source = vt3d.viewer.dataSources.getByName(track.slug)[0]
        } else {
            // It's a new track
            source = new GeoJsonDataSource(track.slug)
        }

        return source.load(track.geoJson, {
            ...commonOptions,
            stroke: trackStroke.color,
            strokeWidth: trackStroke.thickness,
        }).then(dataSource => {

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
                            SIMULATE_HEIGHT : {
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
                        const cameraOffset = new Cesium.HeadingPitchRange(Cesium.Math.toRadians(vt3d.configuration.center.camera.heading), Cesium.Math.toRadians(vt3d.configuration.center.camera.pitch), vt3d.configuration.center.camera.range)
                        vt3d.viewer.zoomTo(dataSource.entities, cameraOffset)
                    })
                } catch (error) {
                    console.error(error)
                    // Error => we notify
                    UINotifier.notifyError({
                        caption: `An error occurs during loading <strong>${name}<strong>!`, text: error,
                    })
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
     * > longitude, latitude, height,time
     *
     * If height is missing, we try to get it from Terrain.
     *
     * @param geoJson
     * @return {[[{longitude, latitude, height,time}]]}
     *
     */
    static prepareDataForMetrics = async geoJson => {
        const dataExtract = [] = []
        if (geoJson.type === FEATURE_COLLECTION) {
            for (const feature of geoJson.features) {
                if (feature.type === 'Feature' && feature.geometry.type === LINE_STRING) {

                    const properties = TrackUtils.checkIfDataContainsHeightOrTime(feature)
                    let index = 0
                    const newLine = []

                    for (const coordinates of feature.geometry.coordinates) {
                        let point = {
                            longitude: coordinates[0], latitude: coordinates[1], height: coordinates[2],
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
     * @return {height}
     */
    static getElevationFromTerrain = async (coordinates) => {
        const positions = []
        coordinates.forEach(coordinate => {
            positions.push(Cesium.Cartographic.fromDegrees(coordinate[0], coordinate[1]))
        })

        //TODO apply only if height is missing for some coordinates
        const height = []
        const temp = await Cesium.sampleTerrainMostDetailed(vt3d.viewer.terrainProvider, positions)
        temp.forEach(coordinate => {
            height.push(coordinate.height)
        })

        return height

    }

    /**
     * Retrieve the entities
     *
     * @param name  {string|null}   name of the datasource
     */
    static getEntities = (name) => {
        // if we do not have datasource name, we'll find in all datasource
        let dataSource
        for (let i = 0; i < vt3d.viewer.dataSources.length; i++) {
            const item = vt3d.viewer.dataSources.get(i)
            if (item.name === name) {
                return item.entities
            }
        }
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
}
