/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: cameraStartup.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-01
 * Last modified: 2026-05-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    CURRENT_JOURNEY, DEFAULT_2D_FOCUS_PITCH, FOCUS_CENTROID, FOCUS_LAST, FOCUS_STARTER,
}                                                                     from '@Core/constants'
import { MapTarget }                                                  from '@Core/MapTarget'
import { Cartesian3 }                                                 from 'cesium'

export const finiteCameraNumber = value => {
    if (value === null || value === undefined || value === '') {
        return null
    }

    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const MIN_CAMERA_POSITION_HEIGHT = -1000
const MIN_MAP_TARGET_HEIGHT = -12000

const finiteHeightAtLeast = (value, minimum) => {
    const height = finiteCameraNumber(value)
    return height !== null && height >= minimum ? height : null
}

const cameraPositionHeight = value => finiteHeightAtLeast(value, MIN_CAMERA_POSITION_HEIGHT)
const mapTargetHeight = value => finiteHeightAtLeast(value, MIN_MAP_TARGET_HEIGHT)

export const cameraTargetIsValid = cameraStore => {
    const target = cameraStore?.target
    return finiteCameraNumber(target?.longitude) !== null
        && finiteCameraNumber(target?.latitude) !== null
        && mapTargetHeight(target?.height) !== null
}

export const cameraPositionIsValid = position => finiteCameraNumber(position?.longitude) !== null
    && finiteCameraNumber(position?.latitude) !== null
    && cameraPositionHeight(position?.height) !== null

const defaultCameraSettings = cameraSettings => ({
    heading: finiteCameraNumber(cameraSettings?.heading) ?? 0,
    pitch:   finiteCameraNumber(cameraSettings?.pitch) ?? -30,
    roll:    finiteCameraNumber(cameraSettings?.roll) ?? 0,
    range:   finiteCameraNumber(cameraSettings?.range) ?? 2000,
})

const cesiumDistance = ({longitude, latitude, height}, target) => Cartesian3.distance(
    Cartesian3.fromDegrees(longitude, latitude, height),
    Cartesian3.fromDegrees(target.longitude, target.latitude, target.height),
)

export const cameraRangeFromStoredPosition = (position = {}, target = {}, distanceCalculator = cesiumDistance) => {
    const longitude = finiteCameraNumber(position.longitude)
    const latitude = finiteCameraNumber(position.latitude)
    const height = cameraPositionHeight(position.height)
    const targetLongitude = finiteCameraNumber(target.longitude)
    const targetLatitude = finiteCameraNumber(target.latitude)
    const targetHeight = mapTargetHeight(target.height)

    if ([longitude, latitude, height, targetLongitude, targetLatitude, targetHeight].some(value => value === null)) {
        return null
    }

    return distanceCalculator(
        {longitude, latitude, height},
        {longitude: targetLongitude, latitude: targetLatitude, height: targetHeight},
    )
}

export const cameraPositionWithDefaults = (
    position           = {},
    target             = {},
    cameraSettings     = {},
    distanceCalculator = cesiumDistance,
) => {
    const settings = defaultCameraSettings(cameraSettings)
    const storedRange = finiteCameraNumber(position.range)
    const computedRange = cameraRangeFromStoredPosition(position, target, distanceCalculator) ?? storedRange

    return {
        longitude: position.longitude,
        latitude:  position.latitude,
        height:    position.height,
        heading:   finiteCameraNumber(position.heading) ?? settings.heading,
        pitch:     finiteCameraNumber(position.pitch) ?? settings.pitch,
        roll:      finiteCameraNumber(position.roll) ?? settings.roll,
        range:     computedRange ?? settings.range,
    }
}

export const cameraStoreForTarget = (
    target,
    position           = {},
    cameraSettings     = {},
    distanceCalculator = cesiumDistance,
) => ({
    target:   {
        longitude:       target.longitude,
        latitude:        target.latitude,
        height:          target.height,
        simulatedHeight: target.simulatedHeight,
    },
    position: cameraPositionWithDefaults(position, target, cameraSettings, distanceCalculator),
})

export const starterCameraStore = (
    starter,
    cameraSettings     = {},
    distanceCalculator = cesiumDistance,
) => cameraStoreForTarget(starter, {}, cameraSettings, distanceCalculator)

export const journeyCentroidCameraStore = async ({
                                                     journey,
                                                     sceneManager,
                                                     cameraSettings = {},
                                                     distanceCalculator = cesiumDistance,
                                                 }) => {
    if (!journey?.tracks?.size || !sceneManager?.getJourneyCentroid) {
        return null
    }

    const centroid = await sceneManager.getJourneyCentroid(journey)
    if (!centroid) {
        return null
    }

    return {
        focusTarget: journey,
        cameraStore: cameraStoreForTarget(new MapTarget(CURRENT_JOURNEY, {
            ...centroid,
            id: journey.slug,
        }), {}, cameraSettings, distanceCalculator),
    }
}

export const fallbackCameraConfiguration = async ({
                                                      context,
                                                      starter,
                                                      sceneManager,
                                                      cameraSettings = {},
                                                      distanceCalculator = cesiumDistance,
                                                  }) => {
    const journeyConfiguration = await journeyCentroidCameraStore({
                                                                      journey: context?.theJourney,
                                                                      sceneManager,
                                                                      cameraSettings,
                                                                      distanceCalculator,
                                                                  })
    return journeyConfiguration ?? {
        focusTarget: starter,
        cameraStore: starterCameraStore(starter, cameraSettings, distanceCalculator),
    }
}

export const lastCameraConfiguration = async ({
                                                  context,
                                                  starter,
                                                  cameraManager,
                                                  sceneManager,
                                                  cameraSettings = {},
                                                  distanceCalculator = cesiumDistance,
                                              }) => {
    const savedCamera = await cameraManager?.readCameraInformation?.({fallback: false})
    if (cameraPositionIsValid(savedCamera?.position)) {
        const savedTargetIsValid = cameraTargetIsValid(savedCamera)
        const fallbackConfiguration = savedTargetIsValid
                                      ? null
                                      : await fallbackCameraConfiguration({
                                                                              context,
                                                                              starter,
                                                                              sceneManager,
                                                                              cameraSettings,
                                                                              distanceCalculator,
                                                                          })
        const target = savedTargetIsValid ? savedCamera.target : fallbackConfiguration.cameraStore.target

        return {
            focusTarget: savedTargetIsValid ? target : fallbackConfiguration.focusTarget,
            cameraStore: {
                restoreCameraPosition: true,
                target:                target,
                position:              cameraPositionWithDefaults(
                    savedCamera.position,
                    savedTargetIsValid ? savedCamera.target : {},
                    cameraSettings,
                    distanceCalculator,
                ),
            },
        }
    }

    return fallbackCameraConfiguration({
                                           context,
                                           starter,
                                           sceneManager,
                                           cameraSettings,
                                           distanceCalculator,
                                       })
}

export const configureStartupCamera = async ({
                                                 context,
                                                 starter,
                                                 cameraManager,
                                                 sceneManager,
                                                 cameraSettings = {},
                                                 distanceCalculator = cesiumDistance,
                                             }) => {
    if (cameraManager?.isAppFocusOn?.(FOCUS_LAST)) {
        return lastCameraConfiguration({
                                           context,
                                           starter,
                                           cameraManager,
                                           sceneManager,
                                           cameraSettings,
                                           distanceCalculator,
                                       })
    }

    if (cameraManager?.isAppFocusOn?.(FOCUS_CENTROID)) {
        return fallbackCameraConfiguration({
                                               context,
                                               starter,
                                               sceneManager,
                                               cameraSettings,
                                               distanceCalculator,
                                           })
    }

    if (cameraManager?.isAppFocusOn?.(FOCUS_STARTER) && !context?.theJourney) {
        return {
            focusTarget: starter,
            cameraStore: starterCameraStore(starter, cameraSettings, distanceCalculator),
        }
    }

    return fallbackCameraConfiguration({
                                           context,
                                           starter,
                                           sceneManager,
                                           cameraSettings,
                                           distanceCalculator,
                                       })
}

export const buildStartupCameraFocusOptions = ({
                                                   cameraStore,
                                                   focusTarget,
                                                   noRelief = false,
                                                   rotate = false,
                                                   rpm,
                                                   callback,
                                               }) => {
    const restoreCameraPosition = cameraStore.restoreCameraPosition === true
    const pitch = finiteCameraNumber(cameraStore.position?.pitch) ?? (noRelief ? DEFAULT_2D_FOCUS_PITCH : -30)

    return {
        target:         focusTarget,
        heading:        cameraStore.position.heading,
        pitch,
        roll:           cameraStore.position.roll,
        range:          cameraStore.position.range,
        infinite:       true,
        rotate,
        lookAt:         true,
        cameraPosition: restoreCameraPosition ? cameraStore.position : null,
        rpm,
        callback,
    }
}
