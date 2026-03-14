/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Panel.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-14
 * Last modified: 2026-03-14
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import DrawerFooter from '@Components/DrawerFooter'
import PanelActions                              from '@Components/PanelsActions'
import { LAYERS_DRAWER }          from '@Core/constants'
import { faCircleInfo }           from '@fortawesome/pro-regular-svg-icons'
import { SlIconButton }                          from '@shoelace-style/shoelace/dist/react'
import { WaButton, WaDrawer, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import React                                     from 'react'
import { useSnapshot }            from 'valtio'
import './style.css'
import { InfoLayerModal }         from './InfoLayerModal'
import { LayersAndTerrains }      from './LayersAndTerrains'

export const Panel = () => {
    const drawers = useSnapshot(lgs.stores.ui.drawers)
    const placement = useSnapshot(lgs.stores.editorSettings.menu).drawer
    const openInfoModal = () => lgs.stores.editorSettings.layer.infoDialog = true

    const closePanel = (event) => {
        if (window.isOK(event)) {
            window.dispatchEvent(new Event('resize'))
            if (__.ui.drawerManager.isCurrent(LAYERS_DRAWER)) {
                __.ui.drawerManager.close()
            }
        }
    }

    return (
        <>
            {drawers.open === LAYERS_DRAWER &&
            <div className={'drawer-wrapper'}>
                <WaDrawer id={LAYERS_DRAWER}
                          open={true}
                          onSlRequestClose={closePanel}
                          placement={placement}
                          contained
                          className={'lgs-theme'}>
                    <div slot={'label'}>{'Layers and Terrains'}</div>
                    <PanelActions>
                        <WaTooltip for="lgs-disclaimer-button" placement={'top'}>{'Disclaimer'}</WaTooltip>
                        <WaButton id="lgs-disclaimer-button" onClick={openInfoModal} appearance={'plain'}
                                  variant="brand">
                            <WaIcon name="bell-exclamation" variant="regular"/>
                        </WaButton>
                    </PanelActions>
                    <LayersAndTerrains/>
                    <DrawerFooter/>
                    <InfoLayerModal/>
                </WaDrawer>
            </div>
            }
        </>

    )
}
