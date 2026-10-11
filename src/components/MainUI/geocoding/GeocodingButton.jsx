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
 * Last modified: 2026-10-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaButton, WaIcon, WaTooltip } from '@awesome.me/webawesome/dist/react'
import { useSnapshot }                 from 'valtio'


export const GeocodingButton = (props) => {
    const store = lgs.stores.main.components.geocoder
    const snap = useSnapshot(store)

    const resetDialogState = () => {
        __.ui.geocoder.init()
        store.list.clear()
        store.dialog.loading = false
        store.dialog.moreResults = false
        store.dialog.noResults = false
        store.dialog.error = false
        store.dialog.submitDisabled = true
    }

    const handleClick = () => {
        if (snap.dialog.visible) {
            resetDialogState()
            store.dialog.visible = false
            store.dialog.mounted = false
            return
        }

        __.ui.drawerManager.forceClose()
        resetDialogState()
        store.dialog.mounted = true
        store.dialog.visible = true
    }

    return (
        <>
            <WaTooltip for="launch-the-geocoder" placement={props.tooltip}>{'Search location'}</WaTooltip>
            <WaButton className="square-button"
                      id="launch-the-geocoder"
                      onClick={handleClick}
                      variant={'brand'}
                      appearance="Filled">
                <WaIcon name="map-location-dot" variant="regular"/>
            </WaButton>

        </>
    )
}
