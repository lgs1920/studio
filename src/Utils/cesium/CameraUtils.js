import { Cartesian3, HeadingPitchRange, Math, Transforms } from 'cesium'

export class CameraUtils {

    static lookAt = (camera, center, hpr) => {
        // Lock camera to a point
        const point = new Cartesian3(center.x, center.y, center.z)
        camera.lookAtTransform(Transforms.eastNorthUpToFixedFrame(point), hpr)
        //camera.lookAtTransform(Matrix4.IDENTITY, hpr)


    }
    /**
     * get Camera Heading and Pitch
     */
    static getHeadingAndPitch = (camera) => {
        if (camera) {
            return {
                heading: Math.toDegrees(camera.heading),
                pitch: Math.toDegrees(camera.pitch),
            }
        } else {
            return {heading: 0, pitch: 0}
        }

    }

    /**
     * get Camera Position in degrees
     */
    static getPosition = async (camera) => {

        // If we do not have camera, we try to set one or return zeros
        if (!camera) {
            camera = vt3d.camera
            if (camera === undefined) {
                return {longitude: 0, latitude: 0, height: 0}
            }
        }

        const {longitude, latitude, height} = await camera.positionCartographic
        return {
            longitude: Math.toDegrees(longitude),
            latitude: Math.toDegrees(latitude),
            altitude: height,
        }
    }

    /**
     *
     * @param camera
     */
    static  updatePosition = async (camera) => {

        // If we do not have camera, we try to set one or return
        if (!camera) {
            camera = vt3d.camera
            if (camera === undefined) {
                return
            }
        }

        try {
            const position = await CameraUtils.getPosition(camera)
            const cameraAngles = await CameraUtils.getHeadingAndPitch(camera)
            let heading = cameraAngles.heading
            if (heading === 360) {
                heading = 0
            }
            return {
                longitude: position.longitude,
                latitude: position.latitude,
                altitude: position.altitude,
                heading: heading,
                pitch: cameraAngles.pitch,
            }
        } catch (e) {
            console.error(e)
            return undefined
        }


    }


    /**
     * Turn around the camera target by PI/1000 on each Camera rotation.
     *
     *
     *
     */
    static turnAroundCameraTarget = () => {

        if (vt3d.journeys.size === 0) {
            /**
             * Only if target has been defined
             */
            if (vt3d.configuration.center.target) {
                const cameraOffset = new HeadingPitchRange(
                    Math.toRadians(vt3d.configuration.center.camera.heading),
                    Math.toRadians(vt3d.configuration.center.camera.pitch),
                    vt3d.configuration.center.camera.range,
                )
                CameraUtils.lookAt(vt3d.camera, vt3d.windowCenter, cameraOffset)

                /**
                 * Let's rotate on left for PI/1000 angle
                 */
                const step = Math.PI / 1000
                vt3d.stopTurnAround = vt3d.viewer.clock.onTick.addEventListener(async () => {
                    vt3d.camera.rotateLeft(step)
                    // No event on rotate, so we force update position
                    await CameraUtils.updatePosition()
                })
            }
        }
    }


}