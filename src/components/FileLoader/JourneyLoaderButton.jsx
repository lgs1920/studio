/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyLoaderButton.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2024-06-28
 * Last modified: 2026-10-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import './style.css'
import { WaButton, WaIcon, WaTooltip } from '@awesome.me/webawesome/dist/react'

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
