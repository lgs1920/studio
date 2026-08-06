/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: PanelButton.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-03-09
 * Last modified: 2026-03-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LAYERS_DRAWER }               from '@Core/constants'
import { faLayerGroup }                from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import './style.css'
import { FA2SL }                       from '@Utils/FA2SL'
import { WaButton, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import { useSnapshot }                 from 'valtio'
//read version


export const PanelButton = (props) => {

    const mainStore = lgs.stores.main.components.layers
    const mainSnap = useSnapshot(mainStore)

    return (<>
            <WaTooltip for="open-the-layers-panel" placement={props.tooltip}>{'Select Layers'}</WaTooltip>
            <WaButton className="square-button"
                      id="open-the-layers-panel"
                      onClick={() => __.ui.drawerManager.toggle(LAYERS_DRAWER)}
                      key={mainSnap.key}
                      variant={'brand'}
                      appearance="Filled">
                <WaIcon name="layer-group" variant="regular"></WaIcon>
            </WaButton>
        </>
    )
}
