/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SceneManager.js
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
    HIGH_TERRAIN_PRECISION, SCENE_MODE_2D, SCENE_MODE_3D, SCENE_MODE_COLUMBUS, SCENE_MODES, TERRAIN_ENTITY,
}                                  from '@Core/constants'
import { MapTarget }               from '@Core/MapTarget'
import { SceneUtils }              from '@Utils/cesium/SceneUtils'
import { Mobility }                from '@Utils/Mobility'
import { UIToast }                 from '@Utils/UIToast'
import { getGlobalHideOtherJourneys, refreshJourneyVisibility } from '@Core/ui/JourneyVisibility'
import { LayersAndTerrainManager } from './LayerAndTerrainManager'

const finiteNumber = value => {
    if (value === null || value === undefined || value === '') {
        return null
    }

    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const hasMapCoordinates = target => finiteNumber(target?.longitude) !== null
    && finiteNumber(target?.latitude) !== null

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
        if (Number(mode) === Number(SCENE_MODE_2D.value) && lgs.stores.ui.mainUI.panorama.active) {
            void __.ui.poiManager?.stopRotationAndSync?.()
        }

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
        const terrain = manager.getEntityProxyByType(lgs.settings.layers.terrain, TERRAIN_ENTITY)
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

        // Now it's time for the show. Draw all journeys with the current global visibility policy.
        await refreshJourneyVisibility({
            hideOtherJourneys: getGlobalHideOtherJourneys(),
        })
        this.notifyMorph()
    }

    get startRotate() {
        lgs.stores.ui.mainUI.rotate.running = true
        lgs.stores.ui.mainUI.rotate.visible = true
        return lgs.stores.ui.mainUI.rotate.running
    }

    get stopRotate() {
        lgs.stores.ui.mainUI.rotate.running = false
        return lgs.stores.ui.mainUI.rotate.running
    }

    focusPostProcessing = () => {
        // console.log(point, options)
    }

    //
    focusPreProcessing = (point, options) => {
        if (options?.rotate) {
            lgs.stores.ui.mainUI.rotate.visible = true
        }

        if (options?.rotate && !__.ui.cameraManager?.isRotating?.() && !__.ui.cameraManager?.isFlying?.()) {
            __.ui.cameraManager?.syncPositionInformation?.()
        }
        const cameraTarget = __.ui.cameraManager?.target
        const rotateTarget = lgs.stores.ui.mainUI.rotate.target
        const from = hasMapCoordinates(cameraTarget)
                     ? cameraTarget
                     : hasMapCoordinates(rotateTarget) ? rotateTarget : null
        const rotateTargetId = rotateTarget?.slug ?? rotateTarget?.id
        const pointId = point?.slug ?? point?.id
        const sameRotateTarget = Boolean(
            point?.element
            && rotateTarget?.element === point.element
            && pointId
            && rotateTargetId === pointId,
        )
        if (options?.target?.element && hasMapCoordinates(options.target)) {
            lgs.stores.ui.mainUI.rotate.target = options.target
        }
        else if (point instanceof MapTarget) {
            lgs.stores.ui.mainUI.rotate.target = point
        }
        else {
            lgs.stores.ui.mainUI.rotate.target = new MapTarget(point.element, point)
        }
        const distance = from && hasMapCoordinates(point) ? Mobility.distance(from, point) : 0
        return {
            distance:         distance,
            height:           Math.max(from?.height ?? 0, point?.height ?? 0),
            sameRotateTarget: sameRotateTarget,
        }
    }

    getJourneyCentroid = async journey => await this.utils.getJourneyCentroid(journey)

    focus = (point, options = {}) => {
        this.#focusTarget = options.target ?? null

        return this.utils.focus(point, {
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
    getHeightFromTerrain = async (args = {}) => {
        const normalizedArgs = (args && typeof args === 'object' && 'coordinates' in args)
                               ? args
                               : {coordinates: args}

        return this.utils.getHeightFromTerrain({
                                                   coordinates: normalizedArgs.coordinates,
                                                   precision:   normalizedArgs.precision ?? HIGH_TERRAIN_PRECISION,
                                                   level:       normalizedArgs.level ?? 11,
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
