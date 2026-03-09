/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: PanelButton.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-09
 * Last modified: 2026-03-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { POIS_EDITOR_DRAWER }          from '@Core/constants'
import { faLocationDot }               from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                       from '@Utils/FA2SL.js'
import { WaButton, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import { useSnapshot }                 from 'valtio'


export const PanelButton = (props) => {
    const store = lgs.stores.main.components.pois.editor
    const snap = useSnapshot(store)

    const handleClick = () => {
        store.visible = !store.visible
    }
    return (
        <>
            <WaTooltip for="launch-the-pois" placement={props.tooltip}>{'Edit POIs'}</WaTooltip>
            <WaButton className="square-button"
                      id="launch-the-pois"
                      onClick={() => __.ui.drawerManager.toggle(POIS_EDITOR_DRAWER)}
                      variant={'brand'}
                      appearance="Filled">
                <WaIcon name="location-dot" variant="regular"/>
            </WaButton>
        </>
    )
}
