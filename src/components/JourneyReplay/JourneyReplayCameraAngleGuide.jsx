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
 * Last modified: 2026-10-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Replay camera angle guide mounted on the interactive map.
 */

import {REPLAY_DRAWER} from '@Core/constants'
import {
    getJourneyReplaySettings,
    normalizeJourneyReplayCamera,
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
    REPLAY_USER_MODE_EXPERT,
    syncJourneyExpertReplayCamera,
    syncJourneySimpleReplayCamera,
} from '@Core/ui/replay/ReplayUserModes'
import {useOptionalSnapshot, useProxyValue} from '@Utils/ValtioUtils'
import {useCallback, useEffect, useRef} from 'react'
import {useSnapshot} from 'valtio'

const DEFAULT_REPLAY_ANGLE_GUIDE_SETTINGS = {
    camera: {cameraAngle: REPLAY_INITIAL_CAMERA_ANGLE},
    userMode: REPLAY_USER_MODE_BASIC,
}

/**
 * Mount the 3D camera guide during Replay preparation and animate it along the
 * trace during Simple or Expert playback.
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
        ? replay.simplePreparationActive === true && replay.camera
            ? replay.camera
            : replaySettings.simple?.camera ?? getJourneyReplaySettings().camera
        : replay.camera ?? replaySettings.camera
    const camera = normalizeJourneyReplayCamera(cameraSettings)
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
        && [REPLAY_USER_MODE_BASIC, REPLAY_USER_MODE_EXPERT].includes(replaySettings.userMode)

    useEffect(() => {
        _cameraSettings.current = camera
    }, [camera])

    /**
     * Persist camera-guide adjustments without moving the Cesium camera.
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
            settings.simple = {...settings.simple, camera: toGlobalReplayCameraSettings(nextCamera)}
            syncJourneySimpleReplayCamera(nextCamera)
        }
        else {
            syncJourneyExpertReplayCamera(nextCamera)
        }
        lgs.stores.replay.camera = nextCamera
        globalThis.window?.dispatchEvent?.(new Event(REPLAY_CAMERA_ANGLE_GUIDE_CHANGE_EVENT))
    }, [])

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
        if (!mountJourneyReplayCameraAngleGuide(viewer, guide, {}, {
            onCameraChange: updateCameraFromGuide,
            screenLocked: isPreparingReplay,
        })) {
            removeJourneyReplayCameraAngleGuide(viewer)
        }

        return () => removeJourneyReplayCameraAngleGuide(viewer)
    }, [guideVisible, isPreparingReplay, journeySlug, updateCameraFromGuide])

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
        if (!updateJourneyReplayCameraAngleGuide(viewer, guide, {onCameraChange: updateCameraFromGuide})) {
            mountJourneyReplayCameraAngleGuide(viewer, guide, {}, {
                onCameraChange: updateCameraFromGuide,
                screenLocked: isPreparingReplay,
            })
        }
    }, [camera.altitude, cameraAngle, guideVisible, isPreparingReplay, journeySlug, replaySample, updateCameraFromGuide])

    return null
}
