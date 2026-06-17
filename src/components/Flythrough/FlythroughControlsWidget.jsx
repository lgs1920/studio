/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FlythroughControlsWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-04
 * Last modified: 2026-05-04
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { FlythroughProgressBar } from '@Components/Flythrough/FlythroughProgressBar'
import { Widget } from '@Components/MainUI/widgets/Widget'
import { LGS_TOOLBAR } from '@Core/constants'
import { WaCard } from '@web.awesome.me/webawesome-pro/dist/react'
import { memo, useMemo } from 'react'
import { useSnapshot } from 'valtio'
import './style.css'

export const FlythroughControlsWidget = memo(() => {
    const flythrough = useSnapshot(lgs.stores.flythrough)
    const video = useSnapshot(lgs.stores.ui.video)

    const config = useMemo(() => ({
        id:             'flythrough-controls-widget',
        top:            '82%',
        left:           '50%',
        attachTo:       'bottom',
        icon:           'video-arrow-up-right',
        opacity:        lgs.settings.ui.toolbars.opacity,
        type:           LGS_TOOLBAR,
        persist:        true,
        showControlBox: false,
        zIndex:         11800,
    }), [])

    if (flythrough.recordingSync === true
        || (video.preRecording || video.recording || video.snapshot || video.finalizing)
        || (!flythrough.toolbarVisible && !flythrough.active && !flythrough.paused)) {
        return null
    }

    return (
        <Widget isVisible={true} config={config}>
            <WaCard className="flythrough-controls lgs-toolbar-content lgs-toolbar lgs-toolbar-horizontal wa-theme-lgs1920-on-map">
                <FlythroughProgressBar showSettings/>
            </WaCard>
        </Widget>
    )
})
