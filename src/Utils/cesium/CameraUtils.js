import * as Cesium from 'cesium'
import {
    Cartesian2, Cartesian3, Cartographic, Ellipsoid, HeadingPitchRange, Math as M, Matrix4, SceneMode, Transforms,
}                  from 'cesium'

export class CameraUtils {

    static lookAt = (camera, target, hpr) => {
        // Lock camera to a point
        const point = Cesium.Cartesian3.fromDegrees(target.longitude, target.latitude, target.height)
        camera.lookAtTransform(Transforms.eastNorthUpToFixedFrame(point), new HeadingPitchRange(hpr.heading, hpr.pitch, hpr.range))
    }

    static unlock = (camera) => {
        camera.lookAtTransform(Matrix4.IDENTITY);
    }

    /**
     * get Camera Heading and Pitch (only in 3D mode)
     */
    static getHeadingPitchRoll = (camera) => {
        if (camera && lgs.scene.mode === SceneMode.SCENE3D) {
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
        //
        // let scratchRectangle = new Rectangle();
        // const  rect = lgs.camera.computeViewRectangle(lgs.scene.globe.ellipsoid,
        //                                               scratchRectangle);
        // console.log(Rectangle.center(rect))
        //https://gis.stackexchange.com/questions/270888/cesium-camera-computeviewrectangle-to-get-current-view-bounds
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
                range: (height ?? lgs.settings.getCamera.range),
            },
        }
    }


    /**
     *
     * @param camera
     *
     * @return {position:{object},target:{object}}
     */
    static updatePositionInformation = async (camera) => {
        // If we do not have camera, we try to set one or return
        if (!camera) {
            camera = lgs.camera
            if (camera === undefined) {
                return undefined
            }
        }

        try {
            const cameraData = await CameraUtils.getPositions(camera)
            cameraData.position = {...cameraData.position, ...await CameraUtils.getHeadingPitchRoll(camera), ...cameraData.target}
            return cameraData
        } catch (e) {
            console.error(e)
            return undefined
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
        else {
            return {
                latitude:  lgs.mainProxy.components.camera.position.latitude,
                longitude: lgs.mainProxy.components.camera.position.longitude,
                height:    lgs.mainProxy.components.camera.position.height,
                range:     lgs.camera.position,
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

    static getTargetPositionInPixels(position) {
        if (position?.longitude && position?.latitude) {
            const cartesian = Cartographic.toCartesian(new Cesium.Cartographic(Cesium.Math.toRadians(position.longitude), Cesium.Math.toRadians(position.latitude)))
            return lgs.scene.cartesianToCanvasCoordinates(cartesian)
        }
        return null
    }



}