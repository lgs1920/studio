/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WanderControlsWidget.jsx
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
import { LGS_TOOLBAR, WANDER_DRAWER } from '@Core/constants'
import { WANDER_LABEL } from '@Core/ui/wander/WanderProgressionStyle'
import { WaButton, WaCard, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import { memo, useCallback, useMemo } from 'react'
import { useSnapshot } from 'valtio'
import './style.css'

export const WanderControlsWidget = memo(() => {
    const wander = useSnapshot(lgs.stores.ui.mainUI.wander)

    const config = useMemo(() => ({
        id:             'wander-controls-widget',
        top:            '82%',
        left:           '50%',
        attachTo:       'bottom',
        opacity:        lgs.settings.ui.toolbars.opacity,
        type:           LGS_TOOLBAR,
        persist:        true,
        showControlBox: false,
        zIndex:         11800,
    }), [])

    const pause = useCallback(() => __.ui.wander?.pause(), [])
    const resume = useCallback(() => __.ui.wander?.resume(), [])
    const stop = useCallback(() => __.ui.wander?.stop(), [])
    const openSettings = useCallback(() => {
        __.ui.drawerManager.open(WANDER_DRAWER)
    }, [])

    if (!wander.active && !wander.paused) {
        return null
    }

    return (
        <Widget isVisible={true} config={config}>
            <WaCard className="wander-controls lgs--toolbar wa-theme-lgs1920-on-map">
                <WaIcon className="grabber" name="grip-dots-vertical"/>
                <span className="wander-controls-progress">{`${Math.round((wander.progress ?? 0) * 100)}%`}</span>

                {wander.playing ? (
                    <>
                        <WaTooltip for="wander-controls-pause">{`Pause ${WANDER_LABEL}`}</WaTooltip>
                        <WaButton id="wander-controls-pause" appearance="plain" variant="brand"
                                  onClick={pause}>
                            <WaIcon name="pause" variant="regular"/>
                        </WaButton>
                    </>
                ) : (
                     <>
                         <WaTooltip for="wander-controls-resume">{`Resume ${WANDER_LABEL}`}</WaTooltip>
                         <WaButton id="wander-controls-resume" appearance="plain" variant="brand"
                                   onClick={resume}>
                             <WaIcon name="play" variant="regular"/>
                         </WaButton>
                     </>
                 )}

                <WaTooltip for="wander-controls-settings">{`${WANDER_LABEL} settings`}</WaTooltip>
                <WaButton id="wander-controls-settings" appearance="plain" variant="brand"
                          onClick={openSettings}>
                    <WaIcon name="sliders" variant="regular"/>
                </WaButton>

                <WaTooltip for="wander-controls-stop">{`Stop ${WANDER_LABEL}`}</WaTooltip>
                <WaButton id="wander-controls-stop" appearance="plain" variant="brand"
                          onClick={stop}>
                    <WaIcon name="stop" variant="regular"/>
                </WaButton>
            </WaCard>
        </Widget>
    )
})
