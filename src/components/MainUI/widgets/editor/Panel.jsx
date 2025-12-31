/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Panel.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-31
 * Last modified: 2025-12-31
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { SCENE_WIDGETS_BOARD, WIDGETS_CONFIGURATION, WIDGETS_EDITOR_DRAWER } from '@Core/constants'
import {
    WidgetRegistry,
}                                                                            from '@Core/ui/widget-manager/registry/WidgetRegistry'
import { SlDrawer, SlIcon, SlSpinner }                         from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                               from '@Utils/FA2SL'
import { Suspense, useCallback, useEffect, useState, useMemo } from 'react'
import { useSnapshot }                                         from 'valtio'
import DrawerFooter                                            from '../../../DrawerFooter'
import './style.css'

/**
 * A memoized React component for rendering the Points of Interest (POI) editor panel.
 * @returns {JSX.Element|null} The rendered drawer panel
 */
export const Panel = () => {
    // Accessing global proxies
    const $ui = lgs.stores.ui
    const $drawers = $ui.drawers
    const $video = $ui.video

    // Snapshots
    const drawers = useSnapshot($drawers)
    const video = useSnapshot($video)
    const menuSettings = useSnapshot(lgs.editorSettingsProxy.menu)

    // Local state
    const [widgetPosition, setWidgetPosition] = useState(null)
    const [data, setData] = useState({name: '', description: '', icon: '', type: ''})
    const [EditorComponent, setEditorComponent] = useState(null)
    const cached = $ui.widget.cache.get(drawers.entity)
    const widgetRegistry = useMemo(() => new WidgetRegistry(), [])

    // Visibility logic
    const isVisible = drawers.open === WIDGETS_EDITOR_DRAWER && (video.editing || cached?.widgetsBoard === SCENE_WIDGETS_BOARD)
    const drawerPlacement = menuSettings.drawer

    /**
     * Close handler: updates the proxy store.
     */
    const closeEditor = useCallback((event) => {
        if (event && event.target.tagName !== 'SL-DRAWER') {
            return
        }
        if (__.ui.drawerManager.isCurrent(WIDGETS_EDITOR_DRAWER)) {
            __.ui.drawerManager.close()
        }
        $drawers.open = null
        window.dispatchEvent(new Event('resize'))
    }, [])

    /**
     * Handle Shoelace close requests.
     */
    const handleRequestClose = useCallback((event) => {
        if (event.detail.source === 'overlay') {
            event.preventDefault()
        }
        else {
            closeEditor()
        }
    }, [closeEditor])

    /**
     * Watcher for entity changes to load the correct widget editor.
     */
    useEffect(() => {

        if (drawers.entity) {
            if (isVisible) {
                if (cached) {
                    const type = drawers.entity.split('#')[0]
                    const theWidget = __.widgets.get(cached.group).widgets.get(type)

                    setData({
                                type,
                                name:        theWidget.name,
                                description: theWidget.description,
                                icon:        FA2SL.set(WIDGETS_CONFIGURATION.get(type)?.icon),
                            })

                    setWidgetPosition(__.ui.widgetManager.getWidgetPosition(drawers.entity))

                    // Using the specific naming convention (type + Editor)
                    const componentName = __.app.pascalCase(`${type}Editor`)
                    const LazyWidget = widgetRegistry.getLazyComponent(componentName)
                    setEditorComponent(() => LazyWidget)
                }
            }
        }
    }, [drawers.entity, isVisible, widgetRegistry, $ui.widget.cache])

    // If not visible, we don't render the wrapper to allow a fresh mount later.
    if (!isVisible) {
        return null
    }

    return (
        <div className="drawer-wrapper">
            <SlDrawer
                id={WIDGETS_EDITOR_DRAWER}
                label={data.name}
                open={isVisible}
                className="lgs-theme"
                placement={drawerPlacement}
                onSlRequestClose={handleRequestClose}
                onSlHide={closeEditor}
                contained
            >
                <div slot="label" className="drawer-header-title">
                    <SlIcon library="fa" name={data.icon}/>
                    <span>{data.name}</span>
                </div>

                <div className="drawer-content">
                    <Suspense fallback={
                        <div className="drawer-loader">
                            <SlSpinner style={{fontSize: '2rem'}}/>
                        </div>
                    }>
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

                <DrawerFooter slot="footer"/>
            </SlDrawer>
        </div>
    )
}