/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Panel.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-08
 * Last modified: 2026-04-08
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import DrawerFooter from '@Components/DrawerFooter'
import PanelActions                              from '@Components/PanelsActions'
import { LAYERS_DRAWER }          from '@Core/constants'
import WaDrawer                        from '@Components/WaDrawerNonModal'
import { WaButton, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import { createPortal }                from 'react-dom'
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
            if (!__.ui.drawerManager.isCurrent(LAYERS_DRAWER)) {
                return
            }
            window.dispatchEvent(new Event('resize'))
            __.ui.drawerManager.close()
        }
    }

    const drawerRoot = __.ui.drawerManager.drawerRoot
    const content = (
        <>
            {drawers.open === LAYERS_DRAWER &&
                <WaDrawer id={LAYERS_DRAWER}
                          open={true}
                          onWaHide={closePanel}
                          placement={placement}
                          className={'lgs-theme'}
                >
                    <div slot="label"><WaIcon name="layer-group" variant="regular"/>{'Map layers'}</div>
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
            }
        </>
    )

    return drawerRoot ? createPortal(content, drawerRoot) : content

}
