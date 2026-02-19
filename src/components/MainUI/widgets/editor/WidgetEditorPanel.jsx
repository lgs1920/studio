/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetEditorPanel.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-19
 * Last modified: 2026-02-19
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Panel.jsx
 *
 ******************************************************************************/

import { EditorSkeleton } from '@Components/MainUI/widgets/editor/EditorSkeleton'
import { SCENE_WIDGETS_BOARD, WIDGETS_CONFIGURATION, WIDGETS_EDITOR_DRAWER, VIDEO_CROP_ZONE } from '@Core/constants'
import {
    WidgetRegistry,
}                                                                                             from '@Core/ui/widget-manager/registry/WidgetRegistry'
import {
    WidgetsOrderingPanelContent,
}                                                                                             from '@Components/MainUI/widgets/ordering/WidgetsOrderingPanelContent'
import {
    faImage, faLayer,
}                                                                                             from '@fortawesome/pro-regular-svg-icons'
import {
    SlTabGroup, SlTab, SlTabPanel, SlDrawer, SlIcon, SlSpinner,
}                                                                                             from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                                              from '@Utils/FA2SL'
import { Suspense, useCallback, useEffect, useState, useMemo } from 'react'
import { useSnapshot }                                                                        from 'valtio'
import DrawerFooter
                                                                                              from '@Components/DrawerFooter'
import {
    LGSScrollbars,
}                                                                                             from '@Components/MainUI/LGSScrollbars'
import './style.css'

/**
 * Dynamic widget editor panel.
 * Uses a Tab Group to switch between the Widget Preview and the Ordering Panel.
 */
export const WidgetEditorPanel = () => {
    const $ui = lgs.stores.ui
    const $drawers = $ui.drawers
    const $video = $ui.video

    const ui = useSnapshot($ui)
    const drawers = useSnapshot($drawers)
    const video = useSnapshot($video)
    const menuSettings = useSnapshot(lgs.editorSettingsProxy.menu)

    const [widgetPosition, setWidgetPosition] = useState(null)
    const [data, setData] = useState({name: '', description: '', icon: '', type: ''})
    const [EditorComponent, setEditorComponent] = useState(null)
    const [PreviewComponent, setPreviewComponent] = useState(null)

    const cached = ui.widget.cache.get(drawers.entity)
    const widgetRegistry = useMemo(() => new WidgetRegistry(), [])

    const isVisible = drawers.open === WIDGETS_EDITOR_DRAWER && (video.editing || cached?.widgetsBoard === SCENE_WIDGETS_BOARD)
    const drawerPlacement = menuSettings.drawer

    const $widget = lgs.stores.ui.widget
    const widget = useSnapshot($widget)
    const previewBg = widget.currentSnapshot?.image || null

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
                            name:        theWidget.name,
                            description: theWidget.description,
                            icon:        FA2SL.set(WIDGETS_CONFIGURATION.get(type)?.icon),
                        })

                const pos = await __.ui.widgetManager.getWidgetPosition(drawers.entity)
                setWidgetPosition(pos)

                const editorName = __.app.pascalCase(`${type}Editor`)
                const LazyEditor = widgetRegistry.getLazyComponent(editorName)
                setEditorComponent(() => LazyEditor || null)

                const previewName = __.app.pascalCase(`${type}Preview`)
                const LazyPreview = widgetRegistry.getLazyComponent(previewName)
                setPreviewComponent(() => LazyPreview || null)
            }
        }
        resolveContent()
    }, [drawers.entity, isVisible, widgetRegistry, ui.widget.cache])

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

                <div className="drawer-content lgs-editor-layout">
                    <div className="editor-header-zones">
                        {/* 📑 Tab Group Replacement for Carousel */}
                        <SlTabGroup className="editor-tabs">
                            <SlTab slot="nav" panel="preview">
                                <SlIcon size="small" library="fa" name={FA2SL.set(faImage)}/> Preview
                            </SlTab>
                            <SlTab slot="nav" panel="ordering">
                                <SlIcon size="small" library="fa" name={FA2SL.set(faLayer)}/> Widgets stack
                            </SlTab>

                            <SlTabPanel name="preview">
                                <section className="editor-preview-zone lgs-widget-preview"
                                         style={{'--lgs-widget-preview-bg': previewBg ? `url(${previewBg})` : 'none'}}
                                >
                                    <Suspense fallback={<EditorSkeleton type="preview"/>}>
                                        {PreviewComponent ? (
                                            <PreviewComponent entity={drawers.entity} data={data}/>
                                        ) : (
                                             <div className="default-preview">
                                                 <SlIcon library="fa" name={data.icon}/>
                                             </div>
                                         )}
                                    </Suspense>
                                </section>
                            </SlTabPanel>

                            <SlTabPanel name="ordering">
                                <section className="editor-ordering-zone">
                                    <WidgetsOrderingPanelContent widgetsBoard={VIDEO_CROP_ZONE}/>
                                </section>
                            </SlTabPanel>
                        </SlTabGroup>
                    </div>

                    <div className="editor-body-zone">
                        <div className="editor-form-content">
                                <Suspense fallback={<SlSpinner/>}>
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
            </SlDrawer>
        </div>
    )
}