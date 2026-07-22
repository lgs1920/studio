/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ToolsUI.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-24
 * Last modified: 2026-04-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/
import { CameraAndTargetPanel }     from '@Components/cesium/CameraAndTargetPanel/CameraAndTargetPanel'
import { VideoPresetWidget } from '@Components/MainUI/video/toolbox/VideoPresetWidget'
import { VideoRecordingSettingsWidget } from '@Components/MainUI/video/toolbox/VideoRecordingSettingsWidget'
import { VideoSettingsInfo }    from '@Components/MainUI/video/VideoSettingsInfo'
import { SceneWidgetsRenderer } from '@Components/MainUI/widgets/SceneWidgetsRenderer'
import { WidgetContextMenu }    from '@Components/MainUI/widgets/WidgetContextMenu'
import { Cropper }           from '@Components/ToolsUI/cropper/Cropper'
import { VideoRecordingScreenArea } from '@Components/MainUI/video/VideoRecordingScreenArea'
import { JOURNEY_TOOLBAR_WIDGET }    from '@Core/constants'
import { JourneyToolbarWidget }     from '@Editor/JourneyToolbarWidget'
import { useEffect, useRef }        from 'react'
import { useSnapshot }              from 'valtio/index'

export const ToolsUI = () => {
    const {usage} = useSnapshot(lgs.settings.ui.journeyToolbar)
    const {video} = useSnapshot(lgs.stores.ui)
    const replay = useSnapshot(lgs.stores.replay)
    const $cropper = lgs.stores.ui.video.cropper
    const _journeyToolbarHiddenByVideoEditor = useRef(false)

    useEffect(() => {
        const linkedReplay = replay.recordingSync === true
            || lgs.settings?.ui?.replay?.recordingSync === true
        const videoEditing = video.editing === true
        const replayPlaying = replay.active || replay.playing || replay.paused

        if (linkedReplay && videoEditing && !_journeyToolbarHiddenByVideoEditor.current
            && !__.ui.replay?.isJourneyToolbarTemporarilyHidden?.()) {
            __.ui.replay?.hideJourneyToolbarVisibility?.()
            _journeyToolbarHiddenByVideoEditor.current = true
            return
        }

        if ((!linkedReplay || !videoEditing) && _journeyToolbarHiddenByVideoEditor.current && !replayPlaying) {
            __.ui.replay?.restoreJourneyToolbarVisibility?.()
            _journeyToolbarHiddenByVideoEditor.current = false
        }
    }, [replay.active, replay.paused, replay.playing, replay.recordingSync, video.editing])

    return (
        <div id="lgs-tools-ui">
            {video.editing ? (
                <>
                    <Cropper overlay source={lgs.canvas}
                             context={$cropper} className="video-cropper"
                             options={{infoComponent: <VideoSettingsInfo/>}}/>
                    <VideoPresetWidget id="video-preset-widget"/>
                    <VideoRecordingSettingsWidget id="video-recording-settings-widget"/>
                    <WidgetContextMenu/>
                </>
            ) : (

                <>
                    {(video.preRecording || video.recording || video.snapshot || video.finalizing) &&
                        <VideoRecordingScreenArea/>}
                    <CameraAndTargetPanel/>
                    {usage && <JourneyToolbarWidget id={JOURNEY_TOOLBAR_WIDGET}/>}
                 </>
             )}

            <SceneWidgetsRenderer/>
        </div>
    )
}
