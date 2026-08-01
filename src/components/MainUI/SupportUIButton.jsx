/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SupportUIButton.jsx
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

import { faMessageQuestion }           from '@fortawesome/pro-regular-svg-icons'
import { FA2SL }                       from '@Utils/FA2SL.js'
import { WaButton, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import { useSnapshot }                 from 'valtio'


export const SupportUIButton = () => {
    const supportUIStore = lgs.stores.ui.mainUI.support
    const settings = useSnapshot(lgs.settings.ui.menu)

    return (
        <>
            <WaTooltip for="launch-the-support"
                       placement={settings.toolBar.fromStart ? 'right' : 'left'}
                       content="">{'Open Help'}</WaTooltip>
            <WaButton size={'s'} className="square-button" id="launch-the-support"
                      onClick={() => supportUIStore.visible = !supportUIStore.visible}
                      variant={'brand'}
                      appearance="Filled">
                <WaIcon name="message-question" variant="regular"/>
            </WaButton>

        </>
    )
}
