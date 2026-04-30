/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CameraManager.js
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

import { CURRENT_CAMERA, CURRENT_STORE, FOCUS_STARTER, JOURNEYS_STORE, MILLIS, MINUTE } from '@Core/constants'

import { normalizeOrbitDirection, normalizeOrbitRPM } from '@Core/OrbitSettings'
import { CameraUtils }                                from '@Utils/cesium/CameraUtils.js'
import { UIToast }                                    from '@Utils/UIToast'
import { snapshot }                                   from 'valtio'
import { deepClone }                                  from 'valtio/utils'
import { Journey }                                    from '../Journey'

export class CameraManager {
    static CLOCKWISE = true
    static NORMAL = 'normal'
    static ROTATE = 'rotate'

    target = {}
    position = {}
    orbitalInPause = false
    saveTimer = null
    renderQuality = {
        locks:           0,
        msaaSamples:     null,
        resolutionScale: null,
        shadows:         null,
    }

    constructor(settings) {

        // Singleton
        if (CameraManager.instance) {
            return CameraManager.instance
        }
        this.proxy = CameraUtils
        ;(async () => await this.readCameraInformation())()
        this.settings = settings

        this.clockwise = CameraManager.CLOCKWISE
        this.store = lgs.stores.main.components.camera
        this.move = {type: null, stopWatching: null, animation: null}


        // we track window resizing to get
        // target coordinates in pixels
        window.addEventListener('resize', () => {
            this.targetInPixels()
            this.raiseUpdateEvent()
        })

        // Let's save the information before new window content
        window.addEventListener('beforeunload', () => this.saveInformation(Date.now()))

        CameraManager.instance = this

    }

    set settings(settings) {
        this.target.longitude = settings?.target?.longitude //?? lgs.settings.getStarter.longitude
        this.target.latitude = settings?.target?.latitude //?? lgs.settings.getStarter.latitude
        this.target.height = settings?.target?.height //?? lgs.settings.getStarter.height;
        this.targetInPixels()


        this.position.longitude = settings?.position?.longitude ?? lgs.settings.camera.longitude
        this.position.latitude = settings?.position?.latitude ?? lgs.settings.camera.latitude
        this.position.height = settings?.position?.height ?? lgs.settings.camera.height

        this.position.heading = settings?.position?.heading ?? lgs.settings.camera.heading
        this.position.pitch = settings?.position?.pitch ?? lgs.settings.camera.pitch
        this.position.roll = settings?.position?.roll ?? lgs.settings.camera.roll
        this.position.range = settings?.position?.range ?? lgs.settings.camera.range
    }

    get settings() {
        return {
            position: this.position,
            target:   this.target,
        }
    }

    targetInPixels = () => {
        const pixels = this.proxy.getTargetPositionInPixels(this.target)
        this.target.x = pixels?.x
        this.target.y = pixels?.y
    }

    /**
     *
     * @param target
     * @return {boolean}
     */
    lookingAtTheSky = (target = this.target) => {
        return (target.longitude === undefined)
            && (target.latitude === undefined)
            && (target.height === undefined)
    }

    /**
     * Let's update ad save information
     *
     * @return {Promise<void>}
     */
    raiseUpdateEvent = async (options = {}) => {
        await this.updatePositionInformation(options)
    }

    stopWatching = () => {
        if (this.move.stopWatching) {
            this.move.stopWatching()
            this.move.stopWatching = null
            clearInterval(this.saveTimer)
            this.saveTimer = null
        }
    }

    getCurrentUpdateOptions = () => {
        if (lgs.stores.ui.mainUI.rotate.running && lgs.stores.ui.mainUI.rotate.target) {
            return {
                skipTargetPick: true,
                target:         lgs.stores.ui.mainUI.rotate.target,
            }
        }

        if (lgs.stores.ui.mainUI.panorama.active && lgs.stores.ui.mainUI.panorama.target) {
            return {
                skipTargetPick: true,
                target:         lgs.stores.ui.mainUI.panorama.target,
            }
        }

        return {}
    }

