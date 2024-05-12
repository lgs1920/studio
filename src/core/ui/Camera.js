import { CameraUtils } from '../../Utils/cesium/CameraUtils.js'

export class Camera {
    static CLOCKWISE = true
    static MOVE_EVENT = 'camera/move'

    starter = {}
    heading
    pitch
    roll
    range

    constructor(settings) {

        // Singleton
        if (!!Camera.instance) {
            return Camera.instance
        }

        this.longitude = settings?.longitude ?? vt3d.configuration.starter.longitude
        this.latitude = settings?.latitude ?? vt3d.configuration.starter.latitude
        this.height = settings?.height ?? vt3d.configuration.starter.height
        this.heading = settings?.heading ?? vt3d.configuration.starter.camera.heading
        this.pitch = settings?.pitch ?? vt3d.configuration.starter.camera.pitch
        this.roll = settings?.roll ?? vt3d.configuration.starter.camera.roll
        this.range = settings?.range ?? vt3d.configuration.starter.camera.range
        this.clockwise = Camera.CLOCKWISE

        Camera.instance = this

    }

    run360 = () => {
        CameraUtils.run360(this)
        this.update()
    }

    stop360 = () => {
        vt3d.stop360()
    }

    update = async (data = null) => {
        if (data === null) {
            data = await CameraUtils.updateCamera()
        }

        this.longitude = data.longitude
        this.latitude = data.latitude
        this.height = data.height
        this.heading = data.heading
        this.pitch = data.pitch
        this.roll = data.roll
    }

    reset = () => {
        this.longitude = vt3d.configuration.starter.longitude
        this.latitude = vt3d.configuration.starter.latitude
        this.height = vt3d.configuration.starter.height
        this.heading = vt3d.configuration.starter.camera.heading
        this.pitch = vt3d.configuration.starter.camera.pitch
        this.roll = vt3d.configuration.starter.camera.roll
        this.range = vt3d.configuration.starter.camera.range
    }

}

