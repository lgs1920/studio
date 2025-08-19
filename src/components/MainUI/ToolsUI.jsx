/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ToolsUI.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-08-19
 * Last modified: 2025-08-19
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/
import { CameraAndTargetPanel } from '@Components/cesium/CameraAndTargetPanel/CameraAndTargetPanel'
import { ContextMenuHook }      from '@Components/MainUI/ContextMenuHook'
import { Cropper }              from '@Components/ToolsUI/cropper/Cropper'
import { CropRatioSelector }    from '@Components/ToolsUI/cropper/CropRatioSelector'
import { MapPOIContextMenu }    from '@Components/MainUI/MapPOI/MapPOIContextMenu'
import { VideoCropperToolbar }  from '@Components/MainUI/video/VideoCropperToolbar'
import { JourneyToolbar }       from '@Editor/JourneyToolbar'
import { useSnapshot }          from 'valtio/index'

export const ToolsUI = () => {
    const {show, usage} = useSnapshot(lgs.settings.ui.journeyToolbar)
    const {device, video} = useSnapshot(lgs.stores.ui)

    return (
        <div id="lgs-tools-ui">
            {video.edit ? (
                <>
                    <Cropper
                        source={lgs.canvas}
                        store={lgs.stores.ui.video.cropper}
                        CTA={VideoCropperToolbar}
                        RatioSelector={CropRatioSelector}
                    />
                </>
            ) : (
                 <>
                     <CameraAndTargetPanel/>
                     <MapPOIContextMenu/>
                     <ContextMenuHook/>
                     show && usage && <JourneyToolbar/>
                 </>
             )}
        </div>
    )
}