    syncPositionInformation = (options = this.getCurrentUpdateOptions()) => {
        const data = this.proxy.updatePositionInformationSync?.(null, options)
        if (!data) {
            return null
        }

        this.settings = data
        this.clone()

        if (lgs.theJourney) {
            lgs.theJourney.camera = snapshot(this.store)
        }

        return data
    }

    /**
     * Save camera information
     *
     * @param last is the reference time (ie the last known)
     *
     */
    saveInformation = (last, {sync = true} = {}) => {
        if (sync) {
            this.syncPositionInformation()
        }

        if (Date.now() - last >= lgs.configuration.db.IDBDelay * MILLIS) {
            clearInterval(this.saveTimer)
            this.saveTimer = null
        }
        const currentCamera = snapshot(this.store)
        if (lgs.theJourney) {
            lgs.theJourney.camera = currentCamera
            lgs.db.lgs1920.put(lgs.theJourney.slug, Journey.unproxify(snapshot(lgs.theJourney)), JOURNEYS_STORE)
        }
        lgs.db.lgs1920.put(CURRENT_CAMERA, currentCamera, CURRENT_STORE)
    }

    /**
     * Start watching camera information in order to save it.
     *
     * @return {Promise<void>}
     */
    startWatching = async () => {
        if (this.saveTimer) {
            return
        }
        const date = Date.now()
        this.saveInformation(date)
        this.saveTimer = setInterval(
            this.saveInformation.bind(this), lgs.configuration.db.IDBDelay * MILLIS, date,
        )
    }


    /**
     * Read Camera information in local database
     *
     * @return {Promise<*|null>}
     */
    readCameraInformation = async ({fallback = true} = {}) => {
        let data = await lgs.db.lgs1920.get(CURRENT_CAMERA, CURRENT_STORE)
        if (!data || __.app.isEmpty(data.target)) {
            return fallback ? this.focusToStarterPOI() : null
        }
        return data
    }


    /**
     * This is the normal mode, ie the user can drag the map as he wants to.
     *
     */
    enableMapDragging = () => {
        if (this.move.type === CameraManager.NORMAL && this.move.stopWatching) {
            return
        }

        // Stop any camera position tracking
        this.stopWatching()

        // Set move event
        lgs.camera.percentageChanged = lgs.settings.camera.percentageChanged

        this.move = {
            type:         CameraManager.NORMAL,
            stopWatching: lgs.camera.changed.addEventListener(async () => {
                if (!this.saveTimer) {
                    await this.startWatching()
                }
            }),
        }
    }

    /**
     * Update and maintain camera position
     *
     * @return {Promise<void>}
     */
    updatePositionInformation = async (options = {}) => {
        const data = await this.proxy.updatePositionInformation(null, options)
        // Update Camera Manager information
        if (data) {
            this.settings = data
        }
        else {
            this.resetCameraInformation()
        }
        // Update camera proxy
        this.clone()

        // Update Journey Camera if needed
        if (lgs.theJourney) {
            lgs.theJourney.camera = snapshot(lgs.stores.main.components.camera)
        }
    }

    /**
     * Clone the position
     */
    clone = () => {
        lgs.stores.main.components.camera.position = deepClone(this.position)
        lgs.stores.main.components.camera.target = deepClone(this.target)
    }

    optimizeContinuousCameraRender = () => {
        if (!lgs.viewer) {
            return
        }

        const scene = lgs.scene ?? lgs.viewer.scene
        this.renderQuality.locks += 1
        if (this.renderQuality.locks !== 1) {
            return
        }

        this.renderQuality.resolutionScale = lgs.viewer.resolutionScale
        if (lgs.viewer.resolutionScale > 1) {
            lgs.viewer.resolutionScale = 1
        }

        this.renderQuality.msaaSamples = scene?.msaaSamples ?? null
        if (scene?.msaaSamples > 1) {
            scene.msaaSamples = 1
        }

        this.renderQuality.shadows = scene?.shadows ?? null
        if (scene?.shadows) {
            scene.shadows = false
        }
    }

