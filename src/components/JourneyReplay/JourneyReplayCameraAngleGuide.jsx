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
 * Last modified: 2026-09-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Replay camera angle guide mounted on the interactive map.
 */

import {REPLAY_DRAWER} from '@Core/constants'
import {
    normalizeJourneyReplayCamera,
    REPLAY_CAMERA_POSITION_SYSTEM,
} from '@Core/ui/replay/JourneyReplayProgressionStyle'
import {
    mountJourneyReplayCameraAngleGuide,
    removeJourneyReplayCameraAngleGuide,
    resolveJourneyReplayCameraAngleGuide,
    updateJourneyReplayCameraAngleGuide,
} from '@Core/ui/replay/JourneyReplayCameraAngleGuide'
import {isJourneyReplayVideoCaptureActive} from '@Core/ui/replay/JourneyReplayRuntime'
import {REPLAY_USER_MODE_BASIC, REPLAY_USER_MODE_EXPERT} from '@Core/ui/replay/ReplayUserModes'
import {useOptionalSnapshot, useProxyValue} from '@Utils/ValtioUtils'
import {useEffect} from 'react'
import {useSnapshot} from 'valtio'

const DEFAULT_REPLAY_ANGLE_GUIDE_SETTINGS = {
    camera: {headingOffset: 0, positionMode: REPLAY_CAMERA_POSITION_SYSTEM},
    userMode: REPLAY_USER_MODE_BASIC,
}

/**
 * Mount the 3D camera guide during Expert preparation and animate it along the
 * trace during interactive Replay.
 *
 * @returns {null} This component renders no DOM content.
 */
export const JourneyReplayCameraAngleGuide = () => {
    const video = useSnapshot(lgs.stores.ui.video)
    const drawers = useSnapshot(lgs.stores.ui.drawers)
    const replay = useSnapshot(lgs.stores.replay)
    const replaySettings = useOptionalSnapshot(lgs.settings?.ui?.replay, DEFAULT_REPLAY_ANGLE_GUIDE_SETTINGS)
    const journeySlug = useProxyValue(lgs.stores.main, main => main.theJourney?.slug ?? null, null)
    const camera = normalizeJourneyReplayCamera(replaySettings.camera)
    const cameraHeadingOffset = camera.headingOffset
    const cameraPositionMode = camera.positionMode
    const expertMode = replaySettings.userMode === REPLAY_USER_MODE_EXPERT
    const replaying = expertMode && replay.active === true
    const replaySample = replaying ? replay.liveSample ?? replay.sample : null
    const captureActive = video.preRecording !== true && (
        video.recordingHQ === true
        || video.snapshot === true
        || video.finalizing === true
        || isJourneyReplayVideoCaptureActive()
    )
    const guideVisible = !captureActive
                         && (video.editing === true || drawers.open === REPLAY_DRAWER || replaying)

    useEffect(() => {
        const viewer = lgs.viewer
        if (!expertMode || !guideVisible || cameraPositionMode === REPLAY_CAMERA_POSITION_SYSTEM) {
            removeJourneyReplayCameraAngleGuide(viewer)
            return undefined
        }

        const journey = lgs.stores.main.theJourney
        const guide = resolveJourneyReplayCameraAngleGuide({
            camera: {
                headingOffset: lgs.settings?.ui?.replay?.camera?.headingOffset ?? 0,
                positionMode:  cameraPositionMode,
            },
            journey,
        })
        if (!mountJourneyReplayCameraAngleGuide(viewer, guide)) {
            removeJourneyReplayCameraAngleGuide(viewer)
        }

        return () => removeJourneyReplayCameraAngleGuide(viewer)
    }, [cameraPositionMode, expertMode, guideVisible, journeySlug])

    useEffect(() => {
        if (!expertMode || !guideVisible || cameraPositionMode === REPLAY_CAMERA_POSITION_SYSTEM) {
            return
        }

        const viewer = lgs.viewer
        const guide = resolveJourneyReplayCameraAngleGuide({
            camera: {
                headingOffset: cameraHeadingOffset,
                positionMode:  cameraPositionMode,
            },
            journey: lgs.stores.main.theJourney,
            sample: replaySample,
        })
        if (!guide) {
            removeJourneyReplayCameraAngleGuide(viewer)
            return
        }
        if (!updateJourneyReplayCameraAngleGuide(viewer, guide)) {
            mountJourneyReplayCameraAngleGuide(viewer, guide)
        }
    }, [cameraHeadingOffset, cameraPositionMode, expertMode, guideVisible, journeySlug, replaySample])

    return null
}
