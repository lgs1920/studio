/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ToolsUI.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-10
 * Last modified: 2025-10-10
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/
import { CameraAndTargetPanel }     from '@Components/cesium/CameraAndTargetPanel/CameraAndTargetPanel'
import { ContextMenuHook }          from '@Components/MainUI/ContextMenuHook'
import { MapPOIContextMenu }            from '@Components/MainUI/MapPOI/MapPOIContextMenu'
import { VideoFPSWidget }               from '@Components/MainUI/video/toolbox/VideoFPSWidget'
import { VideoQualityWidget }           from '@Components/MainUI/video/toolbox/VideoQualityWidget'
import { VideoRecordingSettingsWidget } from '@Components/MainUI/video/toolbox/VideoRecordingSettingsWidget'
import { VideoSettingsInfo }            from '@Components/MainUI/video/VideoSettingsInfo'
import { CompassWidget } from '@Components/MainUI/video/widgets/CompassWidget'
import { Cropper }                  from '@Components/ToolsUI/cropper/Cropper'
import { VideoRecordingScreenArea } from '@Components/MainUI/video/VideoRecordingScreenArea'
import { VIDEO_CROP_ZONE }          from '@Core/constants'
import { JourneyToolbarWidget }     from '@Editor/JourneyToolbarWidget'
import React                        from 'react'
import { useSnapshot }              from 'valtio/index'

export const ToolsUI = () => {
    const {usage} = useSnapshot(lgs.settings.ui.journeyToolbar)
    const {video} = useSnapshot(lgs.stores.ui)
    const $cropper = lgs.stores.ui.video.cropper
    $cropper.id = VIDEO_CROP_ZONE
    return (
        <div id="lgs-tools-ui">
            {video.cropper.widgetEditor && <CompassWidget/>
            }
            {video.editing ? (
                <>
                    <Cropper overlay source={lgs.canvas}
                             context={$cropper} className="video-cropper"
                             options={{infoComponent: <VideoSettingsInfo/>}}/>
                    <VideoFPSWidget id="video-fps-widget"/>
                    <VideoQualityWidget id="video-quality-widget"/>
                    <VideoRecordingSettingsWidget id="video-recording-settings-widget"/>
                    <CompassWidget id="video-compass-element"/>
                </>
            ) : (

                <>
                    {video.recording && <VideoRecordingScreenArea/>}
                    <CameraAndTargetPanel/>
                     <MapPOIContextMenu/>
                     <ContextMenuHook/>
                    {usage && <JourneyToolbarWidget id="journey-toolbar-widget"/>}
                 </>
             )}
        </div>
    )
}