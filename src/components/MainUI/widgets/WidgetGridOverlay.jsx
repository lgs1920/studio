/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetGridOverlay.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-16
 * Last modified: 2026-07-16
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    buildCenteredGridLines,
    DEFAULT_WIDGET_GRID_SETTINGS,
    getWidgetGridSettings,
} from '@Core/ui/widget-manager/widgetGridUtils'
import { WIDGET_LAYER_START } from '@Core/constants'
import { useOptionalSnapshot } from '@Utils/ValtioUtils'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

const EMPTY_RECT = null

const sameRect = (a, b) => (
    a?.left === b?.left &&
    a?.top === b?.top &&
    a?.width === b?.width &&
    a?.height === b?.height &&
    a?.right === b?.right &&
    a?.bottom === b?.bottom
)

const readBoardRect = widgetsBoard => {
    const board = __.ui.widgetManager.resolveWidgetsBoardContainer(widgetsBoard)
    const rect = board?.getBoundingClientRect?.()
    if (!rect || rect.width <= 0 || rect.height <= 0) {
        return EMPTY_RECT
    }

    return {
        left:   rect.left,
        top:    rect.top,
        right:  rect.right,
        bottom: rect.bottom,
        width:  rect.width,
        height: rect.height,
    }
}

export const WidgetGridOverlay = ({widgetsBoard}) => {
    const gridSnapshot = useOptionalSnapshot(lgs.settings?.ui?.widgets?.grid, DEFAULT_WIDGET_GRID_SETTINGS)
    const grid = useMemo(
        () => getWidgetGridSettings(gridSnapshot),
        [gridSnapshot.enabled, gridSnapshot.size],
    )
    const [rect, setRect] = useState(() => readBoardRect(widgetsBoard))

    useEffect(() => {
        if (!grid.enabled) {
            setRect(EMPTY_RECT)
            return
        }

        const board = __.ui.widgetManager.resolveWidgetsBoardContainer(widgetsBoard)
        if (!board) {
            setRect(EMPTY_RECT)
            return
        }

        let frame = null
        const updateRect = () => {
            if (frame !== null) {
                cancelAnimationFrame(frame)
            }
            frame = requestAnimationFrame(() => {
                frame = null
                const next = readBoardRect(widgetsBoard)
                setRect(current => sameRect(current, next) ? current : next)
            })
        }

        updateRect()

        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateRect) : null
        observer?.observe(board)
        window.addEventListener('resize', updateRect)

        return () => {
            if (frame !== null) {
                cancelAnimationFrame(frame)
            }
            observer?.disconnect()
            window.removeEventListener('resize', updateRect)
        }
    }, [grid.enabled, widgetsBoard])

    const lines = useMemo(
        () => rect ? buildCenteredGridLines(rect, grid.size) : {verticalGuidelines: [], horizontalGuidelines: []},
        [grid.size, rect],
    )

    if (!grid.enabled || !rect || typeof document === 'undefined') {
        return null
    }

    const zIndex = WIDGET_LAYER_START - 1

    return createPortal(
        <div
            className="lgs-widget-grid-overlay"
            aria-hidden="true"
            style={{
                left: `${rect.left}px`,
                top: `${rect.top}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
                zIndex,
            }}
        >
            {lines.verticalGuidelines.map((x) => (
                <span
                    key={`v-${x}`}
                    className="lgs-widget-grid-overlay-line lgs-widget-grid-overlay-line-vertical"
                    style={{left: `${x - rect.left}px`}}
                />
            ))}
            {lines.horizontalGuidelines.map((y) => (
                <span
                    key={`h-${y}`}
                    className="lgs-widget-grid-overlay-line lgs-widget-grid-overlay-line-horizontal"
                    style={{top: `${y - rect.top}px`}}
                />
            ))}
        </div>,
        document.body,
    )
}
