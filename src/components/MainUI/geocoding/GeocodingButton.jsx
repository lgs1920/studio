/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: GeocodingButton.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2025-01-19
 * Last modified: 2026-11-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaButton, WaIcon, WaTooltip } from '@awesome.me/webawesome/dist/react'
import { UI_ACTIONS } from '@Core/ui/metadata/uiActionCatalog'


export const GeocodingButton = (props) => {
    const store = lgs.stores.main.components.geocoder

    const resetDialogState = () => {
        __.ui.geocoder.init()
        store.list.clear()
        store.dialog.loading = false
        store.dialog.moreResults = false
        store.dialog.noResults = false
        store.dialog.error = false
        store.dialog.submitDisabled = true
    }

    /**
     * Toggle the geocoder using the live store state and let the dialog finish closing before unmount.
     * @returns {void} Nothing.
     */
    const handleClick = () => {
        if (store.dialog.visible) {
            resetDialogState()
            store.dialog.visible = false
            return
        }

        __.ui.drawerManager.forceClose()
        resetDialogState()
        store.dialog.mounted = true
        store.dialog.visible = true
    }

    return (
        <>
            <WaTooltip for="launch-the-geocoder" placement={props.tooltip}>{UI_ACTIONS.searchLocation.label}</WaTooltip>
            <WaButton className="square-button"
                      id="launch-the-geocoder"
                      onClick={handleClick}
                      variant={'brand'}
                      appearance="Filled">
                <WaIcon {...UI_ACTIONS.searchLocation.icon}/>
            </WaButton>

        </>
    )
}
