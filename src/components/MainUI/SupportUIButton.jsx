/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SupportUIButton.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2024-06-26
 * Last modified: 2026-10-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaButton, WaIcon, WaTooltip } from '@awesome.me/webawesome/dist/react'
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
