import { JOURNEYS_STORE, MILLIS, MINUTE } from '@Core/constants'

import { CameraUtils } from '@Utils/cesium/CameraUtils.js'
import { snapshot }    from 'valtio'
import { deepClone }   from 'valtio/utils'
import { Journey }     from '../Journey'

export class CameraManager {
    static CLOCKWISE = true

    target = {}
    position = {}
    orbitalInPause = false

    constructor(settings) {

        // Singleton
        if (CameraManager.instance) {
            return CameraManager.instance
        }
        this.proxy = CameraUtils
        this.settings = settings

        this.clockwise = CameraManager.CLOCKWISE
        this.store = lgs.mainProxy.components.camera
        this.move = {type: null, releaseEvent: null, animation: null}


        // we track window resizing to get
        // target coordinates in pixels
        window.addEventListener('resize', () => {
            this.targetInPixels()
            this.raiseUpdateEvent()
        })

        CameraManager.instance = this

    }

    set settings(settings) {
        this.target.longitude = settings?.target?.longitude //?? lgs.settings.getStarter.longitude
        this.target.latitude = settings?.target?.latitude //?? lgs.settings.getStarter.latitude
        this.target.height = settings?.target?.height //?? lgs.settings.getStarter.height;
        this.targetInPixels()


        this.position.longitude = settings?.position?.longitude ?? lgs.settings.getCamera.longitude
        this.position.latitude = settings?.position?.latitude ?? lgs.settings.getCamera.latitude
        this.position.height = settings?.position?.height ?? lgs.settings.getCamera.height

        this.position.heading = settings?.position?.heading ?? lgs.settings.getCamera.heading
        this.position.pitch = settings?.position?.pitch ?? lgs.settings.getCamera.pitch
        this.position.roll = settings?.position?.roll ?? lgs.settings.getCamera.roll
        this.position.range = settings?.position?.range ?? lgs.settings.getCamera.range
    }

    get settings() {
        return {
            position: this.position,
            target:   this.target,
        }
    }

    /**
     * Pause orbital movements
     *
     */
    pauseOrbital = () => {
        this.orbitalInPause = true
        __.ui.sceneManager.stopRotate
    }

    /**
     * relaunch Orbital movements after a pause
     *
     */
    relaunchOrbital = () => {
        this.orbitalInPause = false
        __.ui.sceneManager.startRotate
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

    raiseUpdateEvent = async () => {
        await this.updatePositionInformation()
    }

    releaseEvent = () => {
        if (this.move.releaseEvent) {
            this.move.releaseEvent()
        }
    }


    runNormal = () => {
        // Bail early if such tracking is already in action
        if (!this.isRotating()) {
            return
        }

        // Stop any camera position tracking
        this.releaseEvent()


        // In case we miss something, unlock the target
        this.proxy.unlock(lgs.camera)

        // Set move event
        lgs.camera.percentageChanged = lgs.settings.getCamera.percentageChanged

        // Run it
        let lastMouseMoveTime = 0
        let saveInterval
        const saveDelay = lgs.configuration.db.IDBDelay

        // If the camera is in movement, we save the journey in DB every <saveDelay> ms
        // We save the last movement <saveDelay> ms after the last camera change

        const saveData = async () => {
            const currentTime = Date.now()
            if (currentTime - lastMouseMoveTime >= saveDelay) {
                clearInterval(saveInterval)
                saveInterval = null
            }
            lgs.theJourney.camera = snapshot(this.store)
            await lgs.db.lgs1920.put(lgs.theJourney.slug, Journey.unproxify(snapshot(lgs.theJourney)), JOURNEYS_STORE)
        }

        this.move = {
            type:         CameraManager.NORMAL,
            releaseEvent: lgs.camera.changed.addEventListener(async () => {
                if (lgs.theJourney) {
                    lastMouseMoveTime = Date.now()
                    if (!saveInterval) {
                        saveInterval = setInterval(saveData, saveDelay)
                    }
                }
            }),
        }
    }

    updatePositionInformation = async () => {
        const data = await this.proxy.updatePositionInformation()
        // Update Camera Manager information
        if (data) {
            this.settings = data
        }
        else {
            console.log('reset')
            this.reset()
        }
        // Update camera proxy
        this.clone()

        // Update Journey Camera if needed
        if (lgs.theJourney) {
            lgs.theJourney.camera = snapshot(lgs.mainProxy.components.camera)
        }
    }

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

    reset = () => {
        this.settings = {
            target: {
                longitude: lgs.settings.starter.longitude,
                latitude:  lgs.settings.starter.latitude,
                height:    lgs.settings.starter.height,
            },

            position: {
                longitude: undefined,
                latitude:  undefined,
                height:    undefined,
                heading: lgs.settings.camera.heading,
                pitch:   lgs.settings.camera.pitch,
                roll:    lgs.settings.camera.roll,
                range:   lgs.settings.camera.range,
            },
        }
    }

    /**
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

    rotateAround = async (point = null, options) => {

        // Let's stop any rotation
        this.stopRotate()

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
                height: point.height ?? point.simulatedHeight,
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
                if (infinite || totalRotation < totalTurns) {
                    lgs.camera.rotateRight(angleRotation)
                    totalRotation += Math.abs(angleRotation)
                    this.move.animation = requestAnimationFrame((time) => rotateCamera(time))
                    await this.updatePositionInformation()
                }
                else {
                    this.stopRotate()
                    totalRotation = totalTurns
                }
            }
        }
        this.move.animation = requestAnimationFrame((time) => rotateCamera(time))
    }

    stopRotate = async () => {
        if (this.isRotating()) {
            this.proxy.unlock(lgs.camera)
            __.ui.sceneManager.stopRotate
            cancelAnimationFrame(this.move.animation)
            await this.updatePositionInformation()

            lgs.viewer.clock.canAnimate = false
            lgs.viewer.clock.shouldAnimate = false
            this.releaseEvent()

        }
    }

    isRotating = () => {
        return lgs.mainProxy.components.mainUI.rotate.running
    }

}

