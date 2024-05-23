
import {
    Cartesian2, Cartesian3, Cartographic, Ellipsoid, HeadingPitchRange, Math as M, Matrix4, Transforms,
} from 'cesium'

export class CameraUtils {

    static lookAt = (camera, center, hpr) => {
        // Lock camera to a point
        const point = new Cartesian3(center.x, center.y, center.z)
        camera.lookAtTransform(Transforms.eastNorthUpToFixedFrame(point), hpr)
    }

    static unlock = (camera) => {
        camera.lookAtTransform(Matrix4.IDENTITY);
    }

    /**
     * get Camera Heading and Pitch
     */
    static getHeadingPitchRoll = (camera) => {
        if (camera) {
            return {
                heading: Math.max(0, Math.min(M.toDegrees(Math.round(camera.heading)), 360)),
                pitch: M.toDegrees(camera.pitch),
                roll: M.toDegrees(camera.roll),
            }
        } else {
            return {heading: 360, pitch: -90, roll: 360}
        }
    }

    /**
     * get Camera target and position in degrees
     */
    static getPositions = async (camera) => {
        // If we do not have camera, we try to set one or return zeros
        if (!camera) {
            camera = lgs.camera
            if (camera === undefined) {
                return {
                    target: {
                        longitude: 0,
                        latitude: 0,
                        height: 0,
                    },
                    position: {
                        longitude: 0,
                        latitude: 0,
                        height: 0,
                        range: 0,
                    },
                }
            }
        }

        const target = CameraUtils.lookAtPoint()

        const {longitude, latitude, height} = await camera.positionCartographic
        return {
            target: {
                longitude: target?.longitude,
                latitude: target?.latitude,
                height: target?.height,
            },
            position: {
                longitude: M.toDegrees(longitude),
                latitude: M.toDegrees(latitude),
                height: height,
                range: target?.range ?? lgs.configuration.camera.range,
            },
        }
    }

    /**
     *
     * @param camera
     */
    static  updateCamera = async (camera) => {

        // If we do not have camera, we try to set one or return
        if (!camera) {
            camera = lgs.camera
            if (camera === undefined) {
                return
            }
        }

        try {
            const cameraPositions = await CameraUtils.getPositions(camera)
            const hpr = await CameraUtils.getHeadingPitchRoll(camera)
            lgs.mainProxy.components.camera.position = {
                target: cameraPositions.target,
                longitude: cameraPositions.position.longitude,
                latitude: cameraPositions.position.latitude,
                height: cameraPositions.position.height,
                heading: hpr.heading,
                pitch: hpr.pitch,
                roll: hpr.roll,
                range: cameraPositions.position.range,
            }
            return lgs.mainProxy.components.camera.position
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
    static run360 = () => {
        const camera = __.ui.camera.get()
        if (camera.target) {
            CameraUtils.lookAt(lgs.camera,
                Cartesian3.fromDegrees(
                    camera.target.longitude,
                    camera.target.latitude,
                    camera.target.height,
                ),
                new HeadingPitchRange(
                    M.toRadians(camera.heading),
                    M.toRadians(camera.pitch),
                    camera.range,
                ))

            const step = (camera.clockwise) ? M.PI / 1000 : -M.PI / 1000
            lgs.stop360 = lgs.viewer.clock.onTick.addEventListener(async () => {
                lgs.camera.rotateLeft(step)
            })
        }

    }

    static stop360 =() => {
        if (lgs.stop360) {
            lgs.stop360()
            lgs.stop360=undefined
        }
    }

    //https://groups.google.com/g/cesium-dev/c/QSFf3RxNRfE
    static lookAtPoint = () => {
        const ray = lgs.camera.getPickRay(new Cartesian2(
            Math.round(lgs.canvas.clientWidth / 2),
            Math.round(lgs.canvas.clientHeight / 2),
        ))

        const position = lgs.scene.globe.pick(ray, lgs.scene)
        if (position) {
            const cartographic = Ellipsoid.WGS84.cartesianToCartographic(position)
            return {
                latitude: M.toDegrees(cartographic.latitude),
                longitude: M.toDegrees(cartographic.longitude),
                height: cartographic.height,
                range: Cartesian3.distance(position, lgs.camera.position),
            }
        }
    }

    static cameraPositionFromTarget=(target,hpr) =>{

        const transform = Transforms.eastNorthUpToFixedFrame(
            Cartesian3.fromDegrees(target.longitude, target.latitude, target.height)
        );

        const heading = M.toRadians(hpr.heading);
        const pitch = M.toRadians(hpr.pitch);
        const range = hpr.range;
        const cameraPosition = new Cartesian3();
        Matrix4.multiplyByPoint(transform, new Cartesian3(Math.cos(heading) * range, Math.sin(heading) * range, pitch), cameraPosition);

        const cartographicPosition = Cartographic.fromCartesian(cameraPosition);

        return {
            longitude :M.toDegrees(cartographicPosition.longitude),
            latitude : M.toDegrees(cartographicPosition.latitude),
            height : cartographicPosition.height
        }
    }


}