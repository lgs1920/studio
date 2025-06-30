/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: PanelButton.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-30
 * Last modified: 2025-06-30
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { INFO_DRAWER }                 from '@Core/constants'
import { faCircleInfo }                from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                       from '@Utils/FA2SL'
import React                           from 'react'
import './style.css'
import { useSnapshot } from 'valtio'

export const PanelButton = () => {
    const infoPanelStore = lgs.stores.ui.informationPanel
    const settings = useSnapshot(lgs.settings.ui.menu)

    return (<>
        <SlTooltip hoist placement={settings.toolBar.fromStart ? 'right' : 'left'} content="Show Information">
            <SlButton className={'square-button'} size="small" id={'open-info-panel'}
                      onClick={() => __.ui.drawerManager.toggle(INFO_DRAWER)}>
                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faCircleInfo)}></SlIcon>
            </SlButton>
        </SlTooltip>

    </>)
}
