/**
 * Replay camera angle guide mounted on the interactive map.
 */

import {REPLAY_DRAWER} from '@Core/constants'
import {
    normalizeJourneyReplayCamera,
    REPLAY_CAMERA_POSITION_AHEAD,
    REPLAY_CAMERA_POSITION_SYSTEM,
} from '@Core/ui/replay/JourneyReplayProgressionStyle'
import {
    mountJourneyReplayCameraAngleGuide,
    removeJourneyReplayCameraAngleGuide,
    resolveJourneyReplayCameraAngleGuide,
} from '@Core/ui/replay/JourneyReplayCameraAngleGuide'
import {useOptionalSnapshot} from '@Utils/ValtioUtils'
import {useEffect} from 'react'
import {useSnapshot} from 'valtio'

const DEFAULT_REPLAY_ANGLE_GUIDE_SETTINGS = {
    camera: {headingOffset: 0, positionMode: REPLAY_CAMERA_POSITION_SYSTEM},
}
const REPLAY_CAMERA_ANGLE_GUIDE_COLORS = Object.freeze({
    ahead:  '#ff8a00',
    behind: '#22c55e',
})

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
                headingOffset: cameraHeadingOffset,
                positionMode:  cameraPositionMode,
            },
            journey,
        })
        const guideColor = cameraPositionMode === REPLAY_CAMERA_POSITION_AHEAD
            ? REPLAY_CAMERA_ANGLE_GUIDE_COLORS.ahead
            : REPLAY_CAMERA_ANGLE_GUIDE_COLORS.behind
        if (!mountJourneyReplayCameraAngleGuide(viewer, guide, {
            aheadColor:   guideColor,
            headingColor: guideColor,
        })) {
            removeJourneyReplayCameraAngleGuide(viewer)
        }

        return () => removeJourneyReplayCameraAngleGuide(viewer)
    }, [cameraHeadingOffset, cameraPositionMode, editing, main.theJourney])

    return null
}
