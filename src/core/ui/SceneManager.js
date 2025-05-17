/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SceneManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-05-17
 * Last modified: 2025-05-16
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import {
    NO_FOCUS, REFRESH_DRAWING, SCENE_MODE_2D, SCENE_MODE_3D, SCENE_MODE_COLUMBUS, SCENE_MODES,
}                                  from '@Core/constants'
import { MapTarget }               from '@Core/MapTarget'
import { SceneUtils }              from '@Utils/cesium/SceneUtils'
import { Mobility }                from '@Utils/Mobility'
import { UIToast }                 from '@Utils/UIToast'
import { LayersAndTerrainManager } from './LayerAndTerrainManager'

export class SceneManager {

    #focusTarget = null
    constructor() {
        // Singleton
        if (SceneManager.instance) {
            return SceneManager.instance
        }

        this.utils = SceneUtils
        SceneManager.instance = this

    }

    /**
     * Do morphing
     *
     * @param mode {integer}       SCENE_MODE_2D.value or SCENE_MODE_3D.value
     * @param callback {function}   called  at the end of morphing
     */
    morph = (mode, callback = null) => {
        // update settings
        lgs.settings.scene.mode.value = mode
        SceneUtils.morph(mode, callback)
    }

    /**
     * Morph to 2D
     *
     * @param callback {function}   called  at the end of morphing
     */
    morphTo2D = (callback) => {
        this.morph(SCENE_MODE_2D.value, callback)
    }

    /**
     * Morph to 3D
     *
     * @param callback {function}   called  at the end of morphing
     */
    morphTo3D = (callback) => {
        this.morph(SCENE_MODE_3D.value, callback)
    }

    /**
     * IS it 2D ?
     *
     * return {boolean}
     */
    get is2D() {
        return lgs.settings.scene.mode.value * 1 === SCENE_MODE_2D.value
    }

    /**
     * Is it 3D ?
     *
     * return {boolean}
     */
    get is3D() {
        return lgs.settings.scene.mode.value * 1 === SCENE_MODE_3D.value
    }

    /**
     * Is it Columbus View ?
     *
     * return {boolean}
     */
    get isColumbus() {
        return lgs.settings.scene.mode.value * 1 === SCENE_MODE_COLUMBUS.value
    }

    /**
     * switch between 2D and 3D
     *
     * @param callback {function}   called  at the end of morphing
     */
    toggleMode = (callback) => {
        if (this.is2D) {
            this.morphTo3D(callback)
        }
        else {
            this.morphTo2D(callback)
        }
    }

    test = (sceneMode) => console.log('morph', sceneMode)

    noRelief = () => {
        const manager = new LayersAndTerrainManager()
        const terrain = manager.getEntityProxy(lgs.settings.layers.terrain)
        return lgs.settings.scene.mode.value * 1 === SCENE_MODE_2D.value
            || (terrain?.noRelief ?? false)
    }

    notifyMorph = () => {
        UIToast.success({
                            caption: `View changed to ${SCENE_MODES.get(lgs.scene.mode).title} !`,
                            text:    `Enjoy!`,
                        })
    }


    afterMorphing = async () => {

        // Remove starting animation (rotate,...)
        __.ui.cameraManager.stopWatching()

        // Now it's time for the show. Draw all journeys
        const items = []
        lgs.journeys.forEach(journey => {
            items.push(journey.draw({
                                        action: REFRESH_DRAWING,
                                        mode:   NO_FOCUS,
                                    }))
        })
        await Promise.all(items)
        this.notifyMorph()
    }

    get startRotate() {
        lgs.mainProxy.components.mainUI.rotate.running = true
        return lgs.mainProxy.components.mainUI.rotate.running
    }

    //
    focusPreProcessing = (point, options) => {
        const from = lgs.mainProxy.components.mainUI.rotate.target
        if (point instanceof MapTarget) {
            lgs.mainProxy.components.mainUI.rotate.target = point
        }
        else {
            lgs.mainProxy.components.mainUI.rotate.target = new MapTarget(point.element, point)
        }
        const distance = Mobility.distance(from, point)
        return {
            distance: distance,
            height:   Math.max(from.height, point.height),
        }
    }

    focusPostProcessing = (point, options) => {
        // console.log(point, options)
    }

    get stopRotate() {
        lgs.mainProxy.components.mainUI.rotate.running = false
        return lgs.mainProxy.components.mainUI.rotate.running
    }

    getJourneyCentroid = async journey => await this.utils.getJourneyCentroid(journey)

    focus = (point, options) => {
        this.#focusTarget = options.target ?? null

        this.utils.focus(point, {
            ...options,
            initializer: options.initializer ?? this.focusPreProcessing,
            callback:    options.callback ?? this.focusPostProcessing,
        })
    }

    focusOnJourney = async (options) => {
        this.#focusTarget = options.target ?? null
        await this.utils.focusOnJourney({
                                            ...options,
                                            initializer: options.initializer ?? this.focusPreProcessing,
                                            callback:    options.callback ?? this.focusPostProcessing,
                                        })
    }

    get target() {
        return this.#focusTarget
    }

    /**
     * Clone any event and propagate it to the canvas
     *
     * @param event
     */
    propagateEventToCanvas = (event) => this.utils.propagateEventToCanvas(event)

    /**
     * Get points altitude from Cesium Terrain
     *
     * @param coordinates {Array|object}    {longitude,latitude}
     * @param precision                     LOW_TERRAIN_PRECISION or HIGH_TERRAIN_PRECISION (default)
     * @param level                         Zoom level, only used with low precision
     *
     * @return {Array|number} altitude
     */
    getHeightFromTerrain = async ({coordinates, precision = HIGH_TERRAIN_PRECISION, level = 11}) => {
        return await this.utils.getHeightFromTerrain({
                                                         coordinates: coordinates,
                                                         precision:   precision,
                                                         level:       level,
                                                     })
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
    degreesToPixelsCoordinates = async (point, clampToGround = true) => {
        return await this.utils.degreesToPixelsCoordinates(point, clampToGround)
    }
}