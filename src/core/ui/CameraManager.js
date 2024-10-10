import { Cartesian3, Math as M } from 'cesium'
import { snapshot }              from 'valtio'
import { deepClone }             from 'valtio/utils'

import { CameraUtils }    from '../../Utils/cesium/CameraUtils.js'
import { Journey }        from '../Journey'
import { JOURNEYS_STORE } from '../LGS1920Context'

export class CameraManager {
    static CLOCKWISE = true
    static ORBITAL = 'orbital'
    static NORMAL = 'normal'

    target = {}
    position = {}

    constructor(settings) {

        // Singleton
        if (CameraManager.instance) {
            return CameraManager.instance
        }

        this.settings = settings

        this.clockwise = CameraManager.CLOCKWISE
        this.store = lgs.mainProxy.components.camera
        this.move = {type: null, releaseEvent: null}


        CameraManager.instance = this

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
            this.move.releaseEvent()
            CameraUtils.unlock(lgs.camera)
            this.move.type = undefined
        }
    }

    set settings(settings) {
        this.target.longitude = settings?.position?.target?.longitude ?? lgs.configuration.starter.longitude
        this.target.latitude = settings?.position?.target?.latitude ?? lgs.configuration.starter.latitude
        this.target.height = settings?.position?.target?.height ?? lgs.configuration.starter.height

        this.position.longitude = settings?.position?.longitude ?? lgs.configuration.camera.longitude
        this.position.latitude = settings?.position?.latitude ?? lgs.configuration.camera.latitude
        this.position.height = settings?.position?.height ?? lgs.configuration.camera.height

        this.position.heading = settings?.position?.heading ?? lgs.configuration.camera.heading
        this.position.pitch = settings?.position?.pitch ?? lgs.configuration.camera.pitch
        this.position.roll = settings?.position?.roll ?? lgs.configuration.camera.roll
        this.position.range = settings?.position?.range ?? lgs.configuration.camera.range

    }

    raiseUpdateEvent = () => {
        this.updatePositionInformation()
    }

    runOrbital = async ({target = lgs.configuration.starter, divider = 800}) => {

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
        lgs.camera.percentageChanged = lgs.configuration.camera.orbitalPercentageChanged

        // Look at target
        CameraUtils.lookAt(lgs.camera, Cartesian3.fromDegrees(target.longitude, target.latitude, target.height))

        // Run orbital moves
        const step = (lgs.camera.clockwise) ? M.PI / divider : -M.PI / divider
        this.move = {
            type:         CameraManager.ORBITAL,
            releaseEvent: lgs.viewer.clock.onTick.addEventListener(() => {
                lgs.camera.rotateLeft(step)
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
        lgs.camera.percentageChanged = lgs.configuration.camera.percentageChanged

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
        console.log(this.position.longitude, lgs.mainProxy.components.camera.position.longitude)
        lgs.mainProxy.components.camera.target = this.target
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
                longitude: lgs.configuration.starter.longitude,
                latitude:  lgs.configuration.starter.latitude,
                height:    lgs.configuration.starter.height,
            },

            position: {
                longitude: undefined,
                latitude:  undefined,
                height:    undefined,
                heading:   lgs.configuration.camera.heading,
                pitch:     lgs.configuration.camera.pitch,
                roll:      lgs.configuration.camera.roll,
                range:     lgs.configuration.camera.range,
            },
        }
    }


}

