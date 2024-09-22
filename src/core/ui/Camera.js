import { CameraUtils } from '../../Utils/cesium/CameraUtils.js'

export class Camera {
    static CLOCKWISE = true
    static MOVE_EVENT = 'camera/move'
    static UPDATE_EVENT = 'camera/update'

    starter = {}
    heading
    pitch
    roll
    range
    target = {}

    constructor(settings) {

        // Singleton
        if (Camera.instance) {
            return Camera.instance
        }

        this.target.longitude = settings?.target?.longitude ?? lgs.configuration.starter.longitude
        this.target.latitude = settings?.target?.latitude ?? lgs.configuration.starter.latitude
        this.target.height = settings?.target?.height ?? lgs.configuration.starter.height

        this.longitude = undefined
        this.latitude = undefined
        this.height = undefined

        this.heading = settings?.heading ?? lgs.configuration.camera.heading
        this.pitch = settings?.pitch ?? lgs.configuration.camera.pitch
        this.roll = settings?.roll ?? lgs.configuration.camera.roll
        this.range = settings?.range ?? lgs.configuration.camera.range
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
                __.ui.camera.update().then(data => {
                    lgs.mainProxy.components.camera.position = data
                    lgs.events.emit(this.UPDATE_EVENT, [data])
                })
            })
        }
        __.ui.camera.event = true
    }

    update = async (data = null) => {
        data = (data === null) ? await CameraUtils.updateCamera() : data[0]
        if (data) {
            this.target = {
                longitude: data.target.longitude??this.target.longitude,
                latitude: data.target.latitude??this.target.latitude,
                height: data.target.height??this.target.height,
            }
            this.longitude = data.longitude??this.longitude
            this.latitude = data.latitude??this.latitude
            this.height = data.height??this.height
            this.heading = data.heading??this.heading
            this.pitch = data.pitch??this.pitch
            this.roll = data.roll??this.roll
            this.range = data.range?? this.range
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
        return {
            target: {
                longitude: this.target.longitude,
                latitude: this.target.latitude,
                height: this.target.height,
            },
            longitude: this.longitude,
            latitude: this.latitude,
            height: this.height,
            heading: this.heading,
            pitch: this.pitch,
            roll: this.roll,
            range: this.range,
        }
    }

    reset = () => {
        this.target = {
            longitude: lgs.configuration.starter.longitude,
            latitude: lgs.configuration.starter.latitude,
            height: lgs.configuration.starter.height,
        }
        this.longitude = undefined
        this.latitude = undefined
        this.height = undefined
        this.heading = lgs.configuration.camera.heading
        this.pitch = lgs.configuration.camera.pitch
        this.roll = lgs.configuration.camera.roll
        this.range = lgs.configuration.camera.range

        return this
    }

}