    restoreContinuousCameraRender = () => {
        if (!lgs.viewer || this.renderQuality.locks === 0) {
            return
        }

        const scene = lgs.scene ?? lgs.viewer.scene
        this.renderQuality.locks -= 1
        if (this.renderQuality.locks > 0) {
            return
        }

        let shouldRequestRender = false
        if (this.renderQuality.resolutionScale !== null) {
            lgs.viewer.resolutionScale = this.renderQuality.resolutionScale
            this.renderQuality.resolutionScale = null
            shouldRequestRender = true
        }
        if (scene && this.renderQuality.msaaSamples !== null) {
            scene.msaaSamples = this.renderQuality.msaaSamples
            this.renderQuality.msaaSamples = null
            shouldRequestRender = true
        }
        if (scene && this.renderQuality.shadows !== null) {
            scene.shadows = this.renderQuality.shadows
            this.renderQuality.shadows = null
            shouldRequestRender = true
        }
        if (shouldRequestRender) {
            scene?.requestRender?.()
        }
    }


    /**
     * Get the data of the camera instance
     */
    get = () => {
        return this
    }

    /**
     * Reset the camera settings management.
     *
     *
     */
    resetCameraInformation = () => {
        this.settings = this.focusToStarterPOI()
    }

    /**
     * Reset the camera information to target
     *
     * @return the camera position nd settings
     */
    focusToStarterPOI = () => {
        return {
            target: {
                longitude: lgs.settings.starter.longitude,
                latitude:  lgs.settings.starter.latitude,
                height:    lgs.settings.starter.height,
            },

            position: {
                longitude: undefined,
                latitude:  undefined,
                height:    undefined,
                heading:   lgs.settings.camera.heading,
                pitch:     lgs.settings.camera.pitch,
                roll:      lgs.settings.camera.roll,
                range:     lgs.settings.camera.range,
            },
        }
    }

    /**
     * Look at a specific point
     *
     * @param point target : data in degrees, meters
     *
     * point is in the form: {
     *      latitude,longitude,height,
     *      camera:{heading,pitch,roll,range}
     *      }
     */
    lookAt = (point) => {
        this.proxy.lookAt(lgs.camera, point, point.camera)
    }

