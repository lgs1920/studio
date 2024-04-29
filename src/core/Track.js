import { FOCUS_ON_FEATURE, INITIAL_LOADING } from '@Core/Journey'
import { MapElement }                        from '@Core/MapElement'
import { POI }                               from '@Core/POI'
import { FEATURE_LINE_STRING, TrackUtils }   from '@Utils/cesium/TrackUtils'
import { Mobility }                          from '@Utils/Mobility'
import { DateTime }                          from 'luxon'
import { FEATURE, FEATURE_MULTILINE_STRING } from '../Utils/cesium/TrackUtils'


export class Track extends MapElement {

    /** @type {string} */
    title       // Track title
    /** @type {Journey |undefined} */
    parent = undefined
    color       // Line color
    thickness   // Line thickness
    /** @type {object} */
    metrics     // All the metrics associated to the track
    /** @type {boolean} */
    hasTime
    /** @type {boolean} */
    hasAltitude
    /** @type {[]} */
    content     // GEo JSON
    /** @type {{start:POI|undefined,stop:POI|undefined}} */
    flags = {start: undefined, stop: undefined}

    constructor(title, options = {}) {
        super()
        this.title = title
        this.parent = options.parent
        this.slug = options.slug

        this.color = options.color ?? vt3d.configuration.journey.color
        this.thickness = options.thickness ?? vt3d.configuration.journey.thickness
        this.visible = options.visible ?? true
        this.description = options.description ?? undefined

        this.name = options.name
        this.hasTime = options.hasTime ?? false
        this.hasAltitude = options.hasAltitude ?? false
        this.segments = options.segments ?? 0
        this.content = options.content
        this.flags = options.flags ?? {start: undefined, stop: undefined}
        this.metrics = options.metrics ?? {}
    }

