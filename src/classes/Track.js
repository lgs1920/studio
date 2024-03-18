import { faLocationDot } from '@fortawesome/pro-solid-svg-icons'
import { gpx, kml }      from '@tmcw/togeojson'

import { DateTime }                                                           from 'luxon'
import { JUST_ICON, MARKER_SIZE }                                             from '../Utils/cesium/MarkerUtils'
import { FEATURE_COLLECTION, FEATURE_LINE_STRING, FEATURE_POINT, TrackUtils } from '../Utils/cesium/TrackUtils'
import { Mobility }                                                           from '../Utils/Mobility'
import { MapMarker }                                                          from './MapMarker'

export const NO_DEM_SERVER = 'none'
export const SIMULATE_ALTITUDE = 'simulate-altitude'
export const INITIAL_LOADING = 1
export const RE_LOADING = 2

const CONFIGURATION = '../config.json'

export class Track {

    slug        // unic Id for the track
    title       // Track title
    type        // gpx,kml,geojson  //TODO kmz
    geoJson     // All the data are translated into GeoJson
    metrics     // All the metrics associated to the track
    visible     // Is visible ?
    description // Add any description


    hasAltitude   // Is track contains altitudes ?
    hasTime       // Is track contains Time information ?

    DEMServer   // DEM server associate if we need altitude

    color = vt3d.configuration.track.color            // The color associated
    thickness = vt3d.configuration.track.thickness    // The thickness associated

    markers = new Map()// external markers

    attributes = [
        'color',
        'title',
        'geoJson',
        'title',
        'visible',
        'hasTime',
        'DEMServer',
        'thickness',
        'markers',
        'description',
        'hasAltitude',
    ]

    constructor(title, type, options = {}) {
        this.title = title
        this.type = type

        this.slug = options.slug ?? _utils.app.slugify(`${title}-${type}`)
        this.color = vt3d.configuration.track.color
        this.thickness = vt3d.configuration.track.thickness
        this.visible = true
        this.description = options.description ?? undefined

        this.DEMServer = NO_DEM_SERVER
        // get GeoJson
        this.toGeoJson(options.content ?? '')
        this.setTrackName(this.title)

        this.checkOtherData()
        // Let's compute all information
        this.computeAll().then(
            this.addMarkers(),
        )

    }

    /**
     * create a unic title
     *
     * if title = "my title" already exists as track title,
     * let's change it to "my title (1)" or "...(2)" until the new title
     * does not exist.
     *
     * @param title
     * @return {string}
     */
    static defineUnicTitle = title => {
        let counter = 0
        let unic = title

        // Vérifie si la valeur existe déjà dans le tableau
        let valueExists = vt3d.tracks.values().some(obj => obj.title === unic)

        while (valueExists) {
            counter++
            unic = `${title} (${counter})`
            valueExists = vt3d.tracks.values().some(obj => obj.title === unic)
        }
        return unic

    }


