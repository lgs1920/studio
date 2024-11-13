import { Cartesian3, Math as M } from 'cesium'
import { snapshot }              from 'valtio'
import { deepClone }             from 'valtio/utils'

import { CameraUtils }    from '../../Utils/cesium/CameraUtils.js'
import { JOURNEYS_STORE } from '../constants'
import { Journey }        from '../Journey'

export class CameraManager {
    static CLOCKWISE = true
    static ORBITAL = 'orbital'
    static NORMAL = 'normal'

    target = {}
    position = {}
    orbitalInPause = false

    constructor(settings) {

        // Singleton
        if (CameraManager.instance) {
            return CameraManager.instance
        }

        this.settings = settings

        this.clockwise = CameraManager.CLOCKWISE
        this.store = lgs.mainProxy.components.camera
        this.move = {type: null, releaseEvent: null}

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
     * We stop tracking the camera's orbital movements
     *
     * @return {Promise<void>}
     */
    stopOrbital = async () => {
        if (this.move.type === CameraManager.ORBITAL) {
            lgs.viewer.clock.canAnimate = false
            lgs.viewer.clock.shouldAnimate = false
            this.move.releaseEvent()
            CameraUtils.unlock(lgs.camera)
            this.move.type = undefined
        }
    }

    /**
     * Pause orbital movements
     *
     */
    pauseOrbital = () => {
        this.orbitalInPause = true
    }

    /**
     * relaunch Orbital movements after a pause
     *
     */
    relaunchOrbital = () => {
        this.orbitalInPause = false
    }

    targetInPixels = () => {
        const pixels = CameraUtils.getTargetPositionInPixels(this.target)
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

    raiseUpdateEvent = () => {
        this.updatePositionInformation()
    }

    runOrbital = async ({target = lgs.configuration.starter, divider = 360}) => {

        // Bail early if there is a rotation already in action
        if (this.move.type === CameraManager.ORBITAL) {
            return
        }

        // Stop any camera position tracking
        if (this.move.type !== null) {
            this.move.releaseEvent()
        }

        if (target) {
            this.settings = {
                target:   {
                    longitude: target.longitude,
                    latitude:  target.latitude,
                    height:    target.height,
                },
                position: {
                    heading: target.camera.heading,
                    pitch:   target.camera.pitch,
                    roll:    target.camera.roll,
                    range:   target.camera.range,
                },
            }
        }
        else {
            if (!this.target) {
                return // Bail early if no target at all
            }
            this.settings = {
                target: {
                    longitude: this.target.longitude,
                    latitude:  this.target.latitude,
                    height:    this.target.height,
                },
            }
        }

        // TODO hpr as parameter
        //const hpr = new HeadingPitchRange(M.toRadians(this.position.heading), M.toRadians(this.position.pitch), M.toRadians(this.position.range))

        // Set move event
        lgs.camera.percentageChanged = lgs.settings.getCamera.orbitalPercentageChanged

        // Look at target
        CameraUtils.lookAt(lgs.camera, Cartesian3.fromDegrees(target.longitude, target.latitude, target.height))

        // Run orbital moves
        const step = (lgs.camera.clockwise) ? M.PI / divider : -M.PI / divider

        this.move = {
            type:         CameraManager.ORBITAL,
            releaseEvent: lgs.viewer.clock.onTick.addEventListener(() => {
                try {
                    if (!this.orbitalInPause) {
                        lgs.camera.rotateLeft(step)
                    }
                }
                catch (error) {
                    console.error(error)
                }

            }),
        }

    }

    runNormal = () => {
        // Bail early if such tracking is already in action
        if (this.move.type === CameraManager.NORMAL) {
            return
        }

        // Stop any camera position tracking
        if (this.move.type !== null) {
            this.move.releaseEvent()
        }

        // In case we miss something, unlock the target
        CameraUtils.unlock(lgs.camera)

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
        const data = await CameraUtils.updatePositionInformation()
        // Update Camera Manager information
        if (data) {
            this.settings = data
        }
        else {
            this.reset()
        }
        // Update camera proxy
        this.proxy()

        // Update Journey Camera if needed
        if (lgs.theJourney) {
            lgs.theJourney.camera = snapshot(lgs.mainProxy.components.camera)
        }
        return this
    }

    proxy = () => {
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
                longitude: lgs.settings.getStarter.longitude,
                latitude:  lgs.settings.getStarter.latitude,
                height:    lgs.settings.getStarter.height,
            },

            position: {
                longitude: undefined,
                latitude:  undefined,
                height:    undefined,
                heading: lgs.settings.getCamera.heading,
                pitch:   lgs.settings.getCamera.pitch,
                roll:    lgs.settings.getCamera.roll,
                range:   lgs.settings.getCamera.range,
            },
        }
    }


}