    static deserialize(props) {
        props.instance = new Track()
        let instance = super.deserialize(props)

        // Transform Flags from object to class
        instance.flags.start = new POI(instance.flags.start)
        instance.flags.stop = new POI(instance.flags.stop)

        return instance
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

    static unproxify = (object) => {
        return super.serialize({...object, ...{__class: Track}})
    }

    /**
     * Prepare it an extract all metrics
     *
     */
    extractMetrics = () => {        // Maybe we have some changes to operate
        this.prepareContent()
        this.calculateMetrics()
    }

    /**
     * Aggregate Geo Json data in order to have longitude, latitude, altitude,time
     * for each point (altitude and time may not exist)
     *
     * @param geoJson
     * @return {[[{longitude, latitude, altitude,time}]]}  This is  multi segment format
     *         ie [[segment][[segment]]] event if it is a line string
     *
     */
    aggregateDataForMetrics = () => {
        const aggregateData = []
        // Only for Feature Collections that are Line or multi line string typ
        const type = this.content.geometry.type

        if (this.content.type === FEATURE &&
            [FEATURE_LINE_STRING, FEATURE_MULTILINE_STRING].includes(type)) {
            // According to type (Line or multiline), we transform the
            // coordinates in order to be  in (real or simulated) multiline mode
            const segments = type === FEATURE_LINE_STRING
                             ? [this.content.geometry.coordinates]
                             : this.content.geometry.coordinates

            // Same for times data if exists
            const times = type === FEATURE_LINE_STRING
                          ? [this.content.properties.coordinateProperties?.times]
                          : this.content.properties.coordinateProperties?.times

            segments.forEach((segment, index) => {
                const segmentAggregate = []
                segment.forEach((coordinates, ptIndex) => {
                    let point = {longitude: coordinates[0], latitude: coordinates[1]}
                    if (this.hasAltitude) {
                        point.altitude = coordinates[2]
                    }
                    if (this.hasTime) {
                        point.time = times[index][ptIndex]
                    }
                    segmentAggregate.push(point)
                })
                aggregateData.push(segmentAggregate)
            })
        }
        return aggregateData
    }

    /**
     * Compute all metrics from a track
     *
     * set metrics as  {[metrics/all points,global]}
     */
    calculateMetrics = () => {

        let featureMetrics = []

        // 1st step : Metrics per points
        // we iterate on all points to compute
        //  - distance
        // If we have altitude we can compute
        //  - elevation, slope
        // If we have time information, we can also compute
        //  - duration, speed, pace

        this.aggregateDataForMetrics().forEach((aggregate) => {
            const segmentData = []
            let index = 1
            for (const prev of aggregate) {
                const current = aggregate[index]
                const pointData = {}
                if (index <= aggregate.length) {
                    pointData.distance = Mobility.distance(prev, current)
                    if (this.hasTime && current?.time && prev?.time) {
                        pointData.duration = Mobility.duration(DateTime.fromISO(prev.time), DateTime.fromISO(current.time))
                        pointData.speed = Mobility.speed(pointData.distance, pointData.duration)
                        pointData.pace = Mobility.pace(pointData.distance, pointData.duration)
                        // IdleTime

                        if (pointData.speed > vt3d.configuration.metrics.stopSpeedLimit
                            || pointData.duration > vt3d.configuration.metrics.stopDuration) {
                            pointData.idleTime = pointData.duration

                        } else {
                            pointData.idleTime = 0

                        }
                    }
                    if (this.hasAltitude) {
                        pointData.elevation = Mobility.elevation(prev, current)
                        pointData.slope = pointData.elevation / pointData.distance * 100
                    }
                }
                index++
                segmentData.push({...current, ...pointData})
            }
            featureMetrics.push(segmentData.slice(0, -1))
        })

        featureMetrics = featureMetrics.flat()
        //

        /**
         * Step 2: Globals
         *
         * Now we can compute globals, ie some min max, average + total information(distance, time, D+/D- )
         */
        let global = {}, tmp = []

        // Min Height
        global.minHeight = this.hasAltitude ? Math.min(...featureMetrics.map(a => a?.altitude)) : undefined

        // Max Height
        global.maxHeight = this.hasAltitude ? Math.max(...featureMetrics.map(a => a?.altitude)) : undefined

        // If the first have duration time, all the data set have time
        if (this.hasTime) {
            // Max speed
            //TODO fixe this e ne prenant pas en compte les idleTime
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

        if (this.hasAltitude) {

            // Max Slope
            global.maxSlope = this.hasAltitude ? Math.max(...featureMetrics.map(a => a?.slope)) : undefined

            // Data relative to elevation
            global.positive = {elevation: 0, distance: 0, duration: 0, pace: 0, speed: 0, points: 0}
            global.negative = {elevation: 0, distance: 0, duration: 0, pace: 0, speed: 0, points: 0}
            global.flat = {elevation: 0, distance: 0, duration: 0, pace: 0, speed: 0, points: 0}

            featureMetrics.forEach((point) => {
                if (point.slope > vt3d.configuration.metrics.minSlope) {
                    // We sum all data when we get a positive slope
                    global.positive.elevation += point.elevation
                    global.positive.distance += point.distance
                    global.positive.duration += point.duration
                    global.positive.speed += point.speed
                    global.positive.pace += point.pace
                    global.positive.points++
                } else if (point.slope < -vt3d.configuration.metrics.minSlope) {
                    // We sum all data when we get a negative slope
                    global.negative.elevation += point.elevation
                    global.negative.distance += point.distance
                    global.negative.duration += point.duration
                    global.negative.speed += point.speed
                    global.negative.pace += point.pace
                    global.negative.points++
                } else {
                    // And then when we consider it is flat
                    global.flat.elevation += point.elevation
                    global.flat.distance += point.distance
                    global.flat.duration += point.duration
                    global.flat.pace += point.pace
                    global.flat.speed += point.speed
                    global.flat.points++
                }
            })

            // Some average
            if (global.positive.points) {
                global.positive.speed /= global.positive.points
                global.positive.pace /= global.positive.points
            }
            if (global.negative.points) {
                global.negative.speed /= global.negative.points
                global.negative.pace /= global.negative.points
            }
            if (global.flat.points) {
                global.flat.speed /= global.flat.points
                global.flat.pace /= global.flat.points
            }

        }
        if (this.hasTime) {
            // Total duration
            global.duration = featureMetrics.reduce((s, o) => {
                return s + o.duration
            }, 0)

            // Total duration
            global.idleTime = featureMetrics.reduce((s, o) => {
                return s + o.idleTime
            }, 0)
        }

        // Total Distance
        global.distance = featureMetrics.reduce((s, o) => {
            return s + o.distance
        }, 0)
        this.metrics = {points: featureMetrics, global: global}
    }

    /**
     * Prepare GeoJson content
     *
     * Simulate altitude, interpolate, clean data
     *
     * @return geoJson
     *
     */
    prepareContent = () => {

        // Only for Feature Collections that are Line or multi line string typ
        const type = this.content.geometry.type

        if (this.content.type === FEATURE &&
            [FEATURE_LINE_STRING, FEATURE_MULTILINE_STRING].includes(type)) {
            // According to type (Line or multiline), we transform the
            // coordinates in order to be  in (real or simulated) multiline mode.
            // This allows to work with segments
            const segments = type === FEATURE_LINE_STRING
                             ? [this.content.geometry.coordinates]
                             : this.content.geometry.coordinates

            segments.forEach((segment, index) => {
                // Some altitudes info are missing. Let's simulate them
                // TODO do this only for the first time (ie hasAltitude = 0, SIMULATED,CLEANED ...)
                if (!this.hasAltitude) {
                    // TODO add different plugins for DEM elevation like:
                    //        https://tessadem.com/elevation-api/  ($)
                    //     or https://github.com/Jorl17/open-elevation/blob/master/docs/api.md

                    // if (this.DEMServer === NO_DEM_SERVER) {
                    //     // May be, some computations have been done before, so we cleaned them
                    //     // use case : any DEM server -> no DEM server
                    //     let j = 0
                    //     segment.geometry.coordinates.forEach(coordinate => {
                    //         if (coordinate.length === 3) {
                    //             segment.geometry.coordinates[j] = coordinate.splice(2, 1)
                    //         }
                    //         j++
                    //     })
                    // } else {
                    //     // We have aDEM Server, so let's compute altitude
                    //     let altitudes = []
                    //     switch (this.DEMServer) {
                    //         case NO_DEM_SERVER:
                    //             break
                    //         case 'internal' :
                    //             // altitudes = await
                    //             // TrackUtils.getElevationFromTerrain(segment.geometry.coordinates)
                    //             break
                    //         case 'open-elevation' : {
                    //         }
                    //     }
                    //     // Add them to data
                    //     for (let j = 0; j < altitudes.length; j++) {
                    //         segment.geometry.coordinates[j].push(altitudes[j])
                    //     }
                    //     // Hide progress bar
                    //     vt3d.theJourneyEditorProxy.longTask = false
                    // }
                }
                // Use title as feature name
                this.content.properties.name = this.title

                // TODO interpolate points to avoid GPS errors (Kalman Filter ?)
                // TODO Clean

            })

            // Update the content according the feature type
            this.content.geometry.coordinates = type === FEATURE_LINE_STRING
                                                ? segments[0] : segments
        }
    }

    /**
     * Draws the Track on the globe
     *
     * @return {Promise<void>}
     */
    draw = async ({action = INITIAL_LOADING, mode = FOCUS_ON_FEATURE, forcedToHide = false}) => {
        TrackUtils.draw(this, {action: action, mode: mode, forcedToHide: forcedToHide}).then(result => {
            // Let's draw flags for the first time.
            if (action === INITIAL_LOADING) {
                if (this.flags.start) {
                    this.flags.start.draw(!forcedToHide)
                }
                if (this.flags.stop) {
                    this.flags.stop.draw(!forcedToHide)
                }
            }
        })

        // Focus on track
        if (mode === FOCUS_ON_FEATURE) {
            TrackUtils.focus(this)
        }
    }

    /**
     * Toggle track visibility
     *
     */
    toggleVisibility = () => {
        this.visible = !this.visible
    }

    addToEditor = () => {
        vt3d.theJourneyEditorProxy.track = this
    }

    addToContext = (setToCurrent = true) => {
        vt3d.saveJourney(vt3d.getJourneyBySlug(this.parent))
        if (setToCurrent) {
            vt3d.theTrack = this
        }
    }

}