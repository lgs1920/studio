import { DRAWING_FROM_UI, FOCUS_ON_FEATURE, REFRESH_DRAWING }                 from '@Core/constants'
import { MapElement }                                                         from '@Core/MapElement'
import { POI }                                                                from '@Core/POI'
import { ProfileTrackMarker }                                                 from '@Core/ProfileTrackMarker'
import { SceneUtils }                                                         from '@Utils/cesium/SceneUtils'
import { FEATURE, FEATURE_LINE_STRING, FEATURE_MULTILINE_STRING, TrackUtils } from '@Utils/cesium/TrackUtils'
import { Mobility }                                                           from '@Utils/Mobility'
import { DateTime }                                                           from 'luxon'


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
    /** @type {ProfileTrackMarker | null} */
    marker = null

    constructor(title, options = {}) {
        super()
        this.title = title
        this.parent = options.parent
        this.slug = options.slug

        this.color = options.color ??__.ui.editor.journey.newColor()
        this.thickness = options.thickness ?? lgs.settings.getJourney.thickness
        this.visible = options.visible ?? true
        this.description = options.description ?? undefined


        this.name = options.name
        this.hasTime = options.hasTime ?? false
        this.hasAltitude = options.hasAltitude ?? false
        this.segments = options.segments ?? 0
        this.content = options.content
        this.flags = options.flags ?? {start: undefined, stop: undefined}
        this.marker = options.marker ?? null

        this.metrics = options.metrics ?? {}
    }

    static deserialize(props) {
        props.instance = new Track()
        let instance = super.deserialize(props)

        // Transform Flags from object to class
        instance.flags.start = new POI(instance.flags.start)
        instance.flags.stop = new POI(instance.flags.stop)
        instance.marker = new ProfileTrackMarker(instance.marker)

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
                        pointData.activity =
                            pointData.speed > lgs.settings.getMetrics.stopSpeedLimit ||
                            pointData.duration > lgs.settings.getMetrics.stopDuration
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

        // Do not work with segment any more
        featureMetrics = featureMetrics.flat()

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
            // Select all speeds
            tmp = TrackUtils.filterArray(featureMetrics, {
                speed: speed => speed !== 0 && speed !== undefined,
            })

            // Average speed
            global.averageSpeed = tmp.reduce((s, o) => {
                return s + o.speed
            }, 0) / tmp.length

            // Average pace (we exclude 0 and undefined values)
            global.averagePace = tmp.reduce((s, o) => {
                return s + o.pace
            }, 0) / tmp.length

            // Select all speeds where activity has been found
            tmp = TrackUtils.filterArray(featureMetrics, {
                speed: speed => speed !== 0 && speed !== undefined,
                activity: activity => activity === true,
            })

            // Average speed in moving
            global.averageSpeedMoving = tmp.reduce((s, o) => {
                return s + o.speed
            }, 0) / tmp.length

            // Min speed
            global.minSpeed = Math.min(...tmp.map(a => a?.speed))

            // Max speed
            global.maxSpeed = Math.max(...tmp.map(a => a?.speed))

            // Min Pace (the fastest pace is the minimum)
            global.minPace = Math.min(...tmp.map(a => a?.pace))

            // Max Pace (the fastest pace is the minimum)
            global.maxPace = Math.max(...tmp.map(a => a?.pace))

            // Average pace in moving
            tmp = TrackUtils.filterArray(featureMetrics, {
                pace: pace => pace !== 0 && pace !== undefined,
                activity: activity => activity === true,
            })
            global.averagePaceMoving = tmp.reduce((s, o) => {
                return s + o.pace
            }, 0) / tmp.length
        }

        if (this.hasAltitude) {

            // Max Slope
            global.maxSlope = this.hasAltitude ? Math.max(...featureMetrics.map(a => a?.slope)) : undefined

            // Data relative to elevation
            global.positive = {elevation: 0, distance: 0, duration: 0, pace: 0, speed: 0, points: 0}
            global.negative = {elevation: 0, distance: 0, duration: 0, pace: 0, speed: 0, points: 0}
            global.flat = {elevation: 0, distance: 0, duration: 0, pace: 0, speed: 0, points: 0}

            featureMetrics.forEach((point) => {
                if (point.slope > lgs.settings.getMetrics.minSlope) {
                    // We sum all data when we get a positive slope
                    global.positive.elevation += point.elevation
                    global.positive.distance += point.distance
                    global.positive.duration += point.duration
                    global.positive.speed += point.speed
                    global.positive.pace += point.pace
                    global.positive.points++
                }
                else if (point.slope < -lgs.settings.getMetrics.minSlope) {
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

            // Total idleTime
            global.idleTime = featureMetrics.reduce((s, o) => {
                return s + !o.activity ? o.duration : 0
            }, 0.0)

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

            segments.forEach(() => {
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
    draw = async ({action = DRAWING_FROM_UI, mode = FOCUS_ON_FEATURE, forcedToHide = false}) => {
        TrackUtils.draw(this, {action: action, mode: mode, forcedToHide: forcedToHide}).then(() => {
            // Let's draw flags for the first time.
                if (this.flags.start) {
                    if (action === REFRESH_DRAWING) {
                        this.flags.start.drawn = false
                    }
                    this.flags.start.draw(!forcedToHide)
                }
                if (this.flags.stop) {
                    if (action === REFRESH_DRAWING) {
                        this.flags.stop.drawn = false
                    }
                    this.flags.stop.draw(!forcedToHide)
                }

                if (this.marker) {
                    if (action === REFRESH_DRAWING) {
                        this.marker.drawn = false
                    }
                    this.marker.draw(forcedToHide)
                }
        })

        // Focus on the parent Journey
        if (mode === FOCUS_ON_FEATURE) {
            SceneUtils.focusOnJourney({track: this})
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
        lgs.theJourneyEditorProxy.track = this
    }

    addToContext = (setToCurrent = true) => {
        lgs.saveJourneyInContext(lgs.getJourneyBySlug(this.parent))
        if (setToCurrent) {
            lgs.theTrack = this
        }
    }

}