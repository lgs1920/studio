import {Cartesian3, HeadingPitchRange, Math, Transforms} from 'cesium'
import {update}                                          from '../Components/UI/TextValueUI/TextValueUI.jsx'

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
    static getPosition = (camera) => {

        if (!camera) {
            camera = window.vt3d.camera
        }

        const {longitude, latitude, height} = camera.positionCartographic
        return {
            longitude: Math.toDegrees(longitude),
            latitude: Math.toDegrees(latitude),
            height: height,
        }
    }

    /**
     *
     * @param camera
     */
    static  updatePosition = (camera) => {


        if (!camera) {
            camera = window.vt3d.camera
        }

        try {
            const position = CameraUtils.getPosition(camera)
            update({id: 'camera-longitude', value: position.longitude.toFixed(5)})
            update({id: 'camera-latitude', value: position.latitude.toFixed(5)})
            update({id: 'camera-altitude', value: position.height.toFixed()})
            const cameraAngles = CameraUtils.getHeadingAndPitch(camera)
            update({id: 'camera-heading', value: cameraAngles.heading.toFixed()})
            update({id: 'camera-pitch', value: (cameraAngles.pitch).toFixed(), class: 'test'})
        } catch (e) {
            console.log(e)
        }


    }


    /**
     * Turn around the camera target by PI/1000 on each Camera rotation.
     *
     *
     *
     */
    static turnAroundCameraTarget = () => {
        return
        /**
         * Only if target has been defined
         */
        if (window.vt3d.configuration.center.target) {
            const cameraOffset = new HeadingPitchRange(
                Math.toRadians(window.vt3d.configuration.center.camera.heading),
                Math.toRadians(window.vt3d.configuration.center.camera.pitch),
                window.vt3d.configuration.center.camera.range,
            )
            CameraUtils.lookAt(window.vt3d.camera, window.vt3d.windowCenter, cameraOffset)

            /**
             * Let's rotate on left for PI/1000 angle
             */
            const step = Math.PI / 1000
            window.vt3d.viewer.clock.onTick.addEventListener(() => {
                window.vt3d.camera.rotateLeft(step)
                // No event on rotate, so we force update position
                CameraUtils.updatePosition()
            })
        }
    }


}