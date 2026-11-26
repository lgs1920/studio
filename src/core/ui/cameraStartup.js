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
 * Last modified: 2026-11-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    CURRENT_JOURNEY, DEFAULT_FLAT_SCENE_FOCUS_PITCH, FOCUS_CENTROID, FOCUS_LAST, FOCUS_STARTER,
}                                                                     from '@Core/constants'
import { MapTarget }                                                  from '@Core/MapTarget'
import { getOrbitSettings }                                           from '@Core/OrbitSettings'
import { Cartesian3 }                                                 from 'cesium'

export const finiteCameraNumber = value => {
    if (value === null || value === undefined || value === '') {
        return null
    }

    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

/** Return a finite positive number suitable for a camera distance or range. */
const positiveCameraNumber = value => {
    const number = finiteCameraNumber(value)
    return number !== null && number > 0 ? number : null
}

const MIN_CAMERA_POSITION_HEIGHT = -1000
const MIN_MAP_TARGET_HEIGHT = -12000

const finiteHeightAtLeast = (value, minimum) => {
    const height = finiteCameraNumber(value)
    return height !== null && height >= minimum ? height : null
}

/** Return a latitude only when it falls within the valid WGS84 range. */
const cameraLatitude = value => {
    const latitude = finiteCameraNumber(value)
    return latitude !== null && latitude >= -90 && latitude <= 90 ? latitude : null
}

const cameraPositionHeight = value => finiteHeightAtLeast(value, MIN_CAMERA_POSITION_HEIGHT)
const mapTargetHeight = value => finiteHeightAtLeast(value, MIN_MAP_TARGET_HEIGHT)

export const cameraTargetIsValid = cameraStore => {
    const target = cameraStore?.target
    return finiteCameraNumber(target?.longitude) !== null
        && cameraLatitude(target?.latitude) !== null
        && mapTargetHeight(target?.height) !== null
}

export const cameraPositionIsValid = position => finiteCameraNumber(position?.longitude) !== null
    && cameraLatitude(position?.latitude) !== null
    && cameraPositionHeight(position?.height) !== null

const defaultCameraSettings = cameraSettings => ({
    heading: finiteCameraNumber(cameraSettings?.heading) ?? 0,
    pitch:   finiteCameraNumber(cameraSettings?.pitch) ?? -30,
    roll:    finiteCameraNumber(cameraSettings?.roll) ?? 0,
    range:   positiveCameraNumber(cameraSettings?.range) ?? 2000,
})

const cesiumDistance = ({longitude, latitude, height}, target) => Cartesian3.distance(
    Cartesian3.fromDegrees(longitude, latitude, height),
    Cartesian3.fromDegrees(target.longitude, target.latitude, target.height),
)

export const cameraRangeFromStoredPosition = (position = {}, target = {}, distanceCalculator = cesiumDistance) => {
    const longitude = finiteCameraNumber(position.longitude)
    const latitude = cameraLatitude(position.latitude)
    const height = cameraPositionHeight(position.height)
    const targetLongitude = finiteCameraNumber(target.longitude)
    const targetLatitude = cameraLatitude(target.latitude)
    const targetHeight = mapTargetHeight(target.height)

    if ([longitude, latitude, height, targetLongitude, targetLatitude, targetHeight].some(value => value === null)) {
        return null
    }

    try {
        return positiveCameraNumber(distanceCalculator(
            {longitude, latitude, height},
            {longitude: targetLongitude, latitude: targetLatitude, height: targetHeight},
        ))
    }
    catch {
        return null
    }
}

export const cameraPositionWithDefaults = (
    position           = {},
    target             = {},
    cameraSettings     = {},
    distanceCalculator = cesiumDistance,
) => {
    const settings = defaultCameraSettings(cameraSettings)
    const storedRange = positiveCameraNumber(position.range)
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

/** Read the persisted global camera without allowing storage failures to stop startup. */
const readSavedCameraInformation = async cameraManager => {
    try {
        return await cameraManager?.readCameraInformation?.({fallback: false}) ?? null
    }
    catch {
        return null
    }
}

/** Prefer the global pose for centering and use the Journey pose when it is unavailable. */
const readSavedCameraPosition = async (cameraManager, journey) => {
    const savedCamera = await readSavedCameraInformation(cameraManager)

    if (cameraPositionIsValid(savedCamera?.position)) {
        return savedCamera.position
    }

    return cameraPositionIsValid(journey?.camera?.position) ? journey.camera.position : null
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

/** Restore a Journey-specific saved camera when the Journey focus preference requests it. */
const journeyCameraConfiguration = ({
                                         journey,
                                         cameraManager,
                                         cameraSettings = {},
                                         distanceCalculator = cesiumDistance,
                                     }) => {
    if (!journey || !cameraManager?.isJourneyFocusOn?.(FOCUS_LAST)) {
        return null
    }

    const savedCamera = journey.camera
    if (!cameraPositionIsValid(savedCamera?.position) || !cameraTargetIsValid(savedCamera)) {
        return null
    }

    const target = new MapTarget(CURRENT_JOURNEY, {
        ...savedCamera.target,
        id: journey.slug,
    })
    const position = cameraPositionWithDefaults(
        savedCamera.position,
        savedCamera.target,
        cameraSettings,
        distanceCalculator,
    )

    return {
        focusTarget: journey,
        cameraStore: {
            ...cameraStoreForTarget(target, position, cameraSettings, distanceCalculator),
            restoreCameraPosition: true,
        },
    }
}

/**
 * Resolve the rotation settings used by the initial camera focus.
 *
 * @param {Object} options - Startup focus and fallback settings.
 * @param {Object} options.focusTarget - Target selected for the initial focus.
 * @param {Object} options.starter - Starter target used by startup selection.
 * @param {Object} [options.persistedStarter] - Persisted starter POI, when available.
 * @param {Object} [options.fallback] - Settings used when no target value exists.
 * @returns {{rpm: number, direction: number}} Normalized startup rotation settings.
 */
export const getStartupOrbitSettings = ({
                                           focusTarget,
                                           starter,
                                           persistedStarter,
                                           fallback = {},
                                       } = {}) => {
    const target = focusTarget === starter ? (persistedStarter ?? starter) : focusTarget
    return getOrbitSettings(target, 'rotation', fallback)
}

export const journeyCentroidCameraStore = async ({
                                                     journey,
                                                     sceneManager,
                                                     cameraManager,
                                                     cameraSettings = {},
                                                     distanceCalculator = cesiumDistance,
                                                 }) => {
    if (!journey) {
        return null
    }

    const savedJourneyConfiguration = journeyCameraConfiguration({
                                                                     journey,
                                                                     cameraManager,
                                                                     cameraSettings,
                                                                     distanceCalculator,
                                                                 })
    if (savedJourneyConfiguration) {
        return savedJourneyConfiguration
    }

    if (!sceneManager?.getJourneyCentroid) {
        return null
    }

    let centroid = null
    try {
        centroid = await sceneManager.getJourneyCentroid(journey)
    }
    catch {
        return null
    }
    if (!centroid || !cameraTargetIsValid({target: centroid})) {
        return null
    }

    // Center on the journey while deriving the range and orientation from the last saved pose.
    const savedPosition = await readSavedCameraPosition(cameraManager, journey)
    const target = new MapTarget(CURRENT_JOURNEY, {
        ...centroid,
        id: journey.slug,
    })

    return {
        focusTarget: journey,
        cameraStore: cameraStoreForTarget(target, savedPosition ?? {}, cameraSettings, distanceCalculator),
    }
}

export const fallbackCameraConfiguration = async ({
                                                      context,
                                                      starter,
                                                      sceneManager,
                                                      cameraManager,
                                                      cameraSettings = {},
                                                      distanceCalculator = cesiumDistance,
                                                  }) => {
    const journeyConfiguration = await journeyCentroidCameraStore({
                                                                      journey: context?.theJourney,
                                                                      sceneManager,
                                                                      cameraManager,
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
    const savedCamera = await readSavedCameraInformation(cameraManager)
    if (cameraPositionIsValid(savedCamera?.position)) {
        const savedTargetIsValid = cameraTargetIsValid(savedCamera)
        const fallbackConfiguration = savedTargetIsValid
                                      ? null
                                      : await fallbackCameraConfiguration({
                                                                              context,
                                                                              starter,
                                                                              sceneManager,
                                                                              cameraManager,
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
                                           cameraManager,
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
                                               cameraManager,
                                               cameraSettings,
                                               distanceCalculator,
                                           })
    }

    if (cameraManager?.isAppFocusOn?.(FOCUS_STARTER) && !context?.theJourney) {
        const savedCameraConfiguration = await lastCameraConfiguration({
                                                                          context,
                                                                          starter,
                                                                          cameraManager,
                                                                          sceneManager,
                                                                          cameraSettings,
                                                                          distanceCalculator,
                                                                      })
        if (savedCameraConfiguration.cameraStore.restoreCameraPosition) {
            return savedCameraConfiguration
        }

        return {
            focusTarget: starter,
            cameraStore: starterCameraStore(starter, cameraSettings, distanceCalculator),
        }
    }

    return fallbackCameraConfiguration({
                                           context,
                                           starter,
                                           sceneManager,
                                           cameraManager,
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
    const pitch = finiteCameraNumber(cameraStore.position?.pitch) ?? (noRelief ? DEFAULT_FLAT_SCENE_FOCUS_PITCH : -30)

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
