/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayCameraAngleGuide.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-27
 * Last modified: 2026-10-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Replay camera angle guide mounted on the interactive map.
 */

import {REPLAY_DRAWER, VIDEO_CROP_ZONE} from '@Core/constants'
import {
    getJourneyReplaySettings,
    normalizeJourneyReplayCamera,
    normalizeJourneyReplayProgressionStyle,
    REPLAY_INITIAL_CAMERA_ANGLE,
    toGlobalReplayCameraSettings,
} from '@Core/ui/replay/JourneyReplayProgressionStyle'
import {
    mountJourneyReplayCameraAngleGuide,
    REPLAY_CAMERA_ANGLE_GUIDE_CHANGE_EVENT,
    removeJourneyReplayCameraAngleGuide,
    resolveJourneyReplayCameraAngleGuide,
    updateJourneyReplayCameraAngleGuide,
} from '@Core/ui/replay/JourneyReplayCameraAngleGuide'
import {fadeJourneyForReplayPreparation} from '@Core/ui/replay/JourneyReplayPreparationAppearance'
import {
    currentJourneyReplayCameraSettings,
    isJourneyReplayCameraActive,
    isJourneyReplayDryRunActive,
    isJourneyReplayVideoCaptureActive,
} from '@Core/ui/replay/JourneyReplayRuntime'
import {
    REPLAY_USER_MODE_BASIC,
    syncJourneyExpertReplayCamera,
    syncJourneyBasicReplayCamera,
} from '@Core/ui/replay/ReplayUserModes'
import {getBasicReplaySettings, writeBasicReplaySettings} from '@Core/ui/replay/ReplayModeSettings'
import {useOptionalSnapshot, useProxyValue} from '@Utils/ValtioUtils'
import {useCallback, useEffect, useRef, useSyncExternalStore} from 'react'
import {useSnapshot} from 'valtio'

const DEFAULT_REPLAY_ANGLE_GUIDE_SETTINGS = {
    camera: {cameraAngle: REPLAY_INITIAL_CAMERA_ANGLE},
    userMode: REPLAY_USER_MODE_BASIC,
}
const getCropElementSnapshot = () => typeof document === 'undefined'
    ? null
    : document.getElementById(VIDEO_CROP_ZONE)
const getNoCropElementSnapshot = () => null
const subscribeToNoCropElement = () => () => {}

/**
 * Observe the mounted crop DOM node so a Replay guide created in the same React
 * commit as its cropper always receives the post-commit element reference.
 *
 * @param {Function} onChange - Notify React when the crop element is replaced.
 * @returns {Function} Observer cleanup callback.
 */
const subscribeToCropElement = onChange => {
    if (typeof document === 'undefined' || typeof globalThis.MutationObserver !== 'function') {
        return subscribeToNoCropElement()
    }
    // Widgets may mount through a portal outside the tools container.
    const observerRoot = document.body
    if (!observerRoot) {
        return subscribeToNoCropElement()
    }
    let currentElement = getCropElementSnapshot()
    const observer = new globalThis.MutationObserver(() => {
        const nextElement = getCropElementSnapshot()
        if (nextElement !== currentElement) {
            currentElement = nextElement
            onChange()
        }
    })
    observer.observe(observerRoot, {childList: true, subtree: true})
    return () => observer.disconnect()
}

/**
 * Mount the 3D camera guide during Replay preparation and animate it along the
 * trace during Basic or Expert playback.
 *
 * @returns {null} This component renders no DOM content.
 */
