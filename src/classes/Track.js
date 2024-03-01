import { faFlagCheckered } from '@fortawesome/pro-regular-svg-icons'
import { gpx, kml }        from '@tmcw/togeojson'

import { DateTime }                                    from 'luxon'
import { AppUtils }                                    from '../Utils/AppUtils'
import { MARKER_COLOR, MARKER_ICON }                   from '../Utils/cesium/MarkerUtils'
import { FEATURE_COLLECTION, LINE_STRING, TrackUtils } from '../Utils/cesium/TrackUtils'
import { Mobility }                                    from '../Utils/Mobility'
import { MapMarker }                                   from './MapMarker'

export const NO_DEM_SERVER = 'none'
export const SIMULATE_HEIGHT = 'simulate-height'
export const INITIAL_LOADING = 'first-load'

const CONFIGURATION = '../config.json'

export class Track {

    slug        // unic Id for the track
    title       // Track title
    type        // gpx,kml,geojson  //TODO kmz
    geoJson     // All the data are translated into GeoJson
    metrics     // All the metrics associated to the track
    visible     // Is visible ?

    hasHeight   // Is fail contains altitudes ?
    DEMServer   // DEM server associate if we need altitude

    color       // The color associated
    thickness   // The thickness associated
    entitiesId  // The entities Id
    markers = new Map()// external markers

    attributes = [
        'color',
        'entitiesId',
        'title',
        'geoJson',
        'title',
        'visible',
        'hasHeight',
        'DEMServer',
        'thickness',
        'markers',
    ]

    constructor(title, type, options = {}) {
        this.title = title
        this.type = type

        this.slug = options.slug ?? AppUtils.slugify(`${title}-${type}`)
        this.color = vt3d.configuration.track.color
        this.thickness = vt3d.configuration.track.thickness
        this.visible = true

        this.DEMServer = NO_DEM_SERVER
        // get GeoJson
        this.toGeoJson(options.content ?? '')
        this.setTrackName(this.title)

        this.checkDataConsistency()
        // Let's compute all information
        this.computeAll().then(
            this.addTipsMarkers(),
        )

    }

    /**
     * create an unic title
     *
     * if "my title" already exists as track title,
     * let's change it to "my title (1) or ...(2) until ...(n)
     * if new title already exists.
     *
     * @param title
     * @return {string}
     */
    static
    unicTitle = title => {
        let counter = 0
        let unic = title

        // Vérifie si la valeur existe déjà dans le tableau
        let valueExists = vt3d.tracks.some(obj => obj.title === unic)

        while (valueExists) {
            counter++
            unic = `${title} (${counter})`
            valueExists = vt3d.tracks.some(obj => obj.title === unic)
        }
        return unic

    }

    /**
     * Clone current track
     *
     * @param options {slug}
     * @return {Track} the new track
     */
    static
    clone = (source, exceptions = {}) => {
        const track = new Track(source.title, source.type, exceptions)

        source.attributes.forEach(attribute => {
            if (exceptions[attribute]) {
                track[attribute] = exceptions[attribute]
            } else {
                track[attribute] = source[attribute]
            }
        })

        return track
    }

    addTipsMarkers(coordinates) {

        if (this.geoJson.type === FEATURE_COLLECTION) {
            let index = 0
            for (const feature of this.geoJson.features) {
                if (feature.type === 'Feature' && feature.geometry.type === LINE_STRING) {
                    // Add start an Stop Markers
                    const start = feature.geometry.coordinates[0]
                    this.markers.set('start', new MapMarker({
                            name: 'start',
                            coordinates: [start[0], start[1]],
                            type: MARKER_COLOR,
                            backgroundColor: '#ff0000',
                            description: 'Start point',
                        },
                    ))
                    const stop = feature.geometry.coordinates[feature.geometry.coordinates.length - 1]
                    this.markers.set('stop', new MapMarker({
                            name: 'stop',
                            coordinates: [stop[0], stop[1]],
                            type: MARKER_ICON,
                            icon: faFlagCheckered,
                            backgroundColor: '#00ff00',
                            description: 'End point',
                        },
                    ))
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
        vt3d.saveTrack(this)
        if (setToCurrent) {
            vt3d.currentTrack = this
        }
    }

    /**
     * Set Geo Json feature name
     *
     * @param name
     */
    setTrackName(name) {
        if (this.geoJson.type === FEATURE_COLLECTION) {
            let index = 0
            for (const feature of this.geoJson.features) {
                if (feature.type === 'Feature' && feature.geometry.type === LINE_STRING) {
                    this.geoJson.features[index].properties['name'] = name
                }
                index++
            }
        }
    }

    /**
     * Prepare it an extract all metrics
     *
     * @param content
     */
    computeAll = async () => {
        // Maybe we have some changes to operate
        await this.prepareGeoJson()
        await this.calculateMetrics()
        this.addToContext()
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
                caption: `An error occurs during loading <strong>${trackFile.title}<strong>!`, text: error,
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

        /**
         * Only for Feature Collections
         */
        if (this.geoJson.type === FEATURE_COLLECTION) {
            let index = 0
            for (const feature of this.geoJson.features) {
                if (feature.type === 'Feature' && feature.geometry.type === LINE_STRING) {
                    let index = 0
                    /**
                     * Have height or simulate ?
                     */
                    if (!this.hasHeight) {
                        // Some heights info are missing. Let's simulate them

                        // TODO add different plugins for DEM elevation like:
                        //        https://tessadem.com/elevation-api/  ($)
                        //     or https://github.com/Jorl17/open-elevation/blob/master/docs/api.md


                        if (this.DEMServer === NO_DEM_SERVER) {
                            // May be, some computations have been done before, so we cleaned them
                            // use case : any DEM server -> no DEM server
                            let j = 0
                            feature.geometry.coordinates.forEach(coordinate => {
                                if (coordinate.length === 3) {
                                    feature.geometry.coordinates[j] = coordinate.splice(2, 1)
                                }
                                j++
                            })
                        } else {
                            // We have aDEM Server, so let's compute height
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
                                feature.geometry.coordinates[j].push(heights[j])
                            }
                            // Hide progress bar
                            vt3d.editorProxy.longTask = false
                        }

                        /**
                         * Use title as feature name
                         */
                        feature.properties.name = this.title


                        // TODO interpolate points to avoid GPS errors (Kalman Filter ?)
                        // TODO Clean


                        // Add Current GeoJson
                        this.geoJson.features[index] = feature


                    }


                    index++
                }


            }
        }
    }

    /**
     * Load the Track on the globe
     *
     * @return {Promise<void>}
     */
    load = async (action = INITIAL_LOADING) => {
        this.entitiesId = TrackUtils.loadTrack(this.geoJson, this.slug, {
            color: this.color, thickness: this.thickness,
        }, action).then(() => {
            this.markers.forEach(marker => {
                marker.draw()
            })
        })

    }

    showAfterHeightSimulation = async () => {
        await this.load(SIMULATE_HEIGHT)
    }

    showAfterNewSettings = async () => {
        await this.load()
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

    getInternalId = () => {
        return TrackUtils.getEntities(this.slug, this.entitiesId)
    }


}