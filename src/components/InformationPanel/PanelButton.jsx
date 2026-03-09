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

import { INFO_DRAWER }                 from '@Core/constants'
import { WaButton, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import React                           from 'react'
import './style.css'
import { useSnapshot }                 from 'valtio'

export const PanelButton = () => {
    const infoPanelStore = lgs.stores.ui.informationPanel
    const settings = useSnapshot(lgs.settings.ui.menu)

    return (<>
        <WaTooltip for="open-info-panel"
                   placement={settings.toolBar.fromStart ? 'right' : 'left'}>{'Show Information'}</WaTooltip>
        <WaButton className="square-button"
                  id="open-info-panel"
                  onClick={() => __.ui.drawerManager.toggle(INFO_DRAWER)}
                  variant={'brand'}
                  appearance="Filled">
            <WaIcon name="circle-info" variant="regular"></WaIcon>
        </WaButton>


    </>)
}
