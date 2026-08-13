/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: PanelButton.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-01
 * Last modified: 2026-05-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { POIS_EDITOR_DRAWER }          from '@Core/constants'
import { WaButton, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import { useCallback } from 'react'


export const PanelButton = (props) => {
    const openPanel = useCallback(() => {
        __.ui.drawerManager.toggle(POIS_EDITOR_DRAWER, {
            suppressFocusOnOpen: lgs.stores.main.components.pois.current || false,
        })
    }, [])

    return (
        <>
            <WaTooltip for="launch-the-pois" placement={props.tooltip}>{'Edit POIs'}</WaTooltip>
            <WaButton className="square-button"
                      id="launch-the-pois"
                      onClick={openPanel}
                      variant={'brand'}
                      appearance="Filled">
                <WaIcon name="location-dot" variant="regular"/>
            </WaButton>
        </>
    )
}
