/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoSceneWidgetsPortal.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-28
 * Last modified: 2026-04-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { DynamicWidget } from '@Components/MainUI/widgets/DynamicWidget'
import { VIDEO_WIDGETS_BOARD } from '@Core/constants'
import { memo } from 'react'
import { createPortal } from 'react-dom'
import { useSnapshot } from 'valtio'

export const VideoSceneWidgetsPortal = memo(({context, hidden = false}) => {
    const list = useSnapshot(lgs.stores.ui.widget.list)
    const widgets = Array.from(list.entries())
        .filter(([, props]) => props?.widgetsBoard === VIDEO_WIDGETS_BOARD)
        .sort(([, a], [, b]) => (b.zIndex || 0) - (a.zIndex || 0))

    const boardElement = typeof document !== 'undefined'
                         ? document.querySelector(`#${VIDEO_WIDGETS_BOARD}.defined`)
                         : null

    if (hidden || typeof document === 'undefined' || widgets.length === 0 || !boardElement) {
        return null
    }

    return createPortal(
        <div
            className="video-scene-widgets-portal"
            data-widgets-board={VIDEO_WIDGETS_BOARD}
            style={{
                position: 'fixed',
                inset: '0',
                pointerEvents: 'none',
                zIndex: 'calc(var(--crop-zindex) + 2)',
            }}
        >
            {widgets.map(([key, props]) => (
                <div key={key} style={{pointerEvents: 'auto'}}>
                    <DynamicWidget
                        id={key}
                        props={props}
                        context={context}
                    />
                </div>
            ))}
        </div>,
        document.body,
    )
})

VideoSceneWidgetsPortal.displayName = 'VideoSceneWidgetsPortal'
