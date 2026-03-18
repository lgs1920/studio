/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Panel.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-18
 * Last modified: 2026-03-18
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import PanelActions from '@Components/PanelsActions'
import ThemeSelector                                                  from '@Components/ThemeSelector'
import { SETTINGS_EDITOR_DRAWER }                                     from '@Core/constants'
import { faPaintbrushPencil, faScrewdriverWrench }                    from '@fortawesome/pro-solid-svg-icons'
import { FA2SL }                                                      from '@Utils/FA2SL'
import WaDrawer                                             from '@Components/WaDrawerNonModal'
import { WaIcon, WaTab, WaTabGroup, WaTabPanel, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import React                                                          from 'react'
import { createPortal }                                     from 'react-dom'
import { useSnapshot }                                                from 'valtio'
import './style.css'
import DrawerFooter                                                   from '../DrawerFooter'
import { GlobalSettings }                                             from './application/general/GlobalSettings'
import { ProfileTools }                                               from './application/profile/ProfileTools'
import { Style }                                                      from './application/style/Style'

export const Panel = () => {
    const drawers = useSnapshot(lgs.stores.ui.drawers)
    const openInfoModal = () => lgs.editorSettingsProxy.layer.infoDialog = true
    const placement = useSnapshot(lgs.stores.editorSettings.menu).drawer

    const closePanel = (event) => {
        if (event.target.tagName === 'WA-DRAWER') {
            window.dispatchEvent(new Event('resize'))
            if (__.ui.drawerManager.isCurrent(SETTINGS_EDITOR_DRAWER)) {
                __.ui.drawerManager.close()
            }
        }
    }
    const drawerRoot = __.ui.drawerManager.drawerRoot
    const content = (
        <>
            {drawers.open === SETTINGS_EDITOR_DRAWER &&
                    <WaDrawer id="settings-pane"
                              placement={placement}
                              open={true}
                              modal="false"
                              onWaAfterHide={closePanel}>
                        <PanelActions/>
                        <WaTabGroup>
                            <WaTab panel="tab-tools">
                                <WaIcon name="screwdriver-wrench" variant="regular"/> {'Global Settings'}
                            </WaTab>
                            <WaTab panel="tab-ui">
                                <WaIcon name="paintbrush-pencil" variant="regular"/>{'User Interface'}
                            </WaTab>
                            <WaTab panel="tab-user" id={'manage-user-profile'}>
                                <WaTooltip for="user-profile-tab" placement={'top'}>{'Manage My Profile'}</WaTooltip>
                                <WaIcon id="user-profile-tab" name="circle-user" variant={'solid'}/>
                            </WaTab>
                            <WaTabPanel name="tab-tools"><GlobalSettings/></WaTabPanel>
                            <WaTabPanel name="tab-ui"><Style/></WaTabPanel>
                            <WaTabPanel name="tab-user"><ProfileTools/></WaTabPanel>
                        </WaTabGroup>
                        <DrawerFooter/>
                    </WaDrawer>
            }
        </>
    )

    return drawerRoot ? createPortal(content, drawerRoot) : content

}
