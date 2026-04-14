/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetEditorPanel.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-14
 * Last modified: 2026-04-14
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import DrawerFooter                                                                           from '@Components/DrawerFooter'
import {
    EditorSkeleton,
}                                                                                             from '@Components/MainUI/widgets/editor/EditorSkeleton'
import {
    WidgetsOrderingPanelContent,
}                                                                                             from '@Components/MainUI/widgets/ordering/WidgetsOrderingPanelContent'
import PanelActions
    from '@Components/PanelsActions'
import {
    CREDITS_WIDGET, SCENE_WIDGETS_BOARD, VIDEO_CROP_ZONE, WIDGET_LAYER_START, WIDGET_LAYER_STEP, WIDGETS_CONFIGURATION,
    WIDGETS_EDITOR_DRAWER,
}   from '@Core/constants'
import {
    WidgetRegistry,
}   from '@Core/ui/widget-manager/registry/WidgetRegistry'

import WaDrawer from '@Components/WaDrawerNonModal'
import {
    WaButton,
    WaIcon,
    WaTab,
    WaTabGroup,
    WaTabPanel, WaTooltip,
}                                                                     from '@web.awesome.me/webawesome-pro/dist/react'
import classNames                                                     from 'classnames'
import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal }                                               from 'react-dom'
import { useSnapshot }                                                from 'valtio'
import './style.css'

/**
 * Dynamic widget editor panel.
 * Orchestrates dynamic component loading and provides a tabbed interface for
 * previewing and ordering widgets.
 */
