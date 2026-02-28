/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: PanelButton.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-28
 * Last modified: 2026-02-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { faGear }                      from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import './style.css'
import { FA2SL }                       from '@Utils/FA2SL'
import { useSnapshot }                 from 'valtio'
import { SETTINGS_EDITOR_DRAWER } from '@Core/constants'
//read version


export const PanelButton = (props) => {

    const mainStore = lgs.stores.main.components.settings
    const mainSnap = useSnapshot(mainStore)

    return (
        <SlTooltip hoist placement={props.tooltip} content="Open Settings Panel">
            {<SlButton size={'small'} className={'square-button'} id={'open-the-setting-panel'}
                       onClick={() => __.ui.drawerManager.toggle(SETTINGS_EDITOR_DRAWER)}
                       key={mainSnap.key}>
                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faGear)}></SlIcon>
            </SlButton>}
        </SlTooltip>
    )
}
