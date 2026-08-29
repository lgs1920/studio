/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TextButton.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-03-09
 * Last modified: 2026-03-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { SCENE_WIDGETS, SCENE_WIDGETS_BOARD } from '@Core/constants'
import { getNextTextWidgetPosition } from './textWidgetPosition'
import {
    WidgetDynamicRenderer,
}                                                                    from '@Core/ui/widget-manager/dynamic-render/WidgetDynamicRender'
import './style.css'
import { WaButton, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'

export const TextButton = (props) => {
    // Access the singleton correctly
    const renderer = WidgetDynamicRenderer.instance

    const addWidget = async () => {
        const position = getNextTextWidgetPosition()
        await renderer.renderWidget(SCENE_WIDGETS, 'text-widget', {
            options:      {},
            widgetsBoard: SCENE_WIDGETS_BOARD,
            ...position,
        })
    }

    return (<>
            <WaTooltip for="add-a-label" placement={props.tooltip}>{'Add Text'}</WaTooltip>
            <WaButton
                className="square-button"
                onClick={addWidget}
                variant={'brand'}
                appearance="Filled"
            >
                <WaIcon name="font" variant="regular"/>
            </WaButton>
        </>
    )
}
