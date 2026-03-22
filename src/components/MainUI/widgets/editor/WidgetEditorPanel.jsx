/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetEditorPanel.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-22
 * Last modified: 2026-03-18
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
import { SCENE_WIDGETS_BOARD, VIDEO_CROP_ZONE, WIDGETS_CONFIGURATION, WIDGETS_EDITOR_DRAWER } from '@Core/constants'
import {
    WidgetRegistry,
}                                                                                             from '@Core/ui/widget-manager/registry/WidgetRegistry'
import {
    faImage, faLayer,
}                                                                                             from '@fortawesome/pro-regular-svg-icons'
import {
    FontAwesomeIcon,
}                                                                                             from '@fortawesome/react-fontawesome'
import {
    SlIcon, SlTab, SlTabGroup, SlTabPanel,
}                   from '@shoelace-style/shoelace/dist/react'
import WaDrawer from '@Components/WaDrawerNonModal'
import { FA2SL }                                                                              from '@Utils/FA2SL'
import { Suspense, useCallback, useEffect, useMemo, useState }                                from 'react'
import { useSnapshot }                                                                        from 'valtio'
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
    const drawerPlacement = menuSettings.drawer
    const previewBg = widget.currentSnapshot?.image || null

    const closeEditor = useCallback((event) => {
        if (event && event.target.tagName !== 'WA-DRAWER') {
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
                const configIcon = WIDGETS_CONFIGURATION.get(type)?.icon

                setData({
                            type,
                            name:    theWidget.name,
                            description: theWidget.description,
                            icon:    FA2SL.set(configIcon),
                            rawIcon: configIcon,
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

    if (!isVisible) {
        return null
    }

    /**
     * Fallback UI for preview loading using FontAwesome native beat animation
     */
    const PreviewLoadingFallback = (
        <div className="lgs-preview-loader-container">
            {data.rawIcon && (
                <FontAwesomeIcon
                    icon={data.rawIcon}
                    beatFade
                    className="lgs-loader-beating-white"
                />
            )}
        </div>
    )

    return (
        <WaDrawer
                id={WIDGETS_EDITOR_DRAWER}
                label={data.name}
                open={isVisible}
                modal={false}
                className="lgs-theme"
                placement={drawerPlacement}
                onWaAfterHide={handleRequestClose}
                onSlHide={closeEditor}
            >
                <div slot="label" className="drawer-header-title">
                    <SlIcon library="fa" name={data.icon}/>
                    <span>{data.name}</span>
                </div>

                <div className="drawer-content lgs-editor-layout">
                    <div className="editor-header-zones">
                        <SlTabGroup className="editor-tabs">
                            <SlTab slot="nav" panel="preview">
                                <SlIcon size="small" library="fa" name={FA2SL.set(faImage)}/> Preview
                            </SlTab>
                            <SlTab slot="nav" panel="ordering">
                                <SlIcon size="small" library="fa" name={FA2SL.set(faLayer)}/> Widgets stack
                            </SlTab>

                            <SlTabPanel name="preview">
                                <section
                                    className="editor-preview-zone lgs-widget-preview"
                                    style={{'--lgs-widget-preview-bg': previewBg ? `url(${previewBg})` : 'none'}}
                                >
                                    <Suspense fallback={PreviewLoadingFallback}>
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
}
