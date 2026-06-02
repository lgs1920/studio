/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyLoaderButton.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-06
 * Last modified: 2026-04-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import './style.css'
import { WaButton, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'

export const JourneyLoaderButton = (props) => {


    const journeyLoaderStore = lgs.stores.ui.mainUI.journeyLoader
    const buttonId = props.id ?? 'create-new-journey-in-panel'
    const iconOnly = props.iconOnly || props.mini === true || props.mini === 'true'
    const className = [
        iconOnly ? 'square-button' : '',
        props.className ?? '',
    ].filter(Boolean).join(' ')

    const toggleVisibilityLoader = () => {
        journeyLoaderStore.visible = !journeyLoaderStore.visible
    }

    return (
        <>
            <WaTooltip placement={props.tooltip} for={buttonId}>{'Import journey'}</WaTooltip>
            <WaButton id={buttonId}
                      className={className}
                      appearance="filled-outlined"
                      variant="brand"
                      onClick={toggleVisibilityLoader}
                      aria-label="Import">
                <WaIcon name="file-import" variant="regular" slot={iconOnly ? undefined : 'start'}/>
                {!iconOnly && 'Import'}
            </WaButton>

        </>
    )

}