    /**
     * Rotate around a specific point
     *
     *
     * @param point
     * @param options
     * @return {Promise<void>}
     */
    rotateAround = async (point = null, options) => {

        // Let's stop any rotation
        await this.stopRotate()

        // And any related event
        this.stopWatching()

        __.ui.sceneManager.startRotate
        this.optimizeContinuousCameraRender()

        if (point === null) {
            //take current settings from proxy
            const settings = snapshot(this.store)
            point = {
                ...settings.target,
                camera: settings.position,
            }
        }

        // Update target and camera position
        this.settings = {
            target:   {
                longitude: point.longitude,
                latitude:  point.latitude,
                height:          point.height,
                simulatedHeight: point.simulatedHeight ?? point.height,
            },
            position: {
                heading: point.camera.heading,
                pitch:   point.camera.pitch,
                roll:    point.camera.roll,
                range:   point.camera.range,
            },
        }

        // Set some configuration parameters
        const $rotate = lgs.stores.ui.mainUI.rotate
        $rotate.rpm = normalizeOrbitRPM(options?.rpm ?? $rotate.rpm)
        $rotate.direction = normalizeOrbitDirection(options?.direction ?? $rotate.direction)

        const infinite = options?.infinite ?? true
        const rotations = options?.rotations ?? lgs.settings.camera.rotations
        const lookAt = options?.lookAt ?? true

        // Do we need a camera pre-positioning ?
        if (lookAt) {
            this.lookAt(point)
            lgs.scene?.requestRender?.()
        }
        // Setting spinner speed
        __.ui.css.setCSSVariable('--map-rotation-speed', `${60 / Math.max($rotate.rpm * Math.abs($rotate.direction), 0.2)}s`)

        let totalRotation = 0
        const totalTurns = rotations * 2 * Math.PI
        lgs.camera.percentageChanged = lgs.settings.camera.percentageChanged
        lgs.camera.orbitalPercentageChanged = lgs.settings.camera.orbitalPercentageChanged

        let lastFrameTime = null

        const rotateCamera = () => {
            if (this.isRotating()) {
                const currentTime = performance.now()
                if (lastFrameTime === null) {
                    lastFrameTime = currentTime
                }

                const elapsedSeconds = (currentTime - lastFrameTime) / MILLIS
                lastFrameTime = currentTime
                const rpm = normalizeOrbitRPM($rotate.rpm)
                const direction = normalizeOrbitDirection($rotate.direction)
                const effectiveRpm = rpm * Math.abs(direction)
                const angleRotation = 2 * Math.PI / (MINUTE / MILLIS) * effectiveRpm * elapsedSeconds

                if (lgs.camera && infinite || totalRotation < totalTurns) {
                    if (effectiveRpm > 0) {
                        if (direction >= 0) {
                            lgs.camera.rotateRight(angleRotation)
                        }
                        else {
                            lgs.camera.rotateLeft(angleRotation)
                        }
                        totalRotation += Math.abs(angleRotation)
                        __.ui.css.setCSSVariable('--map-rotation-speed', `${60 / Math.max(effectiveRpm, 0.2)}s`)
                    }
                    this.move.animation = __.requestAnimationFrame(rotateCamera)
                }
                else {
                    this.stopRotate()
                    totalRotation = totalTurns
                }
            }
        }
        this.move = {
            type:         CameraManager.ROTATE,
            animation: __.requestAnimationFrame(rotateCamera),
            stopWatching: null,
        }
    }

    /**
     * Stop rotate mode
     *
     * @return {Promise<void>}
     */
    stopRotate = async () => {
        if (this.isRotating()) {
            const target = lgs.stores.ui.mainUI.rotate.target
            __.cancelAnimationFrame(this.move.animation)
            this.move.animation = null
            this.stopWatching()
            this.unlock()
            __.ui.sceneManager.stopRotate
            this.restoreContinuousCameraRender()
            await this.updatePositionInformation(target ? {
                skipTargetPick: true,
                target,
            } : undefined)
            this.saveInformation(Date.now(), {sync: false})
            this.enableMapDragging()
            lgs.scene?.requestRender?.()
        }
    }

    /**
     * Check if rotate mode is on
     *
     * @return {boolean}
     */
    isRotating = (target) => {
        if (target) {
            return lgs.stores.ui.mainUI.rotate.running
                // type and slug are not defined in geocoding
                && lgs.stores.ui.mainUI.rotate.target?.element === target.element
                && lgs.stores.ui.mainUI.rotate.target?.slug === target.slug
        }
        else {
            return lgs.stores.ui.mainUI.rotate.running
        }


    }
    /**
     * Reset focus to STARTER
     */
    reset = () => {
        lgs.settings.ui.camera.start.app = FOCUS_STARTER
    }

    /**
     * Check app focus
     */
    isAppFocusOn = (type) => lgs.settings.ui.camera.start.app === type

    /**
     * Check journey focus
     */
    isJourneyFocusOn = (type) => lgs.settings.ui.camera.start.journey === type

    /**
     * Unlock the camera
     */
    unlock = () => {
        this.proxy.unlock(lgs.camera)
    }

    panoramic = () => {
        UIToast.warning({
                            caption: `Panoramic is not yet available`,
                            text:    'Please use another feature!',
                        })
    }
    stopPanoramic = () => {

    }

}
