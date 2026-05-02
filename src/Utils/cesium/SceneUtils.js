/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SceneUtils.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-30
 * Last modified: 2026-04-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    ADD_JOURNEY, CURRENT_JOURNEY, DEFAULT_2D_FOCUS_PITCH, DRAWING, DRAWING_FROM_DB, FOCUS_LAST,
    HIGH_TERRAIN_PRECISION, LOW_TERRAIN_PRECISION, REFRESH_DRAWING, SCENE_MODE_2D, SCENE_MODE_3D,
    SCENE_MODE_COLUMBUS, UPDATE_JOURNEY_SILENTLY,
}                    from '@Core/constants'
import { MapTarget } from '@Core/MapTarget'
import bbox          from '@turf/bbox'
import centroid      from '@turf/centroid'
import {
    BoundingSphere, Cartesian2, Cartesian3, Cartographic, Color, EasingFunction, HeadingPitchRange, Math as M, Matrix4,
    Rectangle, sampleTerrain, sampleTerrainMostDetailed, SceneMode,
}                    from 'cesium'

const finiteNumber = value => {
    if (value === null || value === undefined || value === '') {
        return null
    }

    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const MIN_CAMERA_POSITION_HEIGHT = -1000
const MIN_MAP_TARGET_HEIGHT = -12000

const finiteHeightAtLeast = (value, minimum) => {
    const height = finiteNumber(value)
    return height !== null && height >= minimum ? height : null
}

const cameraPositionHeight = value => finiteHeightAtLeast(value, MIN_CAMERA_POSITION_HEIGHT)
const mapTargetHeight = value => finiteHeightAtLeast(value, MIN_MAP_TARGET_HEIGHT)

const focusPointCoordinates = point => {
    const longitude = finiteNumber(point?.longitude)
    const latitude = finiteNumber(point?.latitude)
    const pointHeight = mapTargetHeight(point?.height)
    const simulatedHeight = mapTargetHeight(point?.simulatedHeight)
    const height = simulatedHeight ?? pointHeight

    if ([longitude, latitude, height].some(value => value === null)) {
        return null
    }

    return {
        longitude,
        latitude,
        height,
        pointHeight,
        simulatedHeight,
    }
}

const cameraTargetIsValid = cameraStore => {
    const target = cameraStore?.target
    return finiteNumber(target?.longitude) !== null
        && finiteNumber(target?.latitude) !== null
        && mapTargetHeight(target?.height) !== null
}

const cameraPositionIsValid = position => finiteNumber(position?.longitude) !== null
    && finiteNumber(position?.latitude) !== null
    && cameraPositionHeight(position?.height) !== null

const cameraPositionValue = (position, key, fallback) =>
    finiteNumber(position?.[key]) ?? fallback

const cameraRangeFromStoredPosition = (position = {}, target = {}) => {
    const longitude = finiteNumber(position?.longitude)
    const latitude = finiteNumber(position?.latitude)
    const height = cameraPositionHeight(position?.height)
    const targetLongitude = finiteNumber(target?.longitude)
    const targetLatitude = finiteNumber(target?.latitude)
    const targetHeight = mapTargetHeight(target?.height)

    if ([longitude, latitude, height, targetLongitude, targetLatitude, targetHeight].some(value => value === null)) {
        return null
    }

    return Cartesian3.distance(
        Cartesian3.fromDegrees(longitude, latitude, height),
        Cartesian3.fromDegrees(targetLongitude, targetLatitude, targetHeight),
    )
}

const cameraRangeValue = (position, target, fallback) =>
    cameraRangeFromStoredPosition(position, target) ?? cameraPositionValue(position, 'range', fallback)

const sceneIs2D = () => typeof lgs !== 'undefined'
    && (lgs?.settings?.scene?.mode?.value * 1 === SCENE_MODE_2D.value
        || lgs?.scene?.mode === SceneMode.SCENE2D)

const defaultFocusPitch = () => sceneIs2D()
                                 ? DEFAULT_2D_FOCUS_PITCH
                                 : (typeof lgs !== 'undefined' ? lgs.settings.camera.pitch : -30)

const focusPitchValue = (position, fallback = defaultFocusPitch()) =>
    cameraPositionValue(position, 'pitch', fallback)

const tracksFeatureSource = tracks => {
    const features = Array.from(tracks ?? [])
        .map(track => track?.content)
        .filter(Boolean)

    if (features.length === 0) {
        return null
    }

    return features.length === 1 ? features[0] : {
        type: 'FeatureCollection',
        features,
    }
}

const beginCameraFlight = () => {
    if (typeof __ !== 'undefined') {
        __.ui?.cameraManager?.beginFlight?.()
    }
}

const endCameraFlight = () => {
    if (typeof __ !== 'undefined') {
        __.ui?.cameraManager?.endFlight?.()
    }
}

export class SceneUtils {
    static resolveFlightDuration = (distance, baseDuration, {resetCamera = false, snapDistance = 0} = {}) => {
        if (!Number.isFinite(distance) || distance <= 0) {
            return resetCamera ? Math.max(baseDuration, 1.4) : baseDuration
        }

        if (snapDistance > 0 && distance < snapDistance) {
            return 0
        }

        if (distance < 4000) {
            return resetCamera ? 1.25 : Math.max(baseDuration, 0.75)
        }

        if (distance < 15000) {
            return Math.max(baseDuration, resetCamera ? 1.65 : 1.2)
        }

        if (distance < 80000) {
            return Math.max(baseDuration, resetCamera ? 2.2 : 1.8)
        }

        return Math.max(baseDuration, resetCamera ? 2.8 : 2.2)
    }

    static resolveFlightEasing = (resetCamera = false) =>
        resetCamera ? EasingFunction.EXPONENTIAL_OUT : EasingFunction.SINUSOIDAL_IN_OUT

    /**
     * Do Morphing and trigger event if there is a callback
     *
     * @param sceneMode {integer} SCENE_MODE_2D.value or SCENE_MODE_3D.value
     * @param callback
     */


    static morph = async (sceneMode, callback = null) => {
        // Trigger morphComplete only once,
        let remove = null
        const useCallback = async (event, currentSceneMode) => {
            // We launch callback function only once then we remove the listener
            if (callback) {
                await callback({current: currentSceneMode, new: sceneMode})
                if (remove) {
                    remove()
                }
                if (sceneMode === SCENE_MODE_2D.value) {

                    __.ui.cameraManager.position.longitude = __.ui.cameraManager.target.longitude
                    __.ui.cameraManager.position.latitude = __.ui.cameraManager.target.latitude

                    beginCameraFlight()
                    try {
                        lgs.camera.flyTo({
                                             destination:    Cartesian3.fromDegrees(
                                                 __.ui.cameraManager.position.longitude,
                                                 __.ui.cameraManager.position.latitude,
                                                 __.ui.cameraManager.position.height,
                                             ),
                                             maximumHeight:     lgs.settings.camera.maximumHeight,
                                             pitchAdjustHeight: lgs.settings.camera.pitchAdjustHeight,
                                             duration:       0, // always.
                                             convert:        true,
                                             endTransform:   Matrix4.IDENTITY,
                                             easingFunction: EasingFunction.LINEAR_NONE,
                                             complete:       endCameraFlight,
                                             cancel:         endCameraFlight,
                                         })
                    }
                    catch (error) {
                        endCameraFlight()
                        throw error
                    }
                }

            }
        }
        if (typeof callback === 'function' && !SceneUtils.morphCompeteEvent) {
            remove = lgs.scene.morphComplete.addEventListener(useCallback)
        }

        switch (sceneMode) {
            case SCENE_MODE_2D.value:
                await lgs.scene.morphTo2D(lgs.settings.scene.morphDelay)
                break

            case SCENE_MODE_COLUMBUS.value:
                await lgs.scene.morphToColumbusView(lgs.settings.scene.morphDelay)
                break

            case SCENE_MODE_3D.value:
                await lgs.scene.morphTo3D(lgs.settings.scene.morphDelay)
                break
        }
    }

    /**
     * Return LGS scene mode from Cesium scene
     *
     * @return {{icon: IconDefinition, label: string, title: string, value: number}|{icon: IconDefinition, label:
     *     string, title: string, value: number}|{icon: IconDefinition, label: string, title: string, value: number}}
     */
    static modeFromGIStoLGS = () => {
        switch (lgs.scene.mode) {
            case SceneMode.SCENE2D:
                return SCENE_MODE_2D
            case SceneMode.SCENE3D:
                return SCENE_MODE_3D
            case SceneMode.COLUMBUS_VIEW:
                return SCENE_MODE_COLUMBUS
            default:
                return SCENE_MODE_3D
        }
    }

    static modeFromLGSToGIS = (mode = lgs.settings.scene.mode.value) => {
        switch (mode.value) {
            case SCENE_MODE_2D.value:
                return SceneMode.SCENE2D
            case SCENE_MODE_3D.value:
                return SceneMode.SCENE3D
            case SCENE_MODE_COLUMBUS.value:
                return SceneMode.COLUMBUS_VIEW
            default:
                return SceneMode.SCENE3D
        }
    }

    /**
     * Get points altitude from Cesium Terrain
     *
     * @param coordinates {Array|object}    {longitude,latitude}
     * @param precision                     LOW_TERRAIN_PRECISION or HIGH_TERRAIN_PRECISION (default)
     * @param level                         Zoom level, only used with low precision
     *
     * @return {Array|number} altitude
     */
    static getHeightFromTerrain = async ({coordinates, precision = HIGH_TERRAIN_PRECISION, level = 11} = {}) => {
        if (!coordinates) {
            throw new TypeError('SceneUtils.getHeightFromTerrain requires coordinates')
        }

        const multi = Array.isArray(coordinates)
        const sourceCoordinates = multi ? coordinates : [coordinates]
        const indexedCoordinates = sourceCoordinates
            .map((point, index) => ({point, index}))
            .filter(({point}) => point
                && Number.isFinite(Number(point.longitude))
                && Number.isFinite(Number(point.latitude)))

        if (indexedCoordinates.length === 0) {
            throw new TypeError('SceneUtils.getHeightFromTerrain requires valid longitude/latitude coordinates')
        }

        const cartographics = []
        indexedCoordinates.forEach(({point}) => cartographics.push(Cartographic.fromDegrees(point.longitude, point.latitude,
                                                                                            __.ui.sceneManager.noRelief() ? 0 : (point.simulatedHeight ?? point.height))))
        //TODO apply only if altitude is missing for some coordinates
        const altitude = multi ? Array(sourceCoordinates.length).fill(null) : [0]
        let results
        switch (precision) {
            case HIGH_TERRAIN_PRECISION:
                results = await sampleTerrainMostDetailed(lgs.viewer.terrainProvider, cartographics)
                break
            case LOW_TERRAIN_PRECISION:
                results = await sampleTerrain(lgs.viewer.terrainProvider, level, cartographics)
                break
        }
        // Get altitudes
        results.forEach((coordinate, index) => {
            altitude[indexedCoordinates[index].index] = coordinate.height
        })

        // Returns values in the same format as input
        return multi ? altitude : altitude[0]

    }


    /**
     * Computes the canvas coordinates (X, Y) for a given longitude, latitude, and height.
     * If `clampToGround` is true, the height is adjusted using the terrain provider.
     *
     * @param point
     * @param {boolean} clampToGround - If true, clamps the position to the ground using terrain data.
     *
     * @returns {Promise<{x: number, y: number, visible: boolean}>}
     */
    static degreesToPixelsCoordinates = async (point, clampToGround = true) => {
        // TODO add precision and level

        // simulatedHeight : height from Terrain.
        let simulatedHeight
        if (clampToGround && !__.ui.sceneManager.noRelief()) {
            simulatedHeight = await SceneUtils.getHeightFromTerrain({coordinates: point})
        }
        else {
            simulatedHeight = point.simulatedHeight
        }

        const cartographic = Cartographic.fromDegrees(point.longitude, point.latitude,
                                                      __.ui.sceneManager.noRelief() ? 0 : (simulatedHeight ?? point.height))
        const cartesian = Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, simulatedHeight ?? cartographic.height)
        if (!cartesian) {
            return {visible: false}
        }


        // Get Pixels
        const pixels = new Cartesian2()
        lgs.scene.cartesianToCanvasCoordinates(cartesian, pixels)
        if (!pixels) {
            return {visible: false}
        }

        // Check if it's OK with terrain
        const pickRay = lgs.scene.camera.getPickRay(pixels)
        const pickedPosition = lgs.scene.globe.pick(pickRay, lgs.scene)
        if (!pickedPosition) {
            return {visible: false}
        }


        // Return the final canvas coordinates, height and visibility
        return {
            x:       Math.round(pixels.x),
            y:       Math.round(pixels.y),
            height: __.ui.sceneManager.noRelief() ? 0 : (simulatedHeight ?? cartographic.height),
            visible: true,
        }
    }


    static drawBbox = (bbox, id) => {
        id = `BBox#${id}`
        // We remove the BBox if it already exists
        if (lgs.viewer.entities.getById(id)) {
            lgs.viewer.entities.removeById(id)
        }
        // Add the BBox
        lgs.viewer.entities.add({
                                    id:        id,
                                    name:      id,
                                    rectangle: {
                                        coordinates: Rectangle.fromDegrees(bbox[0], bbox[1], bbox[2], bbox[3]),
                                        material:    Color.CHARTREUSE.withAlpha(0.1),
                                    },
                                })
    }


    static focus = async (point, options = {}) => {

        const coordinates = focusPointCoordinates(point)
        if (!coordinates) {
            console.warn('SceneUtils.focus skipped invalid target', {point})
            return false
        }

        const {
                  longitude,
                  latitude,
                  height,
                  pointHeight,
                  simulatedHeight,
              } = coordinates
        const normalizedPoint = {
            ...point,
            longitude,
            latitude,
            height: pointHeight ?? height,
        }
        if (simulatedHeight !== null) {
            normalizedPoint.simulatedHeight = simulatedHeight
        }
        else {
            delete normalizedPoint.simulatedHeight
        }

        const range = cameraPositionValue(options, 'range', lgs.settings.camera.range)
        const flyRange = cameraPositionValue(options, 'boundingSphereRange', range)
        const pitch = M.toRadians(focusPitchValue(options))
        const heading = M.toRadians(cameraPositionValue(options, 'heading', lgs.settings.camera.heading))
        const roll = M.toRadians(cameraPositionValue(options, 'roll', lgs.settings.camera.roll))
        const cameraDestination = cameraPositionIsValid(options.cameraPosition)
                                  ? Cartesian3.fromDegrees(
                finiteNumber(options.cameraPosition.longitude),
                finiteNumber(options.cameraPosition.latitude),
                finiteNumber(options.cameraPosition.height),
            )
                                  : null
        const target = {
            longitude:       longitude,
            latitude:        latitude,
            height:          height,
            simulatedHeight: simulatedHeight ?? undefined,
            title:           point?.title,
            color:           point?.color ?? lgs.colors.poiDefault,
            bgColor:         point?.bgColor ?? lgs.colors.poiDefaultBackground,
            description:     point?.description ?? '',
            camera:          {
                heading: heading,
                pitch:   pitch,
                roll:    roll,
                range:   range,
            },
        }

        const maximumHeight = cameraPositionValue(options, 'maximumHeight', lgs.settings.camera.maximumHeight)
        let pitchAdjustHeight = cameraPositionValue(options, 'pitchAdjustHeight', lgs.settings.camera.pitchAdjustHeight)
        let flyingTime = cameraPositionValue(options, 'flyingTime', lgs.settings.camera.flyingTime)


        // fix flying time and pitch height if necessary
        const initializer = options.initializer ? options.initializer(normalizedPoint, options) : null
        const snapDistance = options.snapDistance ?? 50000
        if (initializer) {
            flyingTime = SceneUtils.resolveFlightDuration(initializer.distance, flyingTime, {
                resetCamera:  options.resetCamera === true,
                snapDistance: snapDistance,
            })

            if (initializer.distance < 15000) {
                pitchAdjustHeight = initializer.height + 1000
            }
        }

        const syncFocusedCamera = async () => {
            if (!cameraDestination && !options.boundingSphere) {
                return
            }

            await __.ui.cameraManager.raiseUpdateEvent({
                                                           skipTargetPick: true,
                                                           target,
                                                       })

            target.camera = {
                heading: M.toRadians(cameraPositionValue(__.ui.cameraManager.position, 'heading', options.heading ?? lgs.settings.camera.heading)),
                pitch:   M.toRadians(focusPitchValue(__.ui.cameraManager.position, options.pitch ?? defaultFocusPitch())),
                roll:    M.toRadians(cameraPositionValue(__.ui.cameraManager.position, 'roll', options.roll ?? lgs.settings.camera.roll)),
                range:   cameraPositionValue(__.ui.cameraManager.position, 'range', range),
            }
        }

        const complete = async () => {
            const shouldSyncFocusedCamera = Boolean(cameraDestination || options.boundingSphere)
            if (shouldSyncFocusedCamera) {
                await syncFocusedCamera()
            }

            if (options?.bbox && options.bbox.show) {
                SceneUtils.drawBbox(options.bbox.data, options.bbox.id)
            }

            if (options.callback ?? false) {
                options.callback(target, options)
            }

            if (options.rotate ?? false) {
                __.ui.cameraManager.rotateAround(target, {
                    rpm:       options.rpm ?? lgs.settings.camera.rpm,
                    direction: options.direction ?? 1,
                    infinite:  options.infinite ?? true,
                    fps:       lgs.settings.camera.fps,
                    rotations: options.rotations ?? lgs.settings.camera.rotations,
                    lookAt:    true,
                    preserveView: Boolean(cameraDestination),
                })
            }
            else {
                __.ui.sceneManager.stopRotate
                if (!shouldSyncFocusedCamera) {
                    await __.ui.cameraManager.raiseUpdateEvent()
                }
                __.ui.cameraManager.saveInformation(Date.now(), {sync: false})
                __.ui.cameraManager.unlock()
            }
            //
            // if (options.panoramic ?? false) {
            //     __.ui.cameraManager.panoramic(target, {
            //         rpm:       options.rpm ?? lgs.settings.camera.rpm,
            //         infinite: options.infinite ?? true,
            //         fps:       lgs.settings.camera.fps,
            //         rotations: options.rotations ?? lgs.settings.camera.rotations,
            //         lookAt:    true,
            //     })
            // } else {
            //     __.ui.sceneManager.stopPanoramic
            //     __.ui.cameraManager.lookAt(target)
            //     __.ui.cameraManager.unlock()
            // }
        }

        let flightEnded = false
        const endFlightOnce = () => {
            if (!flightEnded) {
                flightEnded = true
                endCameraFlight()
            }
        }
        const completeFlight = async () => {
            try {
                await complete()
            }
            finally {
                endFlightOnce()
            }
        }
        const cancelFlight = () => {
            endFlightOnce()
        }
        const startFlight = (fly) => {
            beginCameraFlight()
            try {
                fly()
            }
            catch (error) {
                endFlightOnce()
                throw error
            }
        }

        const flyOptions = {
            maximumHeight:     maximumHeight,
            pitchAdjustHeight: pitchAdjustHeight,
            duration:          flyingTime,
            convert:           options?.convert ?? true,
            easingFunction:    options.easingFunction ?? SceneUtils.resolveFlightEasing(options.resetCamera === true),
            complete:          completeFlight,
            cancel:            cancelFlight,
        }

        if (cameraDestination) {
            startFlight(() => {
                lgs.camera.flyTo({
                                     ...flyOptions,
                                     destination: cameraDestination,
                                     orientation: {
                                         heading,
                                         pitch,
                                         roll,
                                     },
                                 })
            })
            return true
        }

        const flyToBoundingSphereOptions = {
            ...flyOptions,
            offset: new HeadingPitchRange(heading, pitch, flyRange),
        }

        startFlight(() => {
            lgs.camera.flyToBoundingSphere(options.boundingSphere ?? new BoundingSphere(
                Cartesian3.fromDegrees(longitude, latitude, height), 0,
            ), flyToBoundingSphereOptions)
        })

        return true
    }

    static getJourneyFeatureSource = (journey) => tracksFeatureSource(journey?.tracks?.values())

    static getBboxBoundingSphere = (bboxData, height = 0) => {
        if (!Array.isArray(bboxData) || bboxData.length !== 4) {
            return null
        }

        const [west, south, east, north] = bboxData.map(finiteNumber)
        if ([west, south, east, north].some(value => value === null)) {
            return null
        }

        const focusHeight = mapTargetHeight(height) ?? 0

        if (west === east && south === north) {
            return new BoundingSphere(Cartesian3.fromDegrees(west, south, focusHeight), 0)
        }

        return BoundingSphere.fromPoints([
                                             Cartesian3.fromDegrees(west, south, focusHeight),
                                             Cartesian3.fromDegrees(west, north, focusHeight),
                                             Cartesian3.fromDegrees(east, south, focusHeight),
                                             Cartesian3.fromDegrees(east, north, focusHeight),
                                         ])
    }

    static getJourneyCentroid = async (journey, source = null, {useStoredHeight = true} = {}) => {
        const focusSource = source ?? SceneUtils.getJourneyFeatureSource(journey)
        if (!focusSource) {
            return null
        }

        const [longitude, latitude] = centroid(focusSource).geometry.coordinates
        const storedHeight = useStoredHeight
                             ? mapTargetHeight(journey?.camera?.target?.height)
                               ?? mapTargetHeight(journey?.cameraOrigin?.target?.height)
                             : null
        let height = storedHeight ?? 0

        if (storedHeight !== null) {
            return {
                longitude: longitude,
                latitude:  latitude,
                height:    storedHeight,
            }
        }

        try {
            height = await __.ui.poiManager.getHeightFromTerrain({
                                                                     coordinates: {
                                                                         longitude: longitude,
                                                                         latitude:  latitude,
                                                                     },
                                                                 })
            height = mapTargetHeight(height) ?? 0
        }
        catch (error) {
            console.error(error)
        }
        return {
            longitude: longitude,
            latitude:  latitude,
            height:    height,
        }
    }

    static focusOnJourney = async ({
                                       journey = null,
                                       track = null,
                                       ...options
                                   }) => {

        const focusTrackOnly = track !== null

        // If track not provided, we'll get the first one of the journey
        if (track === null) {
            // But we need to set the journey to the current one if there is no information
            if (journey === null) {
                journey = lgs.theJourney
            }
            track = journey?.tracks?.values().next().value
        }
        else if (journey === null && track.parent) {
            journey = lgs.journeys.get(track.parent)
        }

        if (!track?.content) {
            return
        }

        const focusSource = focusTrackOnly ? track.content : (SceneUtils.getJourneyFeatureSource(journey) ?? track.content)
        const theBbox = SceneUtils.extendBbox(bbox(focusSource), 2)
        const focusId = focusTrackOnly ? track.slug : (journey?.slug ?? track.slug)

        let point
        let cameraPosition = null
        if (!options.resetCamera
            && __.ui.cameraManager.isJourneyFocusOn(FOCUS_LAST)
            && options.action !== REFRESH_DRAWING && options.action !== ADD_JOURNEY) {
            const savedCameraPosition = cameraPositionIsValid(journey?.camera?.position)
                                        ? journey.camera.position
                                        : null
            if (savedCameraPosition && cameraTargetIsValid(journey?.camera)) {
                point = new MapTarget(CURRENT_JOURNEY, {...journey.camera.target, ...{id: journey?.slug ?? focusId}})
                cameraPosition = savedCameraPosition
            }
        }

        if (!point) {
            // Centroid
            const center = await SceneUtils.getJourneyCentroid(journey, focusSource, {
                useStoredHeight: options.resetCamera !== true,
            })
            if (!center) {
                return
            }
            point = new MapTarget(CURRENT_JOURNEY, {...center, ...{id: focusId}})
        }

        const savedCameraPosition = cameraPositionIsValid(cameraPosition) ? cameraPosition : null
        const focusBoundingSphere = savedCameraPosition
                                    ? null
                                    : SceneUtils.getBboxBoundingSphere(theBbox, point.height ?? 0)
        const fallbackRange = 10000

        // Depending on what we are doing, we need to convert the destination
        // from world coordinates to scene coordinates
        let convert = false
        if (__.ui.sceneManager.is2D && (options.action === DRAWING || options.action === DRAWING_FROM_DB)) {
            convert = true
        }
        if (options.action !== UPDATE_JOURNEY_SILENTLY) {
            SceneUtils.focus(point, {
                pitch:          focusPitchValue(savedCameraPosition, DEFAULT_2D_FOCUS_PITCH),
                heading:        cameraPositionValue(savedCameraPosition, 'heading', 0),
                roll:           cameraPositionValue(savedCameraPosition, 'roll', 0),
                range:          cameraRangeValue(savedCameraPosition, point, fallbackRange),
                lookAt:      true,
                rpm:         options.rpm ?? lgs.settings.camera.rpm,
                direction:      options.direction ?? 1,
                rotation:    1,
                infinite:    false,
                bbox:        {data: theBbox, id: focusId, show: false},
                convert:     convert,
                rotate:      options.rotate,
                action:      options.action,
                resetCamera: options.resetCamera,
                callback:    options.callback,
                initializer: options.initializer,
                cameraPosition: savedCameraPosition,
                boundingSphere: focusBoundingSphere,
                boundingSphereRange: focusBoundingSphere?.radius > 0 ? 0 : undefined,

            })

            //Show BBox if requested
            if (options?.bbox ?? false) {
                const id = `BBox#${focusId}`
                // We remove the BBox if it already exists
                if (lgs.viewer.entities.getById(id)) {
                    lgs.viewer.entities.removeById(id)
                }
                // Add the BBox
                lgs.viewer.entities.add({
                                            id:        id,
                                            name:      id,
                                            rectangle: {
                                                coordinates: Rectangle.fromDegrees(theBbox[0], theBbox[1], theBbox[2], theBbox[3]),
                                                material:    Color.CHARTREUSE.withAlpha(0.2),
                                            },
                                        })
            }
        }


    }

    static extendBbox = (bbox, x, y = undefined) => {
        if (!y) {
            y = x
        }
        x /= 100
        y /= 100

        const w = bbox[2] - bbox[0]
        const h = bbox[3] - bbox[1]

        return [bbox[0] - x * w, bbox[1] - y * h, bbox[2] + x * w, bbox[3] + y * h]
    }

    /**
     * Clone any event and propagate it to the canvas
     *
     * @param event
     */
    static propagateEventToCanvas = (event) => {
        // We create a clone Event from React or JS
        const NativeEvent = event?.nativeEvent?.constructor ?? event.constructor
        let clone = new NativeEvent(event.type, event)
        clone.preventDefault()
        event.stopPropagation()
        // Then propagate it to the Cesium Canvas
        lgs.viewer.canvas.dispatchEvent(clone)
    }


}
