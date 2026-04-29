/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetContextMenu.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-29
 * Last modified: 2026-04-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    CAMERA_INFORMATION_WIDGET, EDIT_WIDGET_ICON,
    WIDGET_EDITOR_POST_RENDER_EVENT, WIDGET_EDITOR_PRE_RENDER_EVENT, WIDGETS_CAPABILITIES, WIDGETS_EDITOR_DRAWER,
} from '@Core/constants'
import { WidgetDynamicRenderer } from '@Core/ui/widget-manager/dynamic-render/WidgetDynamicRender'
import { WaIcon, WaTooltip }     from '@web.awesome.me/webawesome-pro/dist/react'
import { useMemo } from 'react'
import { useSnapshot }           from 'valtio'

const PERCENTAGE = 0.1

/**
 * Renders the context menu for a specific widget.
 *
 * @param {Object} props
 * @param {string|number} props.targetId - Unique ID of the targeted widget
 * @param {React.RefObject} props.menuRef - Ref for the menu container
 */
export const WidgetContextMenu = ({targetId, menuRef}) => {
    // Shared store state
    const drawers = useSnapshot(lgs.stores.ui.drawers)
    const toolbars = useSnapshot(lgs.settings.ui.toolbars)

    // Core widget data
    const element = __.ui.widgetManager.getElementById(targetId)
    const config = __.ui.widgetManager.getWidgetConfig(targetId)

    // Memoized capabilities for performance
    const capabilities = useMemo(() => {
        if (!config?.contextMenu) {
            return {}
        }
        return {
            hasAny:      __.ui.widgetManager.hasCapabilities(config.contextMenu, WIDGETS_CAPABILITIES),
            canReset:    config.contextMenu.canReset,
            canEdit:     config.contextMenu.canEdit,
            canRemove:   config.contextMenu.canRemove,
            canPosition: config.contextMenu.canPosition,
        }
    }, [config])

    // Early return if widget is invalid
    if (!element || !config || !capabilities.hasAny) {
        return null
    }

    const closeMenu = () => __.ui.contextMenu.hide()

    /**
     * Triggers widget deletion and cleans up associated UI state
     */
    const removeWidget = () => {
        new WidgetDynamicRenderer().destroyWidget(targetId)

        if (targetId.split('#')[0] === CAMERA_INFORMATION_WIDGET) {
            lgs.settings.ui.camera.showPosition = false
            lgs.settings.ui.camera.showHPR = false
            lgs.settings.ui.camera.showTargetPosition = false
        }

        // Cleanup settings persistence
        const type = targetId.split('#')[0]
        const elements = lgs.settings.widgets[type]?.configuration?.elements
        if (elements && elements[targetId]) {
            delete elements[targetId]
        }

        element && __.ui.widgetManager.disposeElement(element)

        if (drawers.open === WIDGETS_EDITOR_DRAWER && drawers.entity === targetId) {
            __.ui.drawerManager.close()
        }

        closeMenu()
    }

    /**
     * Toggles or opens the editor drawer for the current entity
     */
    const editWidget = () => {
        const isCurrentlyEditing = drawers.open === WIDGETS_EDITOR_DRAWER && drawers.entity === targetId

        if (isCurrentlyEditing) {
            __.ui.drawerManager.close()
        }
        else {

            window.dispatchEvent(new CustomEvent(WIDGET_EDITOR_PRE_RENDER_EVENT, {
                detail: {entity: targetId},
            }))
            __.ui.drawerManager.open(WIDGETS_EDITOR_DRAWER, {
                action: 'edit-current',
                entity: targetId,
            })
            window.dispatchEvent(new CustomEvent(WIDGET_EDITOR_POST_RENDER_EVENT, {
                detail: {entity: targetId},
            }))

        }
        closeMenu()
    }

    /**
     * Handles relative scaling operations
     * @param {number} factor - Scale multiplier or 1 for reset
     */
    const resetSize = (factor) => {
        const widgetConfig = __.ui.widgetManager.getWidgetConfig(targetId)
        if (!widgetConfig) {
            return
        }
        const elementId = __.ui.widgetManager.retrieveElementId(element)
        const container = (widgetConfig.boundsContainer ?? widgetConfig.container).getBoundingClientRect()

        if (factor === 1) {
            widgetConfig.scale = {x: 1, y: 1}
        }
        else {
            widgetConfig.scale = __.ui.widgetManager.clampScale(
                {
                    x: widgetConfig.scale.x * (1 + factor),
                    y: widgetConfig.scale.y * (1 + factor),
                },
                widgetConfig,
            )
        }

        widgetConfig.scale = __.ui.widgetManager.adaptScaleToContainer(widgetConfig, container)
        widgetConfig.position = __.ui.widgetManager.adaptPositionToContainer(widgetConfig, container)

        if (widgetConfig.persist) {
            __.ui.widgetManager.saveWidgetPosition(elementId, widgetConfig)
        }

        __.ui.widgetManager.setScale(element, widgetConfig.scale.x, widgetConfig.scale.y)
        __.ui.widgetManager.applyPosition(element, widgetConfig.position)

        if (factor === 1) {
            closeMenu()
        }
    }

    const moveTo = (methodName) => {
        __.ui.widgetManager[methodName](element, lgs.gutter.xs)
        closeMenu()
    }

    return (
        <div className="lgs-context-menu widget-context-menu poi-on-map-menu  lgs-card wa-theme-lgs1920-on-map"
             ref={menuRef}
             style={{'--lgs-on-map-ui-opacity': toolbars.opacity}}>
            <ul>
                {/* Size controls */}
                {capabilities.canReset && (
                    <li className="widget-grid-one-line widget-no-hover buttons-bar-on-map">
                        <WaTooltip placement="top" for="compress-widget-context">{'Reset size'}</WaTooltip>
                        <WaIcon name="compress"
                                variant="regular"
                                id="compress-widget-context"
                                className="lgs-one-line-card wa-theme-lgs1920-on-map"
                                onClick={() => resetSize(1)}
                        />


                        <WaTooltip placement="top"
                                   for="shrink-widget-context">{`Shrink -${PERCENTAGE * 100}%`}</WaTooltip>
                        <WaIcon id="shrink-widget-context"
                                variant="regular"
                                name="arrow-down-left-and-arrow-up-right-to-center"
                                className="lgs-one-line-card wa-theme-lgs1920-on-map"
                                onClick={() => resetSize(-PERCENTAGE)}
                        />


                        <WaTooltip placement="top"
                                   for="expand-widget-context">{`Expand +${PERCENTAGE * 100}%`}</WaTooltip>
                        <WaIcon id="expand-widget-context"
                                variant="regular"
                                name="arrow-up-right-and-arrow-down-left-from-center"
                                className="lgs-one-line-card wa-theme-lgs1920-on-map"
                                onClick={() => resetSize(PERCENTAGE)}
                        />

                    </li>
                )}

                {/* Edit action - Only show if not already being edited in the current entity context */}
                {capabilities.canEdit && (drawers.open !== WIDGETS_EDITOR_DRAWER || drawers.entity !== targetId) && (
                    <li onClick={editWidget}>
                        <WaIcon name={EDIT_WIDGET_ICON} variant="regular"/>
                        <WaTooltip content="Edit Widget" placement="left"></WaTooltip>
                        <span>Edit</span>

                    </li>
                )}

                {/* Remove action */}
                {capabilities.canRemove && (
                    <li onClick={removeWidget}><WaIcon name="trash-can" variant="regular"/>{'Remove'}</li>
                )}

                {/* Positioning Grid */}
                {capabilities.canPosition && (
                    <li className="widget-grid-position widget-no-hover buttons-bar-on-map">
                        <WaIcon name="arrow-up-left" className="lgs-one-line-card wa-theme-lgs1920-on-map"
                                variant="regular"
                                onClick={() => moveTo('toTopLeft')}/>

                        <WaIcon name="arrow-up" className="lgs-one-line-card wa-theme-lgs1920-on-map"
                                variant="regular"
                                onClick={() => moveTo('toTop')}/>

                        <WaIcon name="arrow-up-right" className="lgs-one-line-card wa-theme-lgs1920-on-map"
                                variant="regular"
                                onClick={() => moveTo('toTopRight')}/>

                        <WaIcon name="arrow-left" className="lgs-one-line-card wa-theme-lgs1920-on-map"
                                variant="regular"
                                onClick={() => moveTo('toLeft')}/>

                        <WaIcon name="plus" className="lgs-one-line-card wa-theme-lgs1920-on-map"
                                variant="regular"
                                onClick={() => moveTo('toCenter')}/>

                        <WaIcon name="arrow-right" className="lgs-one-line-card wa-theme-lgs1920-on-map"
                                variant="regular"
                                onClick={() => moveTo('toRight')}/>

                        <WaIcon name="arrow-down-left" className="lgs-one-line-card wa-theme-lgs1920-on-map"
                                variant="regular"
                                onClick={() => moveTo('toBottomLeft')}/>

                        <WaIcon name="arrow-down" className="lgs-one-line-card wa-theme-lgs1920-on-map"
                                variant="regular"
                                onClick={() => moveTo('toBottom')}/>

                        <WaIcon name="arrow-down-right" className="lgs-one-line-card wa-theme-lgs1920-on-map"
                                variant="regular"
                                onClick={() => moveTo('toBottomRight')}/>

                    </li>
                )}
            </ul>
        </div>
    )
}
