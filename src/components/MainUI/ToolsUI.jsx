/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ToolsUI.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-10
 * Last modified: 2025-09-10
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/
import { CameraAndTargetPanel } from '@Components/cesium/CameraAndTargetPanel/CameraAndTargetPanel'
import { ContextMenuHook }      from '@Components/MainUI/ContextMenuHook'
import { VideoFPSSelector }     from '@Components/MainUI/video/VideoFPSSelector'
import { VideoQualitySelector } from '@Components/MainUI/video/VideoQualitySelector'
import { VideoRecorderToolbar } from '@Components/MainUI/video/VideoRecorderToolbar'
import { Cropper }              from '@Components/ToolsUI/cropper/Cropper'
import { CropRatioSelector }    from '@Components/ToolsUI/cropper/CropRatioSelector'
import { MapPOIContextMenu }    from '@Components/MainUI/MapPOI/MapPOIContextMenu'
import { VideoRecordingSettingsToolbar } from '@Components/MainUI/video/VideoRecordingSettingsToolbar'
import { JourneyToolbar }       from '@Editor/JourneyToolbar'
import { useSnapshot }          from 'valtio/index'

export const ToolsUI = () => {
    const {usage} = useSnapshot(lgs.settings.ui.journeyToolbar)
    const {video} = useSnapshot(lgs.stores.ui)
    return (
        <div id="lgs-tools-ui">
            {video.editing ? (
                <>
                    <Cropper
                        source={lgs.canvas}
                        store={lgs.stores.ui.video.cropper}
                        CTA={VideoRecordingSettingsToolbar}
                        RatioSelector={CropRatioSelector}
                        QualitySelector={VideoQualitySelector}
                        FPSSelector={VideoFPSSelector}
                    />
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