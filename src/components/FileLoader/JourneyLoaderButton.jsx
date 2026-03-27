/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyLoaderButton.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-27
 * Last modified: 2026-03-27
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import './style.css'
import { WaButton, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import React                           from 'react'

export const JourneyLoaderButton = (props) => {


    const journeyLoaderStore = lgs.stores.ui.mainUI.journeyLoader

    const toggleVisibilityLoader = () => {
        journeyLoaderStore.visible = !journeyLoaderStore.visible
    }

    return (
        <>
            <WaTooltip placement={props.tooltip} for="create-new-journey-in-panel">{'Add a Journey'}</WaTooltip>
            <WaButton id="create-new-journey-in-panel"
                      className={props.className ?? ''}
                      appearance="plain"
                      variant="brand"
                      onClick={toggleVisibilityLoader}>

                <WaIcon name="circle-plus" variant="regular"/>
            </WaButton>

        </>
    )

}

