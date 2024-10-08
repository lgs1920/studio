import { Cartesian3, Math as M } from 'cesium'
import { snapshot }              from 'valtio'
import { CameraUtils }           from '../../Utils/cesium/CameraUtils.js'

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

        this.target.longitude = settings?.target?.longitude ?? lgs.configuration.starter.longitude
        this.target.latitude = settings?.target?.latitude ?? lgs.configuration.starter.latitude
        this.target.height = settings?.target?.height ?? lgs.configuration.starter.height

        this.position.longitude = undefined
        this.position.latitude = undefined
        this.position.height = undefined

        this.position.heading = settings?.heading ?? lgs.configuration.camera.heading
        this.position.pitch = settings?.pitch ?? lgs.configuration.camera.pitch
        this.position.roll = settings?.roll ?? lgs.configuration.camera.roll
        this.position.range = settings?.range ?? lgs.configuration.camera.range
        this.clockwise = CameraManager.CLOCKWISE

        this.store = snapshot(lgs.mainProxy.components.camera)

        this.move = {type: null, releaseEvent: null}

        CameraManager.instance = this

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
            this.target = {
                longitude: target.longitude,
                latitude:  target.latitude,
                height:    target.height,
            }

            this.position.heading = target.camera.heading
            this.position.pitch = target.camera.pitch
            this.position.roll = target.camera.roll
            this.position.range = target.camera.range
        }
        else {
            if (!this.target) {
                return // Bail early if no target at all
            }
            target = {
                longitude: this.target.longitude,
                latitude:  this.target.latitude,
                height:    this.target.height,
                camera:    {
                    heading: M.toRadians(this.position.heading),
                    pitch:   M.toRadians(this.position.pitch),
                    range:   this.position.range,
                },
            }
        }

        // TODO hpr as parameter
        // const hpr = new HeadingPitchRange(camera.position.heading, camera.position.pitch, camera.position.range)

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

        // If the camera is in movement, we sav the journey in DB every <saveDelay> ms
        // We save the last movement <saveDelay> ms after the last camera change

        const saveData = async () => {
            const currentTime = Date.now()
            if (currentTime - lastMouseMoveTime >= saveDelay) {
                clearInterval(saveInterval)
                saveInterval = null
            }
            await lgs.theJourney.saveToDB()
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

    raiseUpdateEvent = () => {
        this.updatePositionInformation()
    }

    updatePositionInformation = async () => {
        const data = await CameraUtils.updatePositionInformation()
        // Update Camera Manager information
        if (data) {
            this.target = data.target
            this.position = data.position
        }
        else {
            this.reset()
        }
        // Update camera proxy
        lgs.mainProxy.components.camera.position = this.position
        lgs.mainProxy.components.camera.target = this.target
        return this
    }


    /**
     * Get the data of the camera instance
     */
    get = () => {
        return this
    }

    reset = () => {
        this.target = {
            longitude: lgs.configuration.starter.longitude,
            latitude:  lgs.configuration.starter.latitude,
            height:    lgs.configuration.starter.height,
        }
        this.position = {
            longitude: undefined,
            latitude:  undefined,
            height:    undefined,
            heading:   lgs.configuration.camera.heading,
            pitch:     lgs.configuration.camera.pitch,
            roll:      lgs.configuration.camera.roll,
            range:     lgs.configuration.camera.range,
        }

        return this
    }


}

