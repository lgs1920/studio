/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyToolbarWidget.jsx
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


import { Widget } from '@Components/MainUI/Widget'
import { LGS_TOOLBAR } from '@Core/constants'
import { JourneyToolbar }    from '@Editor/JourneyToolbar'
import React, { useMemo }    from 'react'
import { useSnapshot }       from 'valtio'

/**
 * Component for selecting video quality with draggable toolbar
 * @component
 * @returns {JSX.Element} Draggable video quality selector UI
 */
export const JourneyToolbarWidget = ({id}) => {

    const $journeyEditor = lgs.mainProxy.components.journeyEditor
    const journeyEditor = useSnapshot($journeyEditor)

    const $journeyToolbar = lgs.settings.ui.journeyToolbar
    const journeyToolbar = useSnapshot($journeyToolbar)

    // Stabilize config with useMemo
    const config = useMemo(() => {
        return {
            top:      '70%',
            opacity:  lgs.settings.ui.toolbars.opacity,
            left:     '50%',
            attachTo: 'bottom',
            type: LGS_TOOLBAR,
            id: id,
        }
    }, [])

    return (
        <Widget isVisible={journeyEditor.list.length > 0 && journeyToolbar.show}
                config={config} className="">
            <JourneyToolbar/>
        </Widget>
    )
}