/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayControlsWidget.jsx
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

import { JourneyReplayProgressBar } from '@Components/JourneyReplay/JourneyReplayProgressBar'
import { Widget } from '@Components/MainUI/widgets/Widget'
import { LGS_TOOLBAR } from '@Core/constants'
import { WaCard } from '@web.awesome.me/webawesome-pro/dist/react'
import { memo, useMemo } from 'react'
import { useSnapshot } from 'valtio'
import './style.css'

export const JourneyReplayControlsWidget = memo(() => {
    const replay = useSnapshot(lgs.stores.replay)
    const video = useSnapshot(lgs.stores.ui.video)

    const config = useMemo(() => ({
        id:             'replay-controls-widget',
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

    if (replay.recordingSync === true
        || (video.preRecording || video.recording || video.snapshot || video.finalizing)
        || (!replay.toolbarVisible && !replay.active && !replay.paused)) {
        return null
    }

    return (
        <Widget isVisible={true} config={config}>
            <WaCard className="replay-controls lgs-toolbar-content lgs-toolbar lgs-toolbar-horizontal wa-theme-lgs1920-on-map">
                <JourneyReplayProgressBar showSettings/>
            </WaCard>
        </Widget>
    )
})
