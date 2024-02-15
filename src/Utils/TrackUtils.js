import {gpx, kml}                 from '@tmcw/togeojson'
import * as Cesium                from 'cesium'
import {Color, GeoJsonDataSource} from 'cesium'
import {DateTime}                 from 'luxon'
import {FileUtils}                from './FileUtils.js'
import {Mobility}                 from './Mobility'
import {UINotifier}               from './UINotifier'

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
     * Load a track file
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
     * Show track on the map
     *
     * @param geoJson
     * @return {Promise<void>}
     *
     */
    static showTrack = async (geoJson, name = '') => {
        let dataSource
        const configuration = window.vt3d.configuration
        const trackStroke = {
            color: Color.fromCssColorString(configuration.track.color), width: configuration.track.width,
        }
        const routeStroke = {
            color: Color.fromCssColorString(configuration.route.color), width: configuration.route.width,
        }
        const commonOptions = {
            clampToGround: true, name: name, markerSymbol: '<i>?</i>',
        }
        /**
         * Load DataSource and add it
         *
         * Available formats are : gpx,kml,kmz,geojson
         *
         * For convenient reasons, we translate kml and gpx to GeoJson formt
         *
         */

        try {

            dataSource = await GeoJsonDataSource.load(geoJson, {
                ...commonOptions, stroke: trackStroke.color, strokeWidth: trackStroke.width,
            })

            // It's time to get metrics from
            const metrics = await TrackUtils.getMetrics(geoJson)

            /**
             * Then add and display data source
             */

            //dataSource.name = `${track.name}.${track.extension}`
            window.vt3d.viewer.dataSources.add(dataSource)
                .then(function (dataSource) {
                    // Ok => we notify
                    UINotifier.notifySuccess({
                        caption: 'Loaded!',
                        text: `The track <strong>${name}</strong> has been loaded and displayed on the map.`,
                    })
                    window.vt3d.viewer.zoomTo(dataSource.entities)
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
     * Get the data and return a GeoJson
     *
     * @param trackFile
     *
     * @return {Array} geoJson
     */
    static trackToGeoJson = async (trackFile) => {
        /**
         * Available formats are : gpx,kml,kmz,geojson
         * For convenient reasons, we translate kml and gpx to GeoJson format
         */
        try {
            let geoJson
            switch (trackFile.extension) {
                case 'gpx':
                    return gpx(new DOMParser().parseFromString(trackFile.content, 'text/xml'))
                case 'kmz' :
                // TODO unzip to get kml. but what to do with the assets files that are sometimes embedded
                case 'kml':
                    return kml(new DOMParser().parseFromString(trackFile.content, 'text/xml'))
                case 'geojson' :
                    geoJson = JSON.parse(trackFile.content)
                    return geoJson
            }

        } catch (error) {
            console.error(error)
            // Error => we notify
            UINotifier.notifyError({
                caption: `An error occurs during loading <strong>${trackFile.name}<strong>!`, text: error,
            })
            return undefined
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
     * Prepare GeoJson
     *
     * Simulate height, interpolate, clean data
     *
     * @param geoJson
     * @return geoJson
     *
     */
    static prepareGeoJson = async geoJson => {

        if (geoJson.type === FEATURE_COLLECTION) {
            let index = 0
            for (const feature of geoJson.features) {
                if (feature.type === 'Feature' && feature.geometry.type === LINE_STRING) {

                    const properties = TrackUtils.checkIfDataContainsHeightOrTime(feature)
                    let index = 0
                    const temp = []

                    // Some heights info are missing. Let's simulate them

                    // TODO add different plugins for DEM elevation like:
                    //        https://tessadem.com/elevation-api/  ($)
                    //     or https://github.com/Jorl17/open-elevation/blob/master/docs/api.md

                    if (!properties.hasHeight) {
                        const fixed = await TrackUtils.getElevationFromTerrain(feature.geometry.coordinates)
                        for (let j = 0; j < fixed.length; j++) {
                            feature.geometry.coordinates[j][2] = fixed[j]
                        }
                    }
                    // TODO interpolate points to avoid GPS errors (Kalman Filter ?)
                    // TODO Clean

                    geoJson.features[index] = feature
                }
                index++
            }
        }
        return geoJson
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

        const height = []
        const temp = await Cesium.sampleTerrainMostDetailed(window.vt3d.viewer.terrainProvider, positions)
        temp.forEach(coordinate => {
            height.push(coordinate.height)
        })

        return height

    }

    /**
     * Compute all metrics from a track
     *
     * @param geoJson GeoJSON track
     * @return {[metrics,global]}
     */
    static getMetrics = async (geoJson = []) => {
        // We'll work on some of them
        return await TrackUtils.prepareDataForMetrics(geoJson).then(dataForMetrics => {
            let metrics = []
            let index = 1

            /**
             * GeoJson is a Feature Collection, so we iterate on each.
             */
            dataForMetrics.forEach((dataSet) => {

                let featureMetrics = []
                /**
                 * 1st step : Metrics per points
                 * we iterate on all points to compute
                 *  - distance, elevation, slope
                 * If we have time information, we can also compute
                 *  - duration, speed, pace
                 */
                for (const current of dataSet) {
                    const prev = dataSet[index]
                    const data = {}
                    if (index < dataSet.length) {
                        data.distance = Mobility.distance(prev, current)
                        if (current.time && prev.time) {
                            data.duration = Mobility.duration(DateTime.fromISO(prev.time), DateTime.fromISO(current.time))
                            data.speed = Mobility.speed(data.distance, data.duration)
                            data.pace = Mobility.pace(data.distance, data.duration)

                            //TODO Add idle time duration
                        }
                        data.elevation = Mobility.elevation(prev, current)
                        data.slope = data.elevation / data.distance * 100
                    }
                    index++
                    featureMetrics.push(data)
                }
                featureMetrics = featureMetrics.slice(0, -1)

                /**
                 * Step 2: Globals
                 *
                 * Now we can compute globals, ie some min max, average + total information(distance, time, D+/D- )
                 */
                let global = {}, tmp = []

                // Min Height
                global.minHeight = Math.min(...dataSet.map(a => a?.height))

                // Max Height
                global.maxHeight = Math.max(...dataSet.map(a => a?.height))

                // If the first have duration time, all the data set have time
                if (featureMetrics[0].duration) {
                    // Max speed
                    tmp = TrackUtils.filterArray(featureMetrics, {
                        speed: speed => speed !== 0 && speed !== undefined,
                    })
                    global.maxSpeed = Math.max(...tmp.map(a => a?.speed))

                    // Average speed (we exclude 0 and undefined values)
                    global.averageSpeed = tmp.reduce((s, o) => {
                        return s + o.speed
                    }, 0) / tmp.length

                    // Todo  Add average speed in motion

                    // Max Pace
                    global.maxPace = Math.max(...featureMetrics.map(a => a?.pace))

                    // Todo  Add average pace in motion
                }

                // Max Slope
                global.maxSlope = Math.max(...featureMetrics.map(a => a?.slope))

                // Positive elevation
                global.positiveElevation = featureMetrics.reduce((s, o) => {
                    if (o.elevation > 0) {
                        return s + o.elevation
                    }
                    return s
                }, 0)

                // Negative elevation
                global.negativeElevation = featureMetrics.reduce((s, o) => {
                    if (o.elevation < 0) {
                        return s + o.elevation
                    }
                    return s
                }, 0)

                // Total duration
                global.duration = featureMetrics.reduce((s, o) => {
                    return s + o.duration
                }, 0)

                // Total Distance
                global.distance = featureMetrics.reduce((s, o) => {
                    return s + o.distance
                }, 0)

                metrics.push({points: featureMetrics, global: global})
            })
            return metrics
        })
    }


}
