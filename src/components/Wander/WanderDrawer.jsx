/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WanderDrawer.jsx
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

import DrawerFooter from '@Components/DrawerFooter'
import PanelActions from '@Components/PanelsActions'
import WaDrawer     from '@Components/WaDrawerNonModal'
import { WANDER_DRAWER } from '@Core/constants'
import {
    WANDER_SCOPE_ALL_TRACKS, WANDER_SCOPE_CURRENT_TRACK, WANDER_SCOPE_VISIBLE_TRACKS,
} from '@Core/ui/wander/WanderPathSampler'
import {
    WaButton, WaIcon, WaInput, WaOption, WaSelect, WaSwitch,
} from '@web.awesome.me/webawesome-pro/dist/react'
import { memo, useCallback } from 'react'
import { createPortal }      from 'react-dom'
import { useSnapshot }       from 'valtio'
import './style.css'

const clampDuration = value => {
    const duration = Number(value)
    return Number.isFinite(duration) && duration > 0 ? duration : 60
}

export const WanderDrawer = memo(() => {
    const {drawers: {open: drawerOpen}} = useSnapshot(lgs.stores.ui)
    const wander = useSnapshot(lgs.stores.ui.mainUI.wander)
    const {drawer: drawerPlacement} = useSnapshot(lgs.editorSettingsProxy.menu)
    const hasJourney = Boolean(lgs.theJourney)

    const updateDuration = useCallback((event) => {
        lgs.stores.ui.mainUI.wander.duration = clampDuration(event.target.value)
    }, [])

    const updateScope = useCallback((event) => {
        lgs.stores.ui.mainUI.wander.scope = event.target.value
    }, [])

    const updateDirection = useCallback((event) => {
        lgs.stores.ui.mainUI.wander.direction = Number(event.target.value) < 0 ? -1 : 1
    }, [])

    const updateLoop = useCallback((event) => {
        lgs.stores.ui.mainUI.wander.loop = event.target.checked
    }, [])

    const start = useCallback(() => {
        __.ui.wander?.start()
    }, [])

    const pause = useCallback(() => {
        __.ui.wander?.pause()
    }, [])

    const resume = useCallback(() => {
        __.ui.wander?.resume()
    }, [])

    const stop = useCallback(() => {
        __.ui.wander?.stop()
    }, [])

    const handleRequestClose = useCallback((event) => {
        if (event.target.tagName !== 'WA-DRAWER') {
            event.preventDefault()
            return
        }
        __.ui.drawerManager.close()
    }, [])

    const closeDrawer = useCallback((event) => {
        if (window.isOK(event) && __.ui.drawerManager.isCurrent(WANDER_DRAWER)) {
            __.ui.drawerManager.close()
        }
    }, [])

    const drawerRoot = __.ui.drawerManager.drawerRoot
    const content = (
        <>
            {drawerOpen === WANDER_DRAWER &&
                <WaDrawer
                    id={WANDER_DRAWER}
                    open={true}
                    onWaAfterHide={handleRequestClose}
                    onSlAfterHide={closeDrawer}
                    placement={drawerPlacement}
                    className="wander-drawer"
                >
                    <span slot="label">{'Wander'}</span>
                    <PanelActions/>

                    <div className="wander-drawer-content">
                        {!hasJourney ? (
                            <p className="wander-empty-state">{'Import or select a journey to use Wander.'}</p>
                        ) : (
                             <>
                                 <div className="wander-fieldset">
                                     <WaInput
                                         label="Duration"
                                         size="small"
                                         type="number"
                                         min="1"
                                         value={wander.duration}
                                         onInput={updateDuration}
                                         withoutSpinButtons
                                     >
                                         <span slot="end">{'s'}</span>
                                     </WaInput>

                                     <WaSelect label="Scope" size="small" value={wander.scope}
                                               onChange={updateScope}>
                                         <WaOption value={WANDER_SCOPE_VISIBLE_TRACKS}>{'Visible tracks'}</WaOption>
                                         <WaOption value={WANDER_SCOPE_CURRENT_TRACK}>{'Current track'}</WaOption>
                                         <WaOption value={WANDER_SCOPE_ALL_TRACKS}>{'All tracks'}</WaOption>
                                     </WaSelect>

                                     <WaSelect label="Direction" size="small" value={String(wander.direction)}
                                               onChange={updateDirection}>
                                         <WaOption value="1">{'Forward'}</WaOption>
                                         <WaOption value="-1">{'Reverse'}</WaOption>
                                     </WaSelect>

                                     <WaSwitch size="xsmall" label-at-start checked={wander.loop}
                                               onInput={updateLoop}>
                                         {'Loop'}
                                     </WaSwitch>
                                 </div>

                                 <div className="wander-status">
                                     <span>{'Progress'}</span>
                                     <strong>{`${Math.round((wander.progress ?? 0) * 100)}%`}</strong>
                                 </div>

                                 <div className="wander-actions">
                                     {!wander.playing && !wander.paused &&
                                         <WaButton variant="brand" appearance="filled" onClick={start}>
                                             <WaIcon slot="start" name="play" variant="regular"/>
                                             {'Start'}
                                         </WaButton>
                                     }
                                     {wander.playing &&
                                         <WaButton variant="brand" appearance="outlined" onClick={pause}>
                                             <WaIcon slot="start" name="pause" variant="regular"/>
                                             {'Pause'}
                                         </WaButton>
                                     }
                                     {wander.paused &&
                                         <WaButton variant="brand" appearance="filled" onClick={resume}>
                                             <WaIcon slot="start" name="play" variant="regular"/>
                                             {'Resume'}
                                         </WaButton>
                                     }
                                     {(wander.active || wander.paused) &&
                                         <WaButton variant="neutral" appearance="outlined" onClick={stop}>
                                             <WaIcon slot="start" name="stop" variant="regular"/>
                                             {'Stop'}
                                         </WaButton>
                                     }
                                 </div>
                             </>
                         )}
                    </div>
                    <DrawerFooter/>
                </WaDrawer>
            }
        </>
    )

    return drawerRoot ? createPortal(content, drawerRoot) : content
})
