/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TextButton.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-07
 * Last modified: 2026-01-07
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { SCENE_WIDGETS, SCENE_WIDGETS_BOARD, WIDGETS_EDITOR_DRAWER } from '@Core/constants'
import {
    WidgetDynamicRenderer,
}                                                                    from '@Core/ui/widget-manager/dynamic-render/WidgetDynamicRender'
import { faText }                                                    from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip }                               from '@shoelace-style/shoelace/dist/react'
import './style.css'
import { FA2SL }                                                     from '@Utils/FA2SL'
import { useSnapshot }                                               from 'valtio'

export const TextButton = (props) => {
    const $main = lgs.stores.main
    const main = useSnapshot($main)

    // Access the singleton correctly
    const renderer = WidgetDynamicRenderer.instance

    const WIDGET_KEY = 'text-widget'
    const GROUP = SCENE_WIDGETS


    const addWidget = async () => {
        await renderer.renderWidget(SCENE_WIDGETS, 'text-widget', {
            options:      {},
            widgetsBoard: SCENE_WIDGETS_BOARD,
        })
    }

    return (
        <SlTooltip hoist placement={props.tooltip} content="Add a label">
            <SlButton
                size="small"
                className="square-button"
                id="add-a-label"
                onClick={addWidget}
            >
                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faText)}/>
            </SlButton>
        </SlTooltip>
    )
}