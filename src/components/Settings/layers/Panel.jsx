/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Panel.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-01
 * Last modified: 2025-07-01
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import DrawerFooter from '@Components/DrawerFooter'
import { LAYERS_DRAWER }          from '@Core/constants'
import { faCircleInfo }           from '@fortawesome/pro-regular-svg-icons'
import { SlDrawer, SlIconButton } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                  from '@Utils/FA2SL'
import React                      from 'react'
import { useSnapshot }            from 'valtio'
import './style.css'
import { InfoLayerModal }         from './InfoLayerModal'
import { LayersAndTerrains }      from './LayersAndTerrains'

export const Panel = () => {
    const drawers = useSnapshot(lgs.stores.ui.drawers)
    const openInfoModal = () => lgs.editorSettingsProxy.layer.infoDialog = true

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
            <div className={'drawer-wrapper'}>
                <SlDrawer id={LAYERS_DRAWER}
                          open={drawers.open === LAYERS_DRAWER}
                          onSlRequestClose={closePanel}
                          placement={useSnapshot(lgs.editorSettingsProxy.menu).drawer}
                          contained
                          className={'lgs-theme'}>
                    <div slot={'label'}>{'Layers and Terrains'}</div>
                    <SlIconButton onClick={openInfoModal} slot={'header-actions'} library="fa"
                                  name={FA2SL.set(faCircleInfo)}/>
                    <LayersAndTerrains/>
                    <DrawerFooter/>
                    <InfoLayerModal/>

                </SlDrawer>

            </div>
        </>

    )
}
