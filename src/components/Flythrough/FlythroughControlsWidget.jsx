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

import { Widget } from '@Components/MainUI/widgets/Widget'
import { LGS_TOOLBAR, FLYTHROUGH_DRAWER } from '@Core/constants'
import { FLYTHROUGH_LABEL } from '@Core/ui/flythrough/FlythroughProgressionStyle'
import { WaButton, WaCard, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import { memo, useCallback, useMemo } from 'react'
import { useSnapshot } from 'valtio'
import './style.css'

export const FlythroughControlsWidget = memo(() => {
    const flythrough = useSnapshot(lgs.stores.ui.mainUI.flythrough)

    const config = useMemo(() => ({
        id:             'flythrough-controls-widget',
        top:            '82%',
        left:           '50%',
        attachTo:       'bottom',
        opacity:        lgs.settings.ui.toolbars.opacity,
        type:           LGS_TOOLBAR,
        persist:        true,
        showControlBox: false,
        zIndex:         11800,
    }), [])

    const pause = useCallback(() => __.ui.flythrough?.pause(), [])
    const resume = useCallback(() => __.ui.flythrough?.resume(), [])
    const stop = useCallback(() => __.ui.flythrough?.stop(), [])
    const openSettings = useCallback(() => {
        __.ui.drawerManager.open(FLYTHROUGH_DRAWER)
    }, [])

    if (!flythrough.active && !flythrough.paused) {
        return null
    }

    return (
        <Widget isVisible={true} config={config}>
            <WaCard className="flythrough-controls lgs--toolbar wa-theme-lgs1920-on-map">
                <WaIcon className="grabber" name="grip-dots-vertical"/>
                <span className="flythrough-controls-progress">{`${Math.round((flythrough.progress ?? 0) * 100)}%`}</span>

                {flythrough.playing ? (
                    <>
                        <WaTooltip for="flythrough-controls-pause">{`Pause ${FLYTHROUGH_LABEL}`}</WaTooltip>
                        <WaButton id="flythrough-controls-pause" appearance="plain" variant="brand"
                                  onClick={pause}>
                            <WaIcon name="pause" variant="regular"/>
                        </WaButton>
                    </>
                ) : (
                     <>
                         <WaTooltip for="flythrough-controls-resume">{`Resume ${FLYTHROUGH_LABEL}`}</WaTooltip>
                         <WaButton id="flythrough-controls-resume" appearance="plain" variant="brand"
                                   onClick={resume}>
                             <WaIcon name="play" variant="regular"/>
                         </WaButton>
                     </>
                 )}

                <WaTooltip for="flythrough-controls-settings">{`${FLYTHROUGH_LABEL} settings`}</WaTooltip>
                <WaButton id="flythrough-controls-settings" appearance="plain" variant="brand"
                          onClick={openSettings}>
                    <WaIcon name="sliders" variant="regular"/>
                </WaButton>

                <WaTooltip for="flythrough-controls-stop">{`Stop ${FLYTHROUGH_LABEL}`}</WaTooltip>
                <WaButton id="flythrough-controls-stop" appearance="plain" variant="brand"
                          onClick={stop}>
                    <WaIcon name="stop" variant="regular"/>
                </WaButton>
            </WaCard>
        </Widget>
    )
})
