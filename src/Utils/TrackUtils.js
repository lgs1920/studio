import * as Cesium                        from 'cesium'
import {Color, GeoJsonDataSource}         from 'cesium'
import {INITIAL_LOADING, SIMULATE_HEIGHT} from '../classes/Track'
import {FileUtils}                        from './FileUtils.js'
import {UINotifier}                       from './UINotifier'

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
            if (coordinate.length == 2) {
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
     * @return {Promise<FileStringResult>}
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
     * @param geoJson
     * @param name
     * @param line : track color and width {line,width}
     * @param action   load | simulateHeight
     * @return {Promise<void>}
     *
     */
    static showTrack = async (geoJson, name = '', line = null, action = 'load') => {
        let dataSource
        const configuration = vt3d.configuration
        if (line === null) {
            line = {
                color: vt3d.configuration.track.color, thickness: vt3d.configuration.track.thickness,
            }
        }
        const trackStroke = {
            color: Color.fromCssColorString(line.color), thickness: line.thickness,
        }
        const routeStroke = {
            color: Color.fromCssColorString(configuration.route.color), thickness: configuration.route.thickness,
        }
        const commonOptions = {
            clampToGround: true, name: name, markerSymbol: '<i>?</i>',
        }

        try {
            // Load Geo Json
            const source = new GeoJsonDataSource(name)
            dataSource = await source.load(geoJson, {
                ...commonOptions, stroke: trackStroke.color, strokeWidth: trackStroke.width,
            })

            vt3d.viewer.dataSources.add(dataSource)
                .then(function (dataSource) {
                    // Ok => we notify
                    let caption = '', text = ''
                    switch (action) {
                        case INITIAL_LOADING: {
                            caption = `<strong>${name}</strong> Loaded!`
                            text = `Track loaded and displayed on the map.`
                            break
                        }
                        case SIMULATE_HEIGHT : {
                            caption = `<strong>${name}</strong> changed!`
                            text = `Track loaded and displayed on the map.`
                            break
                        }
                    }
                    UINotifier.notifySuccess({
                        caption: caption, text: text,
                    })
                    vt3d.viewer.zoomTo(dataSource.entities)
                })
                .catch(error => {
                    // Error => we notify
                    UINotifier.notifyError({
                        caption: `An error occurs during loading <strong>${name}<strong>!`, text: error,
                    })
                })
        } catch (error) {
            console.error(error)
            // Error => we notify
            UINotifier.notifyError({
                caption: `An error occurs during loading <strong>${name}<strong>!`, text: error,
            })
        }
    }

    /**
     * Filters an array of objects using custom predicates.
     *
     * from https://gist.github.com/jherax/f11d669ba286f21b7a2dcff69621eb72
     *
     * @param  {Array}  array: the array to filter
     * @param  {Object} filters: an object with the filter criteria
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
     * Prepare  geojson data to be manage by vt3d
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
                    const temp = []

                    for (const coordinates of feature.geometry.coordinates) {
                        let point = {
                            longitude: coordinates[0], latitude: coordinates[1], height: coordinates[2],
                        }
                        if (properties.hasTime) {
                            point.time = feature.properties?.coordinateProperties?.times[index]
                        }
                        temp.push(point)
                        index++
                    }
                    dataExtract.push(temp)
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
    static  getElevationFromTerrain = async (coordinates) => {
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

}
