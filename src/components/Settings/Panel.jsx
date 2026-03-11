/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Panel.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-11
 * Last modified: 2026-03-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import ThemeSelector                                                  from '@Components/ThemeSelector'
import { SETTINGS_EDITOR_DRAWER }                                     from '@Core/constants'
import { faPaintbrushPencil, faScrewdriverWrench }                    from '@fortawesome/pro-solid-svg-icons'
import { FA2SL }                                                      from '@Utils/FA2SL'
import { WaDrawer, WaIcon, WaTab, WaTabGroup, WaTabPanel, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import React                                                          from 'react'
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
        window.dispatchEvent(new Event('resize'))
        if (__.ui.drawerManager.isCurrent(SETTINGS_EDITOR_DRAWER)) {
            __.ui.drawerManager.close()
        }
    }

    return (
        <>
            {drawers.open === SETTINGS_EDITOR_DRAWER &&
                <div className={'drawer-wrapper'}>
                    <WaDrawer id="settings-pane"
                              placement={placement}
                              open={true}
                              onSlRequestClose={closePanel}
                              contained
                              className={'lgs-theme'}>
                        <ThemeSelector/>
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
                </div>
            }
        </>
    )
}