export const WidgetEditorPanel = () => {
    const $ui = lgs.stores.ui
    const $drawers = $ui.drawers
    const $video = $ui.video
    const $widget = lgs.stores.ui.widget

    const ui = useSnapshot($ui)
    const drawers = useSnapshot($drawers)
    const video = useSnapshot($video)
    const widget = useSnapshot($widget)
    const menuSettings = useSnapshot(lgs.editorSettingsProxy.menu)

    const [widgetPosition, setWidgetPosition] = useState(null)
    const [data, setData] = useState({name: '', description: '', icon: '', rawIcon: null, type: ''})
    const [EditorComponent, setEditorComponent] = useState(null)
    const [PreviewComponent, setPreviewComponent] = useState(null)

    const cached = ui.widget.cache.get(drawers.entity)
    const _widgetRegistry = useMemo(() => new WidgetRegistry(), [])

    const isVisible = drawers.open === WIDGETS_EDITOR_DRAWER && (video.editing || cached?.widgetsBoard === SCENE_WIDGETS_BOARD)
    // Check stacked state via manager instead of snapshot property
    const isStacked = __.ui.drawerManager.isStacked(WIDGETS_EDITOR_DRAWER)
    const drawerPlacement = menuSettings.drawer
    const previewBg = widget.currentSnapshot?.image || null

    /**
     * Closes the editor and handles the stack via the manager.
     */
    const closeEditor = useCallback((event) => {
        if (event && event.target.tagName !== 'WA-DRAWER') {
            return
        }

        if (__.ui.drawerManager.isCurrent(WIDGETS_EDITOR_DRAWER)) {
            __.ui.drawerManager.close()
        }
        else if (!isStacked) {
            $drawers.open = null
        }

        window.dispatchEvent(new Event('resize'))
    }, [isStacked, $drawers])

    /**
     * Prevents default shoelace close behavior to let the manager handle it.
     */
    const handleRequestClose = useCallback((event) => {
        const src = event.detail?.source
        if (src === 'close-button' || src === 'keyboard') {
            closeEditor()
            return
        }
        event.preventDefault()
    }, [closeEditor])

    useEffect(() => {
        const resolveContent = async () => {
            if (drawers.entity && isVisible && cached) {
                const type = drawers.entity.split('#')[0]
                const theWidget = __.widgets.get(cached.group).widgets.get(type)
                setData({
                            type,
                            name:    theWidget.name,
                            description: theWidget.description,
                            icon:    theWidget.icon,
                            rawIcon: theWidget.icon,
                        })

                const pos = await __.ui.widgetManager.getWidgetPosition(drawers.entity)
                setWidgetPosition(pos)

                const editorName = __.app.pascalCase(`${type}Editor`)
                const LazyEditor = _widgetRegistry.getLazyComponent(editorName)
                setEditorComponent(() => LazyEditor || null)

                const previewName = __.app.pascalCase(`${type}Preview`)
                const LazyPreview = _widgetRegistry.getLazyComponent(previewName)
                setPreviewComponent(() => LazyPreview || null)
            }
        }
        resolveContent()
    }, [drawers.entity, isVisible, _widgetRegistry, ui.widget.cache])

    /**
     * @description Retrieves and formats the list of active widgets for the current board
     * @returns {Array} Sorted list of active widget objects
     */
    const activeWidgetsList = useCallback(() => {
        // Safety check: if list or cached data is missing, return empty array
        if (!widget.list || !cached) {
            return []
        }

        return Array.from(widget.list.entries())
            .filter(([id, entry]) => {
                const _widgetType = id.split('#')[0]
                // Safe comparison with the current board
                return entry?.widgetsBoard === cached.widgetsBoard && _widgetType !== CREDITS_WIDGET
            })
            .map(([id, entry], index) => {
                const _widgetType = id.split('#')[0]
                const _instance = lgs.settings.widgets[_widgetType]
                if (!_instance) {
                    return null
                }

                const _cacheEntry = __.ui.widgetCache.get(id)
                const _currentZ = Number(entry?.zIndex ?? _cacheEntry?.zIndex)
                    || (WIDGET_LAYER_START + index * WIDGET_LAYER_STEP)

                return {
                    id,
                    zIndex: parseInt(_currentZ, 10),
                    type:   _widgetType,
                    fixed:  _instance.fixedPosition ?? false,
                }
            })
            .filter(Boolean)
            .sort((a, b) => b.zIndex - a.zIndex)
    }, [widget.list, cached]) // Use 'cached' as a dependency to react to any change

    const activeWidgets = useMemo(() => activeWidgetsList(), [activeWidgetsList])

    if (!isVisible) {
        return null
    }

    /**
     * Fallback UI for preview loading
     */
    const PreviewLoadingFallback = (
        <div className="lgs-preview-loader-container">
            {data.rawIcon && (
                <WaIcon name={data.rawIcon} beatFade className="lgs-loader-beating-white"/>
            )}
        </div>
    )

    const drawerRoot = __.ui.drawerManager.drawerRoot
    const content = (
        <WaDrawer
            id={WIDGETS_EDITOR_DRAWER}
            label={data.name}
            open={isVisible}
            modal={false}
            className={classNames({'drawer-is-stacked': isStacked})}
            placement={drawerPlacement}
            onWaAfterHide={handleRequestClose}
            onWaHide={closeEditor}
        >
            {lgs.stores.ui.widget.list.size > 1 &&

                <div slot="label" className="drawer-header-title">
                <WaIcon name={data.icon}/>
                <span>{data.name}</span>
            </div>
            }
            <PanelActions stackedPanel={isStacked}/>

            <div className="drawer-content lgs-editor-layout">
                <div className="editor-header-zones">
                    <WaTabGroup className="editor-tabs">
                        <WaTab slot="nav" panel="preview">
                            <WaIcon size="small" name="image"/> Preview
                        </WaTab>

                        {activeWidgets.length > 1 &&
                        <WaTab slot="nav" panel="ordering">
                            <WaIcon size="small" name="layer"/> Widgets stack
                        </WaTab>
                        }

                        <WaTabPanel name="preview">
                            <section
                                className="editor-preview-zone lgs-widget-preview"
                                style={{'--lgs-widget-preview-bg': previewBg ? `url(${previewBg})` : 'none'}}
                            >
                                <Suspense fallback={PreviewLoadingFallback}>
                                    {PreviewComponent ? (
                                        <PreviewComponent entity={drawers.entity} data={data}/>
                                    ) : (
                                         <div className="default-preview">
                                             <WaIcon library="fa" name={data.icon}/>
                                         </div>
                                     )}
                                </Suspense>
                            </section>
                        </WaTabPanel>
                        {activeWidgets.length > 1 &&
                        <WaTabPanel name="ordering">
                            <section className="editor-ordering-zone">
                                <WidgetsOrderingPanelContent widgetsBoard={cached.widgetsBoard}/>
                            </section>
                        </WaTabPanel>
                        }
                    </WaTabGroup>
                </div>

                <div className="editor-body-zone">
                    <div className="editor-form-content">
                        <Suspense fallback={<EditorSkeleton type="preview"/>}>
                            {EditorComponent ? (
                                <EditorComponent
                                    entity={drawers.entity}
                                    widgetData={data}
                                    position={widgetPosition}
                                />
                            ) : (
                                 <div className="error-placeholder">
                                     Component for "{data.type}" not found.
                                 </div>
                             )}
                        </Suspense>
                    </div>
                </div>
            </div>
            <DrawerFooter slot="footer"/>
        </WaDrawer>
    )
    return drawerRoot ? createPortal(content, drawerRoot) : content

}