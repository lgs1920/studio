/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SupportUIButton.jsx
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

import { faMessageQuestion }           from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL } from '@Utils/FA2SL.js'
import { useSnapshot } from 'valtio'


export const SupportUIButton = () => {
    const supportUIStore = lgs.stores.ui.mainUI.support
    const settings = useSnapshot(lgs.settings.ui.menu)

    return (
        <>
            <SlTooltip hoist placement={settings.toolBar.fromStart ? 'right' : 'left'} content="Open Help">
                <SlButton size={'small'} className={'square-button'} id={'launch-the-support'}
                          onClick={() => supportUIStore.visible = !supportUIStore.visible}>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faMessageQuestion)}/>
                </SlButton>
            </SlTooltip>
        </>
    )
}
