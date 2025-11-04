/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropRatioEditorWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-04
 * Last modified: 2025-11-04
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { Widget }         from '@Components/MainUI/Widget'
import {
    LGS_TOOLBAR, VIDEO_TOOLS_WIDGETS, MULTI_PURPOSE_WIDGETS, CROP_TOOLS_WIDGETS,
} from '@Core/constants'
import React, { useMemo } from 'react'
import { useSnapshot }            from 'valtio'
import { CropRatioEditorToolbar } from './CropRatioEditorToolbar'

/**
 * Component for selecting video quality with draggable toolbar
 * @component
 * @returns {JSX.Element} Draggable video quality selector UI
 */
export const CropRatioEditorWidget = ({context, id}) => {
    const video = useSnapshot(context)

    const config = useMemo(() => {
        return {
            left:     __.device.isMobile && __.device.isPortrait ? '85%' : '70%',
            top:      '50%',
            attachTo: 'right',
            opacity:  lgs.settings.ui.toolbars.opacity,
            type: LGS_TOOLBAR,
            id: id,
            group: CROP_TOOLS_WIDGETS,
        }
    }, [])

    return (
        <Widget isVisible={context.ratioEditor} config={config}>
            <CropRatioEditorToolbar context={context} cropzoneId={context.id}/>
        </Widget>
    )
}