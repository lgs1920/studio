/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CameraManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-30
 * Last modified: 2025-06-30
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { CURRENT_CAMERA, CURRENT_STORE, FOCUS_STARTER, JOURNEYS_STORE, MILLIS, MINUTE } from '@Core/constants'

import { CameraUtils } from '@Utils/cesium/CameraUtils.js'
import { UIToast }     from '@Utils/UIToast'
import { snapshot }    from 'valtio'
import { deepClone }   from 'valtio/utils'
import { Journey }     from '../Journey'

export class CameraManager {
    static CLOCKWISE = true
    static NORMAL = 'normal'
    static ROTATE = 'rotate'

    target = {}
    position = {}
    orbitalInPause = false
    saveTimer = null

    constructor(settings) {

        // Singleton
        if (CameraManager.instance) {
            return CameraManager.instance
        }
        this.proxy = CameraUtils
        ;(async () => await this.readCameraInformation())()
        this.settings = settings

        this.clockwise = CameraManager.CLOCKWISE
        this.store = lgs.mainProxy.components.camera
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
    raiseUpdateEvent = async () => {
        await this.updatePositionInformation()
    }

    stopWatching = () => {
        if (this.move.stopWatching) {
            this.move.stopWatching()
            clearInterval(this.saveTimer)
            this.saveTimer = null
        }
    }

    /**
     * Save camera information
     *
     * @param last is the reference time (ie the last known)
     *
     */
    saveInformation = (last) => {
        if (Date.now() - last >= lgs.configuration.db.IDBDelay * MILLIS) {
            clearInterval(this.saveTimer)
            this.saveTimer = null
        }
        if (lgs.theJourney) {
            lgs.theJourney.camera = snapshot(this.store)
            lgs.db.lgs1920.put(lgs.theJourney.slug, Journey.unproxify(snapshot(lgs.theJourney)), JOURNEYS_STORE)
        }
        lgs.db.lgs1920.put(CURRENT_CAMERA, snapshot(this.store), CURRENT_STORE)
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
    readCameraInformation = async () => {
        let data = await lgs.db.lgs1920.get(CURRENT_CAMERA, CURRENT_STORE)
        if (!data || __.app.isEmpty(data.target)) {
            return this.focusToStarterPOI()
        }
        return data
    }


    /**
     * This is the normal mode, ie the user can drag the map as he wants to.
     *
     */
    enableMapDragging = () => {
        // Bail early if such tracking is already in action
        if (!this.isRotating()) {
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
    updatePositionInformation = async () => {
        const data = await this.proxy.updatePositionInformation()
        // Update Camera Manager information
        if (data) {
            this.settings = data
        }
        else {
            this.reset()
        }
        // Update camera proxy
        this.clone()

        // Update Journey Camera if needed
        if (lgs.theJourney) {
            lgs.theJourney.camera = snapshot(lgs.mainProxy.components.camera)
        }
    }

    /**
     * Clone the position
     */
    clone = () => {
        lgs.mainProxy.components.camera.position = deepClone(this.position)
        lgs.mainProxy.components.camera.target = deepClone(this.target)
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
    reset = () => {
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
        this.stopRotate()

        // And any related event
        this.stopWatching()

        __.ui.sceneManager.startRotate

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
        const rpm = (options?.rpm ?? lgs.settings.camera.rpm)

        const fps = lgs.settings.camera.fps
        const infinite = options?.infinite ?? true
        const rotations = options?.rotations ?? lgs.settings.camera.rotations
        const lookAt = options?.lookAt ?? true

        // Do we need a camera pre-positioning ?
        if (lookAt) {
            this.lookAt(point)
        }
        // Setting spinner speed
        __.ui.css.setCSSVariable('--map-rotation-speed', `${60 / rpm}s`)


        const angleRotation = 2 * Math.PI / (MINUTE / MILLIS * fps) * rpm
        let totalRotation = 0
        const totalTurns = rotations * 2 * Math.PI
        lgs.camera.percentageChanged = lgs.settings.camera.percentageChanged
        lgs.camera.orbitalPercentageChanged = lgs.settings.camera.orbitalPercentageChanged


        const rotateCamera = async (startTime, currentTime) => {
            if (this.isRotating()) {
                if (lgs.camera && infinite || totalRotation < totalTurns) {
                    lgs.camera.rotateRight(angleRotation)
                    totalRotation += Math.abs(angleRotation)
                    this.move.animation = requestAnimationFrame((time) => rotateCamera(time))
                }
                else {
                    this.stopRotate()
                    totalRotation = totalTurns
                }
            }
        }
        this.move = {
            type:         CameraManager.ROTATE,
            animation:    requestAnimationFrame((time) => rotateCamera(time)),
            stopWatching: lgs.camera.changed.addEventListener(async () => {
                if (!this.saveTimer) {
                    await this.startWatching()
                }
            }),
        }
    }

    /**
     * Stop rotate mode
     *
     * @return {Promise<void>}
     */
    stopRotate = async () => {
        if (this.isRotating()) {
            this.unlock()
            __.ui.sceneManager.stopRotate
            cancelAnimationFrame(this.move.animation)
            this.enableMapDragging()

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

