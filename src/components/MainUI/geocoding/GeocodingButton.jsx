/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: GeocodingButton.jsx
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

import { faMapLocationDot }            from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                       from '@Utils/FA2SL.js'
import { WaButton, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import { useSnapshot }                 from 'valtio'


export const GeocodingButton = (props) => {
    const store = lgs.stores.main.components.geocoder
    const snap = useSnapshot(store)

    const handleClick = () => {
        store.dialog.visible = !store.dialog.visible

        __.ui.geocoder.init()
        store.list.clear()

        if (!store.dialog.visible) {
            document.getElementById('geocoder-search-location').value = ''
        }
        store.dialog.submitDisabled = true

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
