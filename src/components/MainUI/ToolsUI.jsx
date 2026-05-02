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
import { JourneyToolbarWidget }     from '@Editor/JourneyToolbarWidget'
import { useSnapshot }              from 'valtio/index'

export const ToolsUI = () => {
    const {usage} = useSnapshot(lgs.settings.ui.journeyToolbar)
    const {video} = useSnapshot(lgs.stores.ui)
    const $cropper = lgs.stores.ui.video.cropper

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
                    {usage && <JourneyToolbarWidget id="journey-toolbar-widget"/>}
                 </>
             )}

            <SceneWidgetsRenderer/>
        </div>
    )
}