export const JourneyReplayCameraAngleGuide = () => {
    const video = useSnapshot(lgs.stores.ui.video)
    const drawers = useSnapshot(lgs.stores.ui.drawers)
    const replay = useSnapshot(lgs.stores.replay)
    const replaySettings = useOptionalSnapshot(lgs.settings?.ui?.replay, DEFAULT_REPLAY_ANGLE_GUIDE_SETTINGS)
    const journeySlug = useProxyValue(lgs.stores.main, main => main.theJourney?.slug ?? null, null)
    const cameraSettings = replaySettings.userMode === REPLAY_USER_MODE_BASIC
        ? replay.basicPreparationActive === true && replay.camera
            ? replay.camera
            : getBasicReplaySettings(replaySettings)?.camera ?? getJourneyReplaySettings().camera
        : replay.camera ?? replaySettings.camera
    const camera = normalizeJourneyReplayCamera(cameraSettings)
    const progression = normalizeJourneyReplayProgressionStyle(
        replay.progression ?? getJourneyReplaySettings().progression,
    )
    const routeFillColor = progression.fill.color
    const routeBorderColor = progression.border.color
    const cameraAngle = camera.cameraAngle
    const _cameraSettings = useRef(camera)
    const replaying = isJourneyReplayCameraActive(replay)
    const replaySample = replaying ? replay.liveSample ?? replay.sample : null
    const dryRunActive = isJourneyReplayDryRunActive(replay, video)
    const captureActive = video.preRecording !== true && (
        video.exporting === true
        || video.snapshot === true
        || video.finalizing === true
        || isJourneyReplayVideoCaptureActive()
    )
    const guideVisible = !captureActive
                         && !dryRunActive
                         && (video.editing === true || drawers.open === REPLAY_DRAWER || replaying)
    const isPreparingReplay = guideVisible
        && !replaying
        && (video.editing === true || drawers.open === REPLAY_DRAWER)
    const previewCesiumCamera = isPreparingReplay && video.editing === true
    const cropElement = useSyncExternalStore(
        isPreparingReplay ? subscribeToCropElement : subscribeToNoCropElement,
        isPreparingReplay ? getCropElementSnapshot : getNoCropElementSnapshot,
        getNoCropElementSnapshot,
    )

    useEffect(() => {
        _cameraSettings.current = camera
    }, [camera])

    /**
     * Persist camera-guide adjustments and apply them through Replay's camera controller.
     *
     * @param {Object} updates - Camera settings changed by the guide.
     * @returns {void}
     */
    const updateCameraFromGuide = useCallback((updates) => {
        const settings = lgs.settings.ui.replay
        const currentCamera = currentJourneyReplayCameraSettings()
        const nextCamera = normalizeJourneyReplayCamera({...currentCamera, ...updates})
        settings.camera = toGlobalReplayCameraSettings(nextCamera)
        if (settings.userMode === REPLAY_USER_MODE_BASIC) {
            lgs.settings.ui.replay = writeBasicReplaySettings(settings, {
                ...(getBasicReplaySettings(settings) ?? {}),
                camera: toGlobalReplayCameraSettings(nextCamera),
            })
            syncJourneyBasicReplayCamera(nextCamera)
        }
        else {
            syncJourneyExpertReplayCamera(nextCamera)
        }
        lgs.stores.replay.camera = nextCamera
        if (previewCesiumCamera) {
            __.ui.replay?.refreshCamera?.({
                sample:             lgs.stores.replay.sample ?? null,
                suppressMoveEvents: true,
                source:             'camera-angle-guide',
                preparation:        true,
            })
        }
        globalThis.window?.dispatchEvent?.(new Event(REPLAY_CAMERA_ANGLE_GUIDE_CHANGE_EVENT))
    }, [previewCesiumCamera])

    useEffect(() => {
        if (!isPreparingReplay) {
            return undefined
        }

        return fadeJourneyForReplayPreparation(lgs.viewer, lgs.stores.main.theJourney)
    }, [isPreparingReplay, journeySlug])

    useEffect(() => {
        const viewer = lgs.viewer
        if (!guideVisible) {
            removeJourneyReplayCameraAngleGuide(viewer)
            return undefined
        }

        const journey = lgs.stores.main.theJourney
        const guide = resolveJourneyReplayCameraAngleGuide({
            camera: _cameraSettings.current,
            journey,
            pois: lgs.stores.main.components?.pois?.list,
        })
        if (!mountJourneyReplayCameraAngleGuide(viewer, guide, {routeFillColor, routeBorderColor}, {
            onCameraChange: updateCameraFromGuide,
            cropElement,
            screenLocked: isPreparingReplay,
            previewCesiumCamera,
        })) {
            removeJourneyReplayCameraAngleGuide(viewer)
        }

        return () => removeJourneyReplayCameraAngleGuide(viewer)
    }, [cropElement, guideVisible, isPreparingReplay, journeySlug, routeBorderColor, routeFillColor, previewCesiumCamera, updateCameraFromGuide])

    useEffect(() => {
        if (!guideVisible) {
            return
        }

        const viewer = lgs.viewer
        const guide = resolveJourneyReplayCameraAngleGuide({
            camera: _cameraSettings.current,
            journey: lgs.stores.main.theJourney,
            pois: lgs.stores.main.components?.pois?.list,
            sample: replaySample,
        })
        if (!guide) {
            removeJourneyReplayCameraAngleGuide(viewer)
            return
        }
        const callbacks = {
            cropElement,
            onCameraChange: updateCameraFromGuide,
            previewCesiumCamera,
            routeBorderColor,
            routeFillColor,
        }
        if (!updateJourneyReplayCameraAngleGuide(viewer, guide, callbacks)) {
            mountJourneyReplayCameraAngleGuide(viewer, guide, {routeFillColor, routeBorderColor}, {
                onCameraChange: updateCameraFromGuide,
                cropElement,
                screenLocked: isPreparingReplay,
                previewCesiumCamera,
            })
        }
    }, [camera.altitude, cameraAngle, cropElement, guideVisible, isPreparingReplay, journeySlug, replaySample, routeBorderColor, routeFillColor, previewCesiumCamera, updateCameraFromGuide,
        replay.videoCropRect?.left, replay.videoCropRect?.top, replay.videoCropRect?.width, replay.videoCropRect?.height,
    ])

    return null
}
