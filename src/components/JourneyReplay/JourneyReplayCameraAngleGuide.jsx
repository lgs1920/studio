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
 * Last modified: 2026-08-28
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
import {useOptionalSnapshot} from '@Utils/ValtioUtils'
import {useEffect} from 'react'
import {useSnapshot} from 'valtio'

const DEFAULT_REPLAY_ANGLE_GUIDE_SETTINGS = {
    camera: {headingOffset: 0, positionMode: REPLAY_CAMERA_POSITION_SYSTEM},
}

/**
 * Mount the 3D camera composition guide while replay camera settings are edited.
 *
 * @returns {null} This component renders no DOM content.
 */
export const JourneyReplayCameraAngleGuide = () => {
    const video = useSnapshot(lgs.stores.ui.video)
    const drawers = useSnapshot(lgs.stores.ui.drawers)
    const replaySettings = useOptionalSnapshot(lgs.settings?.ui?.replay, DEFAULT_REPLAY_ANGLE_GUIDE_SETTINGS)
    const main = useSnapshot(lgs.stores.main)
    const camera = normalizeJourneyReplayCamera(replaySettings.camera)
    const cameraHeadingOffset = camera.headingOffset
    const cameraPositionMode = camera.positionMode
    const editing = video.editing === true || drawers.open === REPLAY_DRAWER

    useEffect(() => {
        const viewer = lgs.viewer
        if (!editing || cameraPositionMode === REPLAY_CAMERA_POSITION_SYSTEM) {
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
    }, [cameraPositionMode, editing, main.theJourney])

    useEffect(() => {
        if (!editing || cameraPositionMode === REPLAY_CAMERA_POSITION_SYSTEM) {
            return
        }

        const viewer = lgs.viewer
        const guide = resolveJourneyReplayCameraAngleGuide({
            camera: {
                headingOffset: cameraHeadingOffset,
                positionMode:  cameraPositionMode,
            },
            journey: lgs.stores.main.theJourney,
        })
        if (!updateJourneyReplayCameraAngleGuide(viewer, guide)) {
            mountJourneyReplayCameraAngleGuide(viewer, guide)
        }
    }, [cameraHeadingOffset, cameraPositionMode, editing, main.theJourney])

    return null
}