    /**
     * Clone current track
     *
     * @param options {slug}
     * @return {Track} the new track
     */
    static clone = (source, exceptions = {}) => {
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

    static getMarkerInformation = (markerId) => {
        const elements = markerId.split('#')
        if (elements.length === 3 && elements[0] === 'marker') {
            return {
                track: elements[1],
                marker: elements[2],
            }
        }
        return false

    }

    /**
     * Define the slug of a marker
     *
     * @param id {string|number}
     * @return {`marker#${string}#${string}`}
     */
    setMarkerName = (id) => {
        return `marker#${this.slug}#${_utils.app.slugify(id)}`
    }

    /**
     * Add marker at the track extremities
     *
     * @param coordinates
     */
    async addMarkers() {

        if (this.geoJson.type === FEATURE_COLLECTION) {
            let index = 0
            for (const feature of this.geoJson.features) {
                if (feature.type === 'Feature') {
                    const hasTime = feature?.properties?.coordinateProperties?.times !== undefined
                    switch (feature.geometry.type) {
                        case FEATURE_LINE_STRING: {
                            // Add start  marker
                            const start = feature.geometry.coordinates[0]
                            const name = `marker#${this.slug}#start`
                            const timeStart = hasTime ? feature.properties.coordinateProperties.times[0] : undefined
                            this.markers.set('start', new MapMarker({
                                    name: 'Marker start',
                                    parent: this.slug,
                                    id: this.setMarkerName('start'),
                                    coordinates: [start[0], start[1]],
                                    altitude: start[2],
                                    time: timeStart,
                                    type: JUST_ICON,
                                    size: MARKER_SIZE,
                                    icon: faLocationDot,
                                    foregroundColor: vt3d.configuration.track.markers.start.color,
                                    description: 'Starting point',
                                },
                            ))

                            // Add stop marker
                            const stop = feature.geometry.coordinates[feature.geometry.coordinates.length - 1]
                            const timeStop = hasTime ? feature.properties.coordinateProperties.times[feature.geometry.coordinates.length - 1] : undefined

                            this.markers.set('stop', new MapMarker({
                                    name: 'Marker stop',
                                    parent: this.slug,
                                    id: this.setMarkerName('stop'),
                                    coordinates: [stop[0], stop[1]],
                                    altitude: stop[2],
                                    time: timeStop,
                                    type: JUST_ICON,
                                    size: MARKER_SIZE,
                                    icon: faLocationDot,
                                    foregroundColor: vt3d.configuration.track.markers.stop.color,
                                    description: 'Ending point',

                                },
                            ))
                            break
                        }
                        case FEATURE_POINT: {
                            // Add other markers
                            index++
                            const point = feature.geometry.coordinates
                            const id = `index-${index}`
                            const name = `marker#${this.slug}#${id}}`
                            const time = hasTime ? feature.properties.coordinateProperties.times[0] : undefined
                            this.markers.set(id, new MapMarker({
                                    name: feature.properties.name,
                                    parent: this.slug,
                                    id: this.setMarkerName(id),
                                    coordinates: [point[0], point[1]],
                                    altitude: point[2],
                                    time: time,
                                    type: JUST_ICON,
                                    size: MARKER_SIZE,
                                    icon: faLocationDot,
                                    foregroundColor: vt3d.configuration.track.markers.color,
                                    description: feature.properties.desc,
                                },
                            ))
                            break
                        }
                    }
                }
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
                if (feature.type === 'Feature' && feature.geometry.type === FEATURE_LINE_STRING) {
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
                global.minHeight = Math.min(...dataSet.map(a => a?.altitude))

                // Max Height
                global.maxHeight = Math.max(...dataSet.map(a => a?.altitude))

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
     * Simulate altitude, interpolate, clean data
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
                if (feature.type === 'Feature' && feature.geometry.type === FEATURE_LINE_STRING) {
                    let index = 0
                    /**
                     * Have altitude or simulate ?
                     */
                    if (!this.hasAltitude) {
                        // Some altitudes info are missing. Let's simulate them

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
                            // We have aDEM Server, so let's compute altitude
                            let altitudes = []
                            switch (this.DEMServer) {
                                case NO_DEM_SERVER:
                                case 'internal' :
                                    altitudes = await TrackUtils.getElevationFromTerrain(feature.geometry.coordinates)
                                    break
                                case 'open-elevation' : {
                                }
                            }
                            // Add them to data
                            for (let j = 0; j < altitudes.length; j++) {
                                feature.geometry.coordinates[j].push(altitudes[j])
                            }
                            // Hide progress bar
                            vt3d.trackEditorProxy.longTask = false
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
        await TrackUtils.loadTrack(this, action)
        this.markers.forEach(marker => {
            marker.draw()
        })
    }

    /**
     * Toggle track visibility
     *
     */
    toggleVisibility = () => {
        this.visible = !this.visible
    }

    showAfterHeightSimulation = async () => {
        await this.load(SIMULATE_ALTITUDE)
    }

    loadAfterNewSettings = async () => {
        await this.load(RE_LOADING)
    }

    checkOtherData = () => {
        this.altitude = true
        if (this.geoJson.type === FEATURE_COLLECTION) {
            let index = 0
            for (const feature of this.geoJson.features) {
                if (feature.type === 'Feature' && feature.geometry.type === FEATURE_LINE_STRING) {
                    const data = TrackUtils.checkIfDataContainsAltitudeOrTime(feature)
                    this.description = TrackUtils.getDescription(feature)

                    this.hasAltitude = data.hasAltitude
                    this.hasTime = data.hasTime
                    if (!this.hasAltitude) {
                        break
                    }
                }
            }

        }
    }


}