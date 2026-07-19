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
import { WidgetPreviewContext } from '@Components/MainUI/widgets/Widget'
import { VIDEO_WIDGETS_BOARD } from '@Core/constants'
import { memo, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSnapshot } from 'valtio'

export const VideoSceneWidgetsPortal = memo(({context, hidden = false}) => {
    const list = useSnapshot(lgs.stores.ui.widget.list)
    const video = useSnapshot(lgs.stores.ui.video)
    const previewOnly = video.editing === true && video.cropper?.widgetEditor === false
    const _rehydrateKey = useRef('')
    const _rehydrateFrame = useRef(null)
    const widgets = Array.from(list.entries())
        .filter(([, props]) => props?.widgetsBoard === VIDEO_WIDGETS_BOARD)
        .sort(([, a], [, b]) => (b.zIndex || 0) - (a.zIndex || 0))
    const widgetIds = widgets.map(([key]) => key).join('|')

    const boardElement = typeof document !== 'undefined'
                         ? (globalThis.__?.ui?.widgetManager?.resolveWidgetsBoardBoundsContainer?.(VIDEO_WIDGETS_BOARD) ??
                            document.querySelector(`#${VIDEO_WIDGETS_BOARD}.defined`))
                         : null
    const [boardReady, setBoardReady] = useState(false)

    useEffect(() => {
        if (!boardElement || typeof document === 'undefined') {
            setBoardReady(false)
            return
        }

        let cancelled = false
        const updateBoardReady = () => {
            if (cancelled) {
                return
            }

            const rect = boardElement.getBoundingClientRect?.()
            const ready = Boolean(rect && rect.width > 0 && rect.height > 0)
            setBoardReady(current => current === ready ? current : ready)
        }

        updateBoardReady()

        const observer = typeof ResizeObserver !== 'undefined'
                         ? new ResizeObserver(updateBoardReady)
                         : null
        observer?.observe(boardElement)

        return () => {
            cancelled = true
            observer?.disconnect()
        }
    }, [boardElement])

    useEffect(() => {
        if (!boardReady || hidden || !video.editing || widgets.length === 0) {
            return
        }

        const key = `${video.editing}-${boardReady}-${widgetIds}`
        if (_rehydrateKey.current === key) {
            return
        }
        _rehydrateKey.current = key

        __.ui.widgetManager.invalidateRuntimeByBoard(VIDEO_WIDGETS_BOARD)
        let cancelled = false
        let attempts = 0
        const expectedWidgets = widgets.length

        const rehydrate = async () => {
            const refreshed = Number(await __.ui.widgetManager.rehydrateWidgetsByBoard(VIDEO_WIDGETS_BOARD)) || 0
            if (cancelled || refreshed >= expectedWidgets || attempts >= 30) {
                return
            }
            attempts += 1
            _rehydrateFrame.current = requestAnimationFrame(rehydrate)
        }

        _rehydrateFrame.current = requestAnimationFrame(rehydrate)

        return () => {
            cancelled = true
            if (_rehydrateFrame.current) {
                cancelAnimationFrame(_rehydrateFrame.current)
                _rehydrateFrame.current = null
            }
        }
    }, [boardReady, hidden, video.editing, widgetIds, widgets.length])

    useEffect(() => {
        if (!video.editing) {
            return
        }

        return () => {
            __.ui.widgetManager.invalidateRuntimeByBoard(VIDEO_WIDGETS_BOARD)
        }
    }, [video.editing])

    if (hidden || typeof document === 'undefined' || widgets.length === 0 || !boardElement || !boardReady) {
        return null
    }

    return createPortal(
        <WidgetPreviewContext.Provider value={previewOnly}>
            <div
            className={`video-scene-widgets-portal${previewOnly ? ' video-scene-widgets-portal-preview' : ''}`}
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
            </div>
        </WidgetPreviewContext.Provider>,
        document.body,
    )
})

VideoSceneWidgetsPortal.displayName = 'VideoSceneWidgetsPortal'
