import { Cartesian2, Cartesian3, Cartographic, Ellipsoid, Math as M, Matrix4, Transforms } from 'cesium'

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

        const target = CameraUtils.getCameraTargetPosition()
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
     *
     * @return {position:{object},target:{object}}
     */
    static  updateCamera = async (camera) => {

        // If we do not have camera, we try to set one or return
        if (!camera) {
            camera = lgs.camera
            if (camera === undefined) {
                return undefined
            }
        }

        try {
            const cameraData = await CameraUtils.getPositions(camera)
            cameraData.position = {...cameraData.position, ...await CameraUtils.getHeadingPitchRoll(camera)}
            return cameraData
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
    static run360 = (target = null) => {
        const camera = __.ui.camera.get()
        if (target) {
            camera.target = {
                longitude: target.longitude,
                latitude:  target.latitude,
                height:    target.height,
            }

            camera.position.heading = target.camera.heading
            camera.position.pitch = target.camera.pitch
            camera.position.roll = target.camera.roll
            camera.position.range = target.camera.range
        }
        else {
            if (!camera.target) {
                return // Bail early if no target at all
            }
            target = {
                longitude: camera.target.longitude,
                latitude:  camera.target.latitude,
                height:    camera.target.height,
                camera:    {
                    heading: M.toRadians(camera.position.heading),
                    pitch:   M.toRadians(camera.position.pitch),
                    range:   camera.position.range,
                },
            }
        }


        // TODO hpr as parameter
        // const hpr = new HeadingPitchRange(camera.position.heading, camera.position.pitch, camera.position.range)

        CameraUtils.lookAt(lgs.camera, Cartesian3.fromDegrees(target.longitude, target.latitude, target.height))

        const step = (lgs.camera.clockwise) ? M.PI / 800 : -M.PI / 800
        lgs.stop360 = lgs.viewer.clock.onTick.addEventListener(() => {
            lgs.camera.rotateLeft(step)
        })
    }

    static stop360 =() => {
        if (lgs.stop360) {
            lgs.stop360()
            lgs.stop360=undefined
        }
    }

    //https://groups.google.com/g/cesium-dev/c/QSFf3RxNRfE
    static getCameraTargetPosition = () => {
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

    addCrossAtPosition(position) {
        if (position) {
            viewer.entities.add({
                                    position: position,
                                    polyline: {
                                        positions: [
                                            Cesium.Cartesian3.add(position, new Cesium.Cartesian3(-10, 0, 0), new Cesium.Cartesian3()),
                                            Cesium.Cartesian3.add(position, new Cesium.Cartesian3(10, 0, 0), new Cesium.Cartesian3()),
                                            Cesium.Cartesian3.add(position, new Cesium.Cartesian3(0, -10, 0), new Cesium.Cartesian3()),
                                            Cesium.Cartesian3.add(position, new Cesium.Cartesian3(0, 10, 0), new Cesium.Cartesian3()),
                                        ],
                                        width:     2,
                                        material:  Cesium.Color.RED,
                                    },
                                })
        }
    }



}