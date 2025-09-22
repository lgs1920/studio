/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ToolsUI.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-22
 * Last modified: 2025-09-22
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/
import { CameraAndTargetPanel } from '@Components/cesium/CameraAndTargetPanel/CameraAndTargetPanel'
import { ContextMenuHook }      from '@Components/MainUI/ContextMenuHook'
import { VideoFPSSelector }     from '@Components/MainUI/video/VideoFPSSelector'
import { VideoFPSToolbar } from '@Components/MainUI/video/VideoFPSToolbar'
import { VideoQualitySelector } from '@Components/MainUI/video/VideoQualitySelector'
import { VideoRecorderToolbar } from '@Components/MainUI/video/VideoRecorderToolbar'
import { VideoSettingsInfo } from '@Components/MainUI/video/VideoSettingsInfo'
import { Cropper }              from '@Components/ToolsUI/cropper/Cropper'
import { CropRatioSelector }    from '@Components/ToolsUI/cropper/CropRatioSelector'
import { MapPOIContextMenu }    from '@Components/MainUI/MapPOI/MapPOIContextMenu'
import { VideoRecordingSettingsToolbar } from '@Components/MainUI/video/VideoRecordingSettingsToolbar'
import { JourneyToolbar }       from '@Editor/JourneyToolbar'
import { useSnapshot }          from 'valtio/index'

export const ToolsUI = () => {
    const {usage} = useSnapshot(lgs.settings.ui.journeyToolbar)
    const {video} = useSnapshot(lgs.stores.ui)
    const $cropper = lgs.stores.ui.video.cropper
    const cropper = useSnapshot($cropper)
    return (
        <div id="lgs-tools-ui">
            {video.editing ? (
                <>
                    <Cropper overlay source={lgs.canvas} store={$cropper}
                             options={{infoComponent: <VideoSettingsInfo/>}}/>
                    <VideoRecordingSettingsToolbar store={$cropper}/>
                    <VideoQualitySelector store={$cropper}/>
                    <VideoFPSSelector store={$cropper}/>
                </>
            ) : (
                 <>
                     {video.recording && <VideoRecorderToolbar/>}

                     <CameraAndTargetPanel/>
                     <MapPOIContextMenu/>
                     <ContextMenuHook/>
                     {usage && <JourneyToolbar/>}
                 </>
             )}
        </div>
    )
}