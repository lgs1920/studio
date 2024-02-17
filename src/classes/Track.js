import {gpx, kml}                                    from '@tmcw/togeojson'
import {AppUtils}                                    from '../Utils/AppUtils'
import {Mobility}                                    from '../Utils/Mobility'
import {FEATURE_COLLECTION, LINE_STRING, TrackUtils} from '../Utils/TrackUtils'

export class Track {
    static NO_DEM = 'none'
    #name
    #type   // gpx,kml,geojson  //TODO kmz
    #slug
    #geoJson
    #DEMServer
    #realName
    #metrics

    constructor(name, type, content) {
        this.#name = name
        this.#realName = name
        this.#type = type
        this.slug = AppUtils.slugify(`${name}-${type}`)
        this.#DEMServer = Track.NO_DEM

        this.toGeoJson(content)
        this.computeAll()
    }

    /**
     * Get Geo Json
     *
     * @return {*} Geo Json content
     */
    get geoJson() {
        return this.#geoJson
    }

    /**
     * set Geo Json
     *
     * @param geoJson
     */
    set geoJson(geoJson) {
        this.#geoJson = geoJson
    }

    /**
     * Get Metrics
     *
     * @return {object}
     */
    get metrics() {
        return this.#metrics
    }

    /**
     * Set Metrics
     *
     */
    set metrics(metrics) {
        this.#metrics = metrics
    }

    /**
     * Get DEM Server
     *
     * @return {string}
     */
    get DEMServer() {
        return this.#DEMServer ?? Track.NO_DEM
    }

    /**
     * set DEM server
     *
     * @param server
     */
    set DEMServer(server) {
        this.#DEMServer = server ?? Track.NO_DEM
    }

    /**
     * Prepare it an extract all metrics
     *
     * @param content
     */
    async computeAll() {
        // Maybe we have some changes to operate
        await this.prepareGeoJson()
        // Get metrics
        this.#metrics = await this.#calculateMetrics()
    }

    /**
     * Get the track data and set the GeoJson Structure
     *
     * @param content content of the track file
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
            switch (this.#type) {
                case 'gpx':
                    this.#geoJson = gpx(new DOMParser().parseFromString(content, 'text/xml'))
                    break
                case 'kmz' :
                    // TODO unzip to get kml. but what to do with the assets files that are sometimes embedded
                    break
                case 'kml':
                    this.#geoJson = kml(new DOMParser().parseFromString(content, 'text/xml'))
                    break
                case 'geojson' :
                    geoJson = JSON.parse(content)
                    this.#geoJson = geoJson
            }

        } catch (error) {
            console.error(error)
            // Error => we notify
            UINotifier.notifyError({
                caption: `An error occurs during loading <strong>${trackFile.name}<strong>!`, text: error,
            })
            this.#geoJson = undefined
        }
    }

    /**
     * Compute all metrics from a track
     *
     * set metrics as  {[metrics/all points,global]}
     */
    #calculateMetrics = async () => {
        return await TrackUtils.prepareDataForMetrics(this.#geoJson).then(dataForMetrics => {
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

        if (this.#geoJson.type === FEATURE_COLLECTION) {
            let index = 0
            for (const feature of this.#geoJson.features) {
                if (feature.type === 'Feature' && feature.geometry.type === LINE_STRING) {

                    const properties = TrackUtils.checkIfDataContainsHeightOrTime(feature)
                    if (!properties.hasHeight && this.DEMServer === Track.NO_DEM) {
                        window.vt3d.store.modals.altitudeChoice.show = true
                    }
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

                    this.#geoJson.features[index] = feature
                }
                index++
            }
        }
    }

    addToContext = () => {
        window.vt3d.addTrack(this)
    }

    show = async () => {
        await TrackUtils.showTrack(this.geoJson)
    }

}