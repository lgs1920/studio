/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CameraUtils.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-30
 * Last modified: 2026-04-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import * as Cesium from 'cesium'
import { DEFAULT_2D_FOCUS_PITCH } from '@Core/constants'
import {
    Cartesian2, Cartesian3, Cartographic, Ellipsoid, HeadingPitchRange, Math as M, Matrix4, SceneMode, Transforms,
}                  from 'cesium'

const finiteNumber = value => {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}
const cameraWorldPosition = camera => camera?.positionWC ?? camera?.position
const targetHeightOf = target => target?.simulatedHeight ?? target?.height
const cameraRangeToTarget = (camera, target) => {
    const longitude = finiteNumber(target?.longitude)
    const latitude = finiteNumber(target?.latitude)
    const height = finiteNumber(targetHeightOf(target))
    const cameraPosition = cameraWorldPosition(camera)

    if ([longitude, latitude, height].some(value => value === null) || !cameraPosition) {
        return undefined
    }

    return Cartesian3.distance(Cartesian3.fromDegrees(longitude, latitude, height), cameraPosition)
}

export class CameraUtils {

    static lookAt = (camera, target, hpr) => {
        // Lock camera to a point
        const point = Cesium.Cartesian3.fromDegrees(target.longitude, target.latitude, target.height)
        camera.lookAtTransform(Transforms.eastNorthUpToFixedFrame(point), new HeadingPitchRange(hpr.heading, hpr.pitch, hpr.range))
    }

    static setOrbitTransform = (camera, target) => {
        const point = Cartesian3.fromDegrees(target.longitude, target.latitude, targetHeightOf(target))
        camera.lookAtTransform(Transforms.eastNorthUpToFixedFrame(point))
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
                heading: M.toDegrees(M.zeroToTwoPi(camera.heading)),
                pitch: M.toDegrees(camera.pitch),
                roll: M.toDegrees(camera.roll),
            }
        } else {
            return {heading: 360, pitch: DEFAULT_2D_FOCUS_PITCH, roll: 360}
        }
    }

    /**
     * get Camera target and position in degrees
     */
    static getPositionsSync = (camera, options = {}) => {
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

        const target = options.skipTargetPick
                       ? options.target ?? lgs.stores.main.components.camera.target
                       : CameraUtils.getCameraTargetPosition(camera)
        const targetHeight = targetHeightOf(target)
        const {longitude, latitude, height} = camera.positionCartographic
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
                height: targetHeight,
            },
            position: {
                longitude: M.toDegrees(longitude),
                latitude: M.toDegrees(latitude),
                height: height,
                range: options.range ??
                           target?.range ??
                           cameraRangeToTarget(camera, target) ??
                           lgs.stores.main.components.camera.position?.range ??
                           (height ?? lgs.settings.camera.range),
            },
        }
    }

    static getPositions = async (camera, options = {}) => CameraUtils.getPositionsSync(camera, options)


    /**
     *
     * @param camera
     *
     * @return {position:{object},target:{object}}
     */
    static updatePositionInformation = async (camera, options = {}) => {
        // If we do not have camera, we try to set one or return
        if (!camera) {
            camera = lgs.camera
            if (camera === undefined) {
                return undefined
            }
        }

        try {
            const cameraData = await CameraUtils.getPositions(camera, options)
            cameraData.position = {...cameraData.position, ...await CameraUtils.getHeadingPitchRoll(camera)}
            return cameraData
        } catch (e) {
            console.error(e)
            return undefined
        }
    }

    static updatePositionInformationSync = (camera, options = {}) => {
        if (!camera) {
            camera = lgs.camera
            if (camera === undefined) {
                return undefined
            }
        }

        try {
            const cameraData = CameraUtils.getPositionsSync(camera, options)
            cameraData.position = {...cameraData.position, ...CameraUtils.getHeadingPitchRoll(camera)}
            return cameraData
        }
        catch (e) {
            console.error(e)
            return undefined
        }
    }

    //https://groups.google.com/g/cesium-dev/c/QSFf3RxNRfE
    static getCameraTargetPosition = (camera = lgs.camera) => {
        const ray = camera.getPickRay(new Cartesian2(
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
                range: Cartesian3.distance(position, cameraWorldPosition(camera)),
            }
        }
        else {
            const target = lgs.stores.main.components.camera.target

            return {
                latitude:  target.latitude,
                longitude: target.longitude,
                height:    targetHeightOf(target),
                range:     cameraRangeToTarget(camera, target),
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
