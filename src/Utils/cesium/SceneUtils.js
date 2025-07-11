/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SceneUtils.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-03-02
 * Last modified: 2025-03-02
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import {
    ADD_JOURNEY, CURRENT_JOURNEY, DRAWING, DRAWING_FROM_DB, FOCUS_LAST, HIGH_TERRAIN_PRECISION, LOW_TERRAIN_PRECISION,
    REFRESH_DRAWING, SCENE_MODE_2D, SCENE_MODE_3D, SCENE_MODE_COLUMBUS, UPDATE_JOURNEY_SILENTLY,
}                    from '@Core/constants'
import { MapTarget } from '@Core/MapTarget'
import bbox          from '@turf/bbox'
import centroid      from '@turf/centroid'
import {
    Cartesian2, Cartesian3, Cartographic, Color, EasingFunction, Math as M, Matrix4, Rectangle, sampleTerrain,
    sampleTerrainMostDetailed, SceneMode,
}                    from 'cesium'

export class SceneUtils {

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
                                     })
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
    static getHeightFromTerrain = async ({coordinates, precision = HIGH_TERRAIN_PRECISION, level = 11}) => {
        const positions = []
        let multi = true
        if (!Array.isArray(coordinates)) {
            multi = false
            coordinates = [coordinates]
        }

        const cartographics = []
        coordinates.forEach(point => cartographics.push(Cartographic.fromDegrees(point.longitude, point.latitude,
                                                                                 __.ui.sceneManager.noRelief() ? 0 : (point.simulatedHeight ?? point.height))))
        //TODO apply only if altitude is missing for some coordinates
        const altitude = []
        let results
        switch (precision) {
            case HIGH_TERRAIN_PRECISION:
                results = await sampleTerrainMostDetailed(lgs.viewer.terrainProvider, cartographics)
                break
            case LOW_TERRAIN_PRECISION:
                results = await sampleTerrain(lgs.viewer.terrainProvider, precision, cartographics)
                break
        }
        // Get altitudes
        results.forEach(coordinate => {
            altitude.push(coordinate.height)
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


    static focus = async (point, options) => {

        const height = point.simulatedHeight ?? point.height // compatibility <0.8.1
        const range = options.range ?? lgs.settings.camera.range
        const pitch = M.toRadians(options.pitch ?? lgs.settings.camera.pitch)
        const heading = M.toRadians(options.heading ?? lgs.settings.camera.heading)
        const roll = M.toRadians(options.roll ?? lgs.settings.camera.roll)

        const maximumHeight = options.maximumHeight ?? lgs.settings.camera.maximumHeight
        let pitchAdjustHeight = options.pitchAdjustHeight ?? lgs.settings.camera.pitchAdjustHeight
        let flyingTime = options.flyingTime ?? lgs.settings.camera.flyingTime


        // fix flying time and pitch height if necessary
        const initializer = options.initializer ? options.initializer(point, options) : null
        if (initializer) {
            if (initializer.distance < 4000) {
                flyingTime = 0
            }
            else if (initializer.distance < 15000) {
                flyingTime = (flyingTime > 2) ? 2 : flyingTime
                pitchAdjustHeight = initializer.height + 1000
            }


        }
        lgs.camera.flyTo({
                             destination:       Cartesian3.fromDegrees(
                                 point.longitude, point.latitude, height,
                             ),
                             orientation:       {
                                 heading: heading,
                                 pitch: M.toRadians(pitch),
                                 roll:  roll,
                             },
                             maximumHeight:     maximumHeight,
                             pitchAdjustHeight: pitchAdjustHeight,
                             duration:          flyingTime,
                             convert:           options?.convert ?? true,
                             easingFunction: EasingFunction.LINEAR_NONE,
                             complete:          async () => {
                                 const target = {
                                     longitude:       point.longitude,
                                     latitude:        point.latitude,
                                     height:      height,
                                     simulatedHeight: point?.simulatedHeight,
                                     title:           point.title,
                                     color:   point?.color ?? lgs.colors.poiDefault,
                                     bgColor: point?.bgColor ?? lgs.colors.poiDefaultBackground,

                                     description: point?.description ?? '',

                                     camera: {
                                         heading: heading,
                                         pitch:   pitch,
                                         roll:    roll,
                                         range:   range,
                                     },
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
                                         infinite: options.infinite ?? true,
                                         fps:       lgs.settings.camera.fps,
                                         rotations: options.rotations ?? lgs.settings.camera.rotations,
                                         lookAt:    true,
                                     })
                                 }
                                 else {
                                     __.ui.sceneManager.stopRotate
                                     __.ui.cameraManager.lookAt(target)
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
                             },
                         })
    }

    static getJourneyCentroid = async (journey) => {
        // Let's use the first track
        const track = journey.tracks.values().next().value
        const [longitude, latitude] = centroid(track.content).geometry.coordinates
        let height = 0
        try {
            height = await __.ui.poiManager.getElevationFromTerrain({longitude: longitude, latitude: latitude})
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

        // If track not provided, we'll get the first one of the journey
        if (track === null) {
            // But we need to set the journey to the current one if there is no information
            if (journey === null) {
                journey = lgs.theJourney
            }
            track = journey.tracks.values().next().value
        }
        // else {
        //     // We have a track, let's force the journey (even if there is one provided)
        //     journey = lgs.journeys.get(track.parent)
        // }

        const theBbox = SceneUtils.extendBbox(bbox(track.content), 2)

        let point
        if (__.ui.cameraManager.isJourneyFocusOn(FOCUS_LAST)
            && options.action !== REFRESH_DRAWING && options.action !== ADD_JOURNEY) {
            if (journey?.camera) {
                point = new MapTarget(CURRENT_JOURNEY, {...journey.camera.target, ...{slug: journey.slug}})
            }
        }
        else {
            // Centroid
            const centroid = await SceneUtils.getJourneyCentroid(journey)
            point = new MapTarget(CURRENT_JOURNEY, {...centroid, ...{slug: journey.slug}})
        }

        // Depending on what we are doing, we need to convert the destination
        // from world coordinates to scene coordinates
        let convert = false
        if (__.ui.sceneManager.is2D && (options.action === DRAWING || options.action === DRAWING_FROM_DB)) {
            convert = true
        }
        if (options.action !== UPDATE_JOURNEY_SILENTLY) {
            SceneUtils.focus(point, {
                pitch:       -45,
                heading:     0,
                roll:        0,
                range:       10000,
                lookAt:      true,
                rpm:         options.rpm ?? lgs.settings.camera.rpm,
                rotation:    1,
                infinite:    false,
                bbox:        {data: theBbox, id: track.slug, show: false},
                convert:     convert,
                rotate:      options.rotate,
                action:      options.action,
                resetCamera: options.resetCamera,
                callback:    options.callback,
                initializer: options.initializer,

            })

            //Show BBox if requested
            if (options?.bbox ?? false) {
                const id = `BBox#${track.slug}`
                // We remove the BBox if it already exists
                if (lgs.viewer.entities.getById(id)) {
                    lgs.viewer.entities.removeById(id)
                }
                // Add the BBox
                lgs.viewer.entities.add({
                                            id:        id,
                                            name:      id,
                                            rectangle: {
                                                coordinates: Rectangle.fromDegrees(myBbox[0], myBbox[1], myBbox[2], myBbox[3]),
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