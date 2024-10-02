//import camera          from 'resium/src/Camera'
import { CameraUtils } from '../../Utils/cesium/CameraUtils.js'

export class Camera {
    static CLOCKWISE = true
    static MOVE_EVENT = 'camera/move'
    static UPDATE_EVENT = 'camera/update'

    starter = {}
    target = {}
    position = {}

    constructor(settings) {

        // Singleton
        if (Camera.instance) {
            return Camera.instance
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
        this.clockwise = Camera.CLOCKWISE

        Camera.instance = this

    }

    run360 = async () => {
        CameraUtils.run360(this)
        await this.update()
    }

    stop360 = async () => {
        CameraUtils.stop360()
        await this.update()
    }

    addUpdateEvent = () => {
        if (!__.ui.camera.event) {
            lgs.camera.percentageChanged = lgs.configuration.camera.percentageChanged
            lgs.camera.changed.addEventListener(() => {
                __.ui.camera.update().then(camera => {
                    lgs.mainProxy.components.camera.position = camera.position
                    lgs.mainProxy.components.camera.target = camera.target

                    lgs.events.emit(this.UPDATE_EVENT, [camera])
                })
            })
        }
        __.ui.camera.event = true
    }

    update = async () => {
        const data = await CameraUtils.updateCamera()
        if (data) {
            this.target = data.target
            this.position = data.position
        } else {
            this.reset()
        }
        lgs.events.emit(Camera.UPDATE_EVENT)
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
            latitude: lgs.configuration.starter.latitude,
            height: lgs.configuration.starter.height,
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

