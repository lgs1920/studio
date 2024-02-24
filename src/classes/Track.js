import {gpx, kml} from '@tmcw/togeojson'

import {DateTime}                                    from 'luxon'
import {AppUtils}                                    from '../Utils/AppUtils'
import {Mobility}                                    from '../Utils/Mobility'
import {FEATURE_COLLECTION, LINE_STRING, TrackUtils} from '../Utils/TrackUtils'

export const NO_DEM_SERVER = 'none'
export const SIMULATE_HEIGHT = 'simulate-height'
export const INITIAL_LOADING = 'first-load'

const CONFIGURATION = '../config.json'

export class Track {

    name
    type   // gpx,kml,geojson  //TODO kmz
    slug
    geoJson
    DEMServer
    title
    metrics
    hasHeight
    visible

    constructor(name, type, content) {
        this.name = name
        this.title = name
        this.type = type
        this.slug = AppUtils.slugify(`${name}-${type}`)
        this.color = vt3d.configuration.track.color
        this.thickness = vt3d.configuration.track.thickness
        this.visible = true

        this.DEMServer = NO_DEM_SERVER
        // get GeoJson
        this.toGeoJson(content)

        this.checkDataConsistency()
        // Let's compute all information
        this.computeAll()

    }

    /**
     * Prepare it an extract all metrics
     *
     * @param content
     */
    computeAll = async () => {
        // Maybe we have some changes to operate
        return await this.prepareGeoJson().then(async () => {
            await this.calculateMetrics()
            this.addToContext()
        })
    }

    /**
     * Get the currentTrack data and set the GeoJson Structure
     *
     * @param content content of the currentTrack file
     *
     * @exception {any} in case of ay error, we return undefined
     */
    toGeoJson = (content) => {
        /**
         * We translate kml and gpx to GeoJson format in order to manipulate json
         * instead of XML
         */
        try {
            let geoJson
            switch (this.type) {
                case 'gpx':
                    this.geoJson = gpx(new DOMParser().parseFromString(content, 'text/xml'))
                    break
                case 'kmz' :
                    // TODO unzip to get kml. but what to do with the assets files that are sometimes embedded
                    break
                case 'kml':
                    this.geoJson = kml(new DOMParser().parseFromString(content, 'text/xml'))
                    break
                case 'geojson' :
                    this.geoJson = JSON.parse(content)
            }

        } catch (error) {
            console.error(error)
            // Error => we notify
            UINotifier.notifyError({
                caption: `An error occurs during loading <strong>${trackFile.name}<strong>!`, text: error,
            })
            this.geoJson = undefined
        }
    }

    /**
     * Compute all metrics from a currentTrack
     *
     * set metrics as  {[metrics/all points,global]}
     */
    calculateMetrics = async () => {
        return await TrackUtils.prepareDataForMetrics(this.geoJson).then(dataForMetrics => {
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
            this.metrics = metrics
        })
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
    prepareGeoJson = async () => {

        if (this.geoJson.type === FEATURE_COLLECTION) {
            let index = 0
            for (const feature of this.geoJson.features) {
                if (feature.type === 'Feature' && feature.geometry.type === LINE_STRING) {
                    let index = 0
                    if (!this.hasHeight && this.DEMServer !== NO_DEM_SERVER) {
                        // Some heights info are missing. Let's simulate them

                        // TODO add different plugins for DEM elevation like:
                        //        https://tessadem.com/elevation-api/  ($)
                        //     or https://github.com/Jorl17/open-elevation/blob/master/docs/api.md

                        let heights = []
                        switch (this.DEMServer) {
                            case NO_DEM_SERVER:
                            case 'internal' :
                                heights = await TrackUtils.getElevationFromTerrain(feature.geometry.coordinates)
                                break
                            case 'open-elevation' : {
                            }
                        }
                        // Add them to data
                        for (let j = 0; j < heights.length; j++) {
                            feature.geometry.coordinates[j][2] = heights[j]
                        }
                    }

                    // TODO interpolate points to avoid GPS errors (Kalman Filter ?)
                    // TODO Clean

                    this.geoJson.features[index] = feature
                }
                index++
            }
        }
    }

    /**
     * Add this currentTrack to the application context
     *
     */
    addToContext = (setToCurrent = true) => {
        vt3d.addTrack(this)
        if (setToCurrent) {
            vt3d.currentTrack = this
        }
    }

    /**
     * Show the Track on the globe
     *
     * @return {Promise<void>}
     */
    show = async (action = INITIAL_LOADING) => {
        await TrackUtils.showTrack(this.geoJson, this.name, {
            color: this.color, thickness: this.thickness,
        }, action)
    }

    showAfterHeightSimulation = async () => {
        await this.show(SIMULATE_HEIGHT)
    }

    checkDataConsistency = () => {
        this.hasHeight = true
        if (this.geoJson.type === FEATURE_COLLECTION) {
            let index = 0
            for (const feature of this.geoJson.features) {
                if (feature.type === 'Feature' && feature.geometry.type === LINE_STRING) {
                    const {hasTime, hasHeight} = TrackUtils.checkIfDataContainsHeightOrTime(feature)
                    if (!hasHeight) {
                        this.hasHeight = false
                        break
                    }
                }
            }
        }
    }

}