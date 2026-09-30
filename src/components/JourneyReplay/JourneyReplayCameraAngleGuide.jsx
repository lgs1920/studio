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
 * Last modified: 2026-09-30
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
    REPLAY_CAMERA_POSITION_SYSTEM,
} from '@Core/ui/replay/JourneyReplayProgressionStyle'
import {
    mountJourneyReplayCameraAngleGuide,
    removeJourneyReplayCameraAngleGuide,
    resolveJourneyReplayCameraAngleGuide,
    updateJourneyReplayCameraAngleGuide,
} from '@Core/ui/replay/JourneyReplayCameraAngleGuide'
import {fadeJourneyForReplayPreparation} from '@Core/ui/replay/JourneyReplayPreparationAppearance'
import {isJourneyReplayCameraActive, isJourneyReplayVideoCaptureActive} from '@Core/ui/replay/JourneyReplayRuntime'
import {
    REPLAY_USER_MODE_BASIC,
    REPLAY_USER_MODE_EXPERT,
    syncJourneyExpertReplayCamera,
    syncJourneySimpleReplayCamera,
} from '@Core/ui/replay/ReplayUserModes'
import {useOptionalSnapshot, useProxyValue} from '@Utils/ValtioUtils'
import {useCallback, useEffect} from 'react'
import {useSnapshot} from 'valtio'

const DEFAULT_REPLAY_ANGLE_GUIDE_SETTINGS = {
    camera: {headingOffset: 0, positionMode: REPLAY_CAMERA_POSITION_SYSTEM},
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
    const camera = normalizeJourneyReplayCamera(getJourneyReplaySettings().camera ?? replaySettings.camera)
    const cameraHeadingOffset = camera.headingOffset
    const cameraPositionMode = camera.positionMode
    const replaying = isJourneyReplayCameraActive(replay)
    const replaySample = replaying ? replay.liveSample ?? replay.sample : null
    const captureActive = video.preRecording !== true && (
        video.recordingHQ === true
        || video.snapshot === true
        || video.finalizing === true
        || isJourneyReplayVideoCaptureActive()
    )
    const guideVisible = !captureActive
                         && (video.editing === true || drawers.open === REPLAY_DRAWER || replaying)
    /**
     * Persist camera-guide adjustments without moving the Cesium camera.
     *
     * @param {Object} updates - Camera settings changed by the guide.
     * @returns {void}
     */
    const updateCameraFromGuide = useCallback((updates) => {
        const settings = lgs.settings.ui.replay
        const replaySettings = getJourneyReplaySettings()
        const nextCamera = normalizeJourneyReplayCamera({...replaySettings.camera, ...updates})
        settings.camera = nextCamera
        if (settings.userMode === REPLAY_USER_MODE_BASIC) {
            settings.simple = {...settings.simple, camera: nextCamera}
            syncJourneySimpleReplayCamera(nextCamera)
        }
        else {
            syncJourneyExpertReplayCamera(nextCamera)
        }
        lgs.stores.replay.camera = nextCamera
    }, [])

    useEffect(() => {
        const isPreparingReplay = guideVisible
            && !replaying
            && (video.editing === true || drawers.open === REPLAY_DRAWER)
            && [REPLAY_USER_MODE_BASIC, REPLAY_USER_MODE_EXPERT].includes(replaySettings.userMode)
        if (!isPreparingReplay) {
            return undefined
        }

        return fadeJourneyForReplayPreparation(lgs.viewer, lgs.stores.main.theJourney)
    }, [drawers.open, guideVisible, journeySlug, replaySettings.userMode, replaying, video.editing])

    useEffect(() => {
        const viewer = lgs.viewer
        if (!guideVisible || cameraPositionMode === REPLAY_CAMERA_POSITION_SYSTEM) {
            removeJourneyReplayCameraAngleGuide(viewer)
            return undefined
        }

        const journey = lgs.stores.main.theJourney
        const currentCamera = normalizeJourneyReplayCamera(getJourneyReplaySettings().camera)
        const guide = resolveJourneyReplayCameraAngleGuide({
            camera: {
                headingOffset: currentCamera.headingOffset,
                positionMode:  cameraPositionMode,
            },
            journey,
            pois: lgs.stores.main.components?.pois?.list,
        })
        if (!mountJourneyReplayCameraAngleGuide(viewer, guide, {}, {onCameraChange: updateCameraFromGuide})) {
            removeJourneyReplayCameraAngleGuide(viewer)
        }

        return () => removeJourneyReplayCameraAngleGuide(viewer)
    }, [cameraPositionMode, guideVisible, journeySlug, updateCameraFromGuide])

    useEffect(() => {
        if (!guideVisible || cameraPositionMode === REPLAY_CAMERA_POSITION_SYSTEM) {
            return
        }

        const viewer = lgs.viewer
        const guide = resolveJourneyReplayCameraAngleGuide({
            camera: {
                headingOffset: cameraHeadingOffset,
                positionMode:  cameraPositionMode,
            },
            journey: lgs.stores.main.theJourney,
            pois: lgs.stores.main.components?.pois?.list,
            sample: replaySample,
        })
        if (!guide) {
            removeJourneyReplayCameraAngleGuide(viewer)
            return
        }
        if (!updateJourneyReplayCameraAngleGuide(viewer, guide, {onCameraChange: updateCameraFromGuide})) {
            mountJourneyReplayCameraAngleGuide(viewer, guide, {}, {onCameraChange: updateCameraFromGuide})
        }
    }, [cameraHeadingOffset, cameraPositionMode, guideVisible, journeySlug, replaySample, updateCameraFromGuide])

    return null
}
