/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Track.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-10
 * Last modified: 2026-05-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { CURRENT_TRACK, DRAWING_FROM_UI, FOCUS_ON_FEATURE }                   from '@Core/constants'
import { MapElement }                                                         from '@Core/MapElement'
import { normalizeTrackRenderSmoothing }                                      from '@Utils/cesium/trackRenderSmoothing'
import { normalizeTrackRenderStyle }                                          from '@Utils/cesium/trackRenderStyle'
import { FEATURE, FEATURE_LINE_STRING, FEATURE_MULTILINE_STRING, TrackUtils } from '@Utils/cesium/TrackUtils'
import { Mobility }                                                           from '@Utils/Mobility'
import { decodeHTMLEntities }                                                 from '@Utils/TextUtils'
import { v4 as uuid }                                                         from 'uuid'

const finiteNumber = value => {
    if (value === null || value === undefined || value === '') {
        return null
    }

    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const coordinatePoint = coordinates => {
    if (!Array.isArray(coordinates)) {
        return null
    }

    const longitude = finiteNumber(coordinates[0])
    const latitude = finiteNumber(coordinates[1])

    if (longitude === null || latitude === null) {
        return null
    }

    const point = {longitude, latitude}
    const altitude = finiteNumber(coordinates[2])

    if (altitude !== null) {
        point.altitude = altitude
    }

    return point
}

export class Track extends MapElement {

    static DEFAULT_ACTIVITY = 'trek'

    id
    /** @type {string} */
    title       // Track title
    /** @type {Journey |undefined} */
    parent = undefined
    color       // Line color
    thickness   // Line thickness
    /** @type {object} */
    metrics     // All the metrics associated to the track
    activity
    activitySettings
    renderSmoothing
    renderStyle
    /** @type {boolean} */
    hasTime
    /** @type {boolean} */
    hasAltitude
    /** @type {[]} */
    content     // GEo JSON
    /** @type {{start:MapPOI|undefined,stop:MapPOI|undefined}} */
    flags = {start: undefined, stop: undefined}
    /** @type {object | null} */
    marker = null
    /**
     * @type {string}
     */
    element = CURRENT_TRACK

    constructor(title, options = {}) {
        super()
        this.id = options.id ?? uuid()
        this.title = title
        this.parent = options.parent
        this.slug = options.slug

        const legacyColor = options.color ?? __.ui.editor.journey.newColor()
        const legacyThickness = options.thickness ?? lgs.settings.getJourney.thickness

        this.renderStyle = normalizeTrackRenderStyle(options.renderStyle, {
            color:     legacyColor,
            thickness: legacyThickness,
        })
        this.color = this.renderStyle.color
        this.thickness = this.renderStyle.farPixelWidth
        this.visible = options.visible ?? true
        this.description = options.description === undefined ? undefined : decodeHTMLEntities(options.description)
        this.activity = options.activity ?? Track.defaultActivity()
        this.activitySettings = options.activitySettings
        this.renderSmoothing = options.renderSmoothing === undefined
                               ? undefined
                               : normalizeTrackRenderSmoothing(options.renderSmoothing)


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

    static getBySlug() {

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

    static activityCatalogDefaults = () => {
        return globalThis.lgs?.savedConfiguration?.journey?.activity
            ?? globalThis.lgs?.configuration?.journey?.activity
            ?? {}
    }

    static normalizeActivityCatalog = (activity = undefined) => {
        const defaults = Track.activityCatalogDefaults()
        const defaultProfiles = Array.isArray(defaults.types) ? defaults.types : []
        const currentProfiles = Array.isArray(activity?.types) ? activity.types : []
        const currentProfileMap = new Map(
            currentProfiles
                .filter(profile => profile?.id)
                .map(profile => [profile.id, profile]),
        )
        const normalizedProfiles = defaultProfiles.map(profile => ({
            ...profile,
            ...(currentProfileMap.get(profile.id) ?? {}),
        }))

        currentProfiles.forEach((profile) => {
            if (!profile?.id) {
                return
            }
            if (!normalizedProfiles.some(item => item.id === profile.id)) {
                normalizedProfiles.push({...profile})
            }
        })

        const preferredDefault = activity?.default
            ?? defaults.default
            ?? normalizedProfiles[0]?.id
            ?? Track.DEFAULT_ACTIVITY
        const normalizedDefault = normalizedProfiles.some(profile => profile.id === preferredDefault)
                                  ? preferredDefault
                                  : defaults.default ?? normalizedProfiles[0]?.id ?? Track.DEFAULT_ACTIVITY

        return {
            default: normalizedDefault,
            types:   normalizedProfiles,
        }
    }

    static ensureActivityCatalogPersistence = () => {
        const activitySettings = globalThis.lgs?.settings?.journey?.activity
        const normalized = Track.normalizeActivityCatalog(activitySettings)

        if (!activitySettings || typeof activitySettings !== 'object') {
            return normalized
        }

        const current = {
            default: activitySettings.default,
            types:   Array.isArray(activitySettings.types) ? JSON.parse(JSON.stringify(activitySettings.types)) : [],
        }

        if (JSON.stringify(current) !== JSON.stringify(normalized)) {
            activitySettings.default = normalized.default
            activitySettings.types = normalized.types
        }

        return normalized
    }

    static defaultActivity = () => {
        return Track.ensureActivityCatalogPersistence().default
    }

    static activityDefaultProfiles = () => {
        return Track.normalizeActivityCatalog(Track.activityCatalogDefaults()).types
    }

    static activityProfiles = () => {
        return Track.ensureActivityCatalogPersistence().types
    }

    static activityProfile = (activity = Track.defaultActivity(), overrides = undefined) => {
        const defaultProfiles = Track.activityDefaultProfiles()
        const profiles = Track.activityProfiles()
        const fallback = {
            ...(defaultProfiles.find(profile => profile.id === Track.defaultActivity())
                ?? defaultProfiles.find(profile => profile.id === Track.DEFAULT_ACTIVITY)
                ?? {}),
            ...(globalThis.lgs?.settings?.getMetrics ?? {}),
        }
        const profile = profiles.find(item => item.id === activity)
            ?? profiles.find(item => item.id === Track.defaultActivity())
                        ?? fallback

        return {
            ...fallback,
            ...profile,
            ...(overrides ?? {}),
            id: overrides?.id ?? profile.id ?? activity ?? Track.DEFAULT_ACTIVITY,
        }
    }

    static isOutlierMetric = (pointData, activityProfile) => {
        if (Number.isFinite(activityProfile.maxSpeed) &&
            Number.isFinite(pointData.speed) &&
            pointData.speed > activityProfile.maxSpeed) {
            return 'speed'
        }

        if (Number.isFinite(pointData.duration) && pointData.duration > 0 && Number.isFinite(pointData.elevation)) {
            const verticalRate = pointData.elevation / pointData.duration
            if (verticalRate > 0 &&
                Number.isFinite(activityProfile.maxClimbRate) &&
                verticalRate > activityProfile.maxClimbRate) {
                return 'climb-rate'
            }
            if (verticalRate < 0 &&
                Number.isFinite(activityProfile.maxDescentRate) &&
                Math.abs(verticalRate) > activityProfile.maxDescentRate) {
                return 'descent-rate'
            }
        }

        return false
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
            const times = this.content.properties?.coordinateProperties?.times

            let timeCursor = 0
            segments.forEach((segment, index) => {
                if (!Array.isArray(segment)) {
                    return
                }

                const segmentAggregate = []
                let segmentTimes = []
                if (this.hasTime && type === FEATURE_LINE_STRING) {
                    segmentTimes = Array.isArray(times) ? times : []
                }
                else if (this.hasTime && Array.isArray(times?.[index])) {
                    segmentTimes = times[index]
                }
                else if (this.hasTime && Array.isArray(times)) {
                    segmentTimes = times.slice(timeCursor, timeCursor + segment.length)
                }
                timeCursor += segment.length

                segment.forEach((coordinates, ptIndex) => {
                    const point = coordinatePoint(coordinates)

                    if (!point) {
                        return
                    }

                    if (this.hasTime && segmentTimes[ptIndex]) {
                        point.time = segmentTimes[ptIndex]
                    }
                    segmentAggregate.push(point)
                })
                if (segmentAggregate.length > 0) {
                    aggregateData.push(segmentAggregate)
                }
            })
        }
        return aggregateData
    }

    static calculateGlobalMetrics = ({
                                         points = [],
                                         hasTime = false,
                                         hasAltitude = false,
                                         activityProfile = Track.activityProfile(),
                                         minHeight = undefined,
                                         maxHeight = undefined,
                                     } = {}) => {
        const finiteNumber = value => {
            const number = Number(value)
            return Number.isFinite(number) ? number : null
        }
        const createElevationBucket = () => ({elevation: 0, distance: 0, duration: 0, pace: 0, speed: 0, points: 0})
        const addToElevationBucket = (bucket, point) => {
            bucket.elevation += point.elevation ?? 0
            bucket.distance += point.distance ?? 0
            bucket.duration += point.duration ?? 0
            bucket.points++
        }
        const finalizeElevationBucket = (bucket) => {
            bucket.speed = bucket.duration > 0 ? bucket.distance / bucket.duration : 0
            bucket.pace = bucket.distance > 0 ? bucket.duration / bucket.distance : 0
        }

        const global = {}
        let distance = 0
        let duration = 0
        let idleTime = 0
        let movingDistance = 0
        let movingDuration = 0
        let minSpeed
        let maxSpeed
        let minPace
        let maxPace
        let minSlope
        let maxSlope
        const minSlopeThreshold = activityProfile.minSlope ?? globalThis.lgs?.settings?.getMetrics?.minSlope ?? 0
        const altitudeBuckets = hasAltitude
                               ? {
                                   positive: createElevationBucket(),
                                   negative: createElevationBucket(),
                                   flat:     createElevationBucket(),
                               }
                               : null

        points.forEach((point) => {
            const pointDistance = finiteNumber(point.distance) ?? 0
            distance += pointDistance

            if (hasTime) {
                const pointDuration = finiteNumber(point.duration) ?? 0
                duration += pointDuration

                if (point.activity === true && point.reliableMotion !== false) {
                    movingDistance += pointDistance
                    movingDuration += pointDuration

                    const speed = finiteNumber(point.speed)
                    const pace = finiteNumber(point.pace)

                    if (speed !== null && speed > 0) {
                        minSpeed = minSpeed === undefined ? speed : Math.min(minSpeed, speed)
                        maxSpeed = maxSpeed === undefined ? speed : Math.max(maxSpeed, speed)
                    }

                    if (pace !== null && pace > 0) {
                        minPace = minPace === undefined ? pace : Math.min(minPace, pace)
                        maxPace = maxPace === undefined ? pace : Math.max(maxPace, pace)
                    }
                }
                else if (point.activity === false) {
                    idleTime += pointDuration
                }
            }

            if (hasAltitude && altitudeBuckets) {
                const slope = finiteNumber(point.slope) ?? 0
                minSlope = minSlope === undefined ? slope : Math.min(minSlope, slope)
                maxSlope = maxSlope === undefined ? slope : Math.max(maxSlope, slope)

                if (slope > minSlopeThreshold) {
                    addToElevationBucket(altitudeBuckets.positive, point)
                }
                else if (slope < -minSlopeThreshold) {
                    addToElevationBucket(altitudeBuckets.negative, point)
                }
                else {
                    addToElevationBucket(altitudeBuckets.flat, point)
                }
            }
        })

        const lastDistance = finiteNumber(points.at(-1)?.distanceFromStart)
        global.distance = lastDistance ?? distance

        if (hasTime) {
            global.duration = duration
            global.idleTime = idleTime
            global.movingDistance = movingDistance
            global.movingDuration = movingDuration
            global.averageSpeed = duration > 0 ? distance / duration : 0
            global.averagePace = distance > 0 ? duration / distance : 0
            global.averageSpeedMoving = movingDuration > 0 ? movingDistance / movingDuration : 0
            global.averagePaceMoving = movingDistance > 0 ? movingDuration / movingDistance : 0
            global.minSpeed = minSpeed ?? 0
            global.maxSpeed = maxSpeed ?? 0
            global.minPace = minPace ?? 0
            global.maxPace = maxPace ?? 0
        }

        if (hasAltitude) {
            global.minHeight = minHeight
            global.maxHeight = maxHeight
            global.minSlope = minSlope
            global.maxSlope = maxSlope
            global.positive = altitudeBuckets.positive
            global.negative = altitudeBuckets.negative
            global.flat = altitudeBuckets.flat

            finalizeElevationBucket(global.positive)
            finalizeElevationBucket(global.negative)
            finalizeElevationBucket(global.flat)
        }

        return global
    }

    /**
     * Compute all metrics from a track
     *
     * set metrics as  {[metrics/all points,global]}
     */
    calculateMetrics = () => {

        let featureMetrics = []
        const aggregates = this.aggregateDataForMetrics()
        const activityProfile = Track.activityProfile(this.activity, this.activitySettings)
        let minHeight
        let maxHeight
        let cumulativeDistance = 0
        const minSegmentDuration = Math.max(0, Number(activityProfile.minSegmentDuration) || 0)
        const minSegmentDistance = Math.max(0, Number(activityProfile.minSegmentDistance) || 0)
        const maxPaceThreshold = Math.max(0, Number(activityProfile.maxPace) || 0)
        const maxSpeedDeltaThreshold = Math.max(0, Number(activityProfile.maxSpeedDelta) || 0)
        let previousMovingSpeed

        // 1st step : Metrics per points
        // we iterate on all points to compute
        //  - distance
        // If we have altitude we can compute
        //  - elevation, slope
        // If we have time information, we can also compute
        //  - duration, speed, pace

        aggregates.forEach((aggregate) => {
            const segmentData = []
            for (let index = 1; index < aggregate.length; index++) {
                const prev = aggregate[index - 1]
                const current = aggregate[index]
                const pointData = {}
                const prevSpeed = Number(previousMovingSpeed)

                pointData.distance = Mobility.distance(prev, current)
                if (this.hasTime && current?.time && prev?.time) {
                    pointData.duration = Mobility.duration(prev.time, current.time)
                    pointData.speed = Mobility.speed(pointData.distance, pointData.duration)
                    pointData.pace = Mobility.pace(pointData.distance, pointData.duration)
                    pointData.reliableMotion =
                        pointData.duration >= minSegmentDuration &&
                        pointData.distance >= minSegmentDistance

                    if (pointData.reliableMotion && maxPaceThreshold > 0 && pointData.pace > maxPaceThreshold) {
                        pointData.reliableMotion = false
                    }

                    if (pointData.reliableMotion && maxSpeedDeltaThreshold > 0 && Number.isFinite(prevSpeed)) {
                        const speedDelta = Math.abs(pointData.speed - prevSpeed)
                        if (speedDelta > maxSpeedDeltaThreshold) {
                            pointData.reliableMotion = false
                        }
                    }

                    pointData.activity = !(
                        pointData.duration >= (activityProfile.stopDuration ?? globalThis.lgs?.settings?.getMetrics?.stopDuration ?? 0) &&
                        pointData.speed <= (activityProfile.stopSpeedLimit ?? globalThis.lgs?.settings?.getMetrics?.stopSpeedLimit ?? 0)
                    )

                    if (pointData.reliableMotion && pointData.activity === true && Number.isFinite(pointData.speed) && pointData.speed > 0) {
                        previousMovingSpeed = pointData.speed
                    }
                }
                if (this.hasAltitude) {
                    pointData.elevation = Mobility.elevation(prev, current)
                    pointData.slope = pointData.distance > 0 ? pointData.elevation / pointData.distance * 100 : 0
                }
                pointData.ignored = Track.isOutlierMetric(pointData, activityProfile)
                if (!pointData.ignored) {
                    if (this.hasAltitude) {
                        const prevAltitude = Number(prev.altitude)
                        const currentAltitude = Number(current.altitude)
                        if (Number.isFinite(prevAltitude)) {
                            minHeight = minHeight === undefined ? prevAltitude : Math.min(minHeight, prevAltitude)
                            maxHeight = maxHeight === undefined ? prevAltitude : Math.max(maxHeight, prevAltitude)
                        }
                        if (Number.isFinite(currentAltitude)) {
                            minHeight = minHeight === undefined ? currentAltitude : Math.min(minHeight, currentAltitude)
                            maxHeight = maxHeight === undefined ? currentAltitude : Math.max(maxHeight, currentAltitude)
                        }
                    }
                    cumulativeDistance += pointData.distance ?? 0
                    segmentData.push({
                        ...current,
                        ...pointData,
                        distanceFromStart: cumulativeDistance,
                    })
                }
            }
            featureMetrics.push(segmentData)
        })

        // Do not work with segment any more
        featureMetrics = featureMetrics.flat()

        const global = Track.calculateGlobalMetrics({
                                                        points:      featureMetrics,
                                                        hasTime:     this.hasTime,
                                                        hasAltitude: this.hasAltitude,
                                                        activityProfile,
                                                        minHeight,
                                                        maxHeight,
                                                    })
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
        await TrackUtils.draw(this, {action: action, mode: mode, forcedToHide: forcedToHide})

        // Focus on the parent Journey
        if (mode === FOCUS_ON_FEATURE) {
            __.ui.sceneManager.focusOnJourney({track: this, target: this.parent})
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
        lgs.stores.journeyEditor.track = this
    }

    addToContext = (setToCurrent = true) => {
        lgs.saveJourneyInContext(lgs.getJourneyBySlug(this.parent))
        if (setToCurrent) {
            lgs.theTrack = this
        }
    }

}
