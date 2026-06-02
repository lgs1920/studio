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

import './style.css'
import { WaButton, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import { useSnapshot }                 from 'valtio'
import { SETTINGS_EDITOR_DRAWER } from '@Core/constants'

export const PanelButton = (props) => {

    const mainStore = lgs.stores.main.components.settings
    const mainSnap = useSnapshot(mainStore)

    return (<>
            <WaTooltip placement={props.tooltip} for="open-the-setting-panel">
                {'Open Settings Panel'}
            </WaTooltip>
            <WaButton className="square-button" id={'open-the-setting-panel'}
                       onClick={() => __.ui.drawerManager.toggle(SETTINGS_EDITOR_DRAWER)}
                      key={mainSnap.key}
                      variant={'brand'}
                      appearance="Filled">
                <WaIcon name="gear" variant="regular"/>
            </WaButton>
        </>
    )
}
