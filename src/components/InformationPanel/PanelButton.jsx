/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: PanelButton.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2024-06-26
 * Last modified: 2026-11-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { INFO_DRAWER }                 from '@Core/constants'
import { UI_ICONS }                    from '@Core/ui/metadata/uiActionCatalog'
import { WaButton, WaIcon, WaTooltip } from '@awesome.me/webawesome/dist/react'
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
            <WaIcon {...UI_ICONS.info}/>
        </WaButton>


    </>)
}
