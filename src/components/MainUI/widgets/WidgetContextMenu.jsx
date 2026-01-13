/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetContextMenu.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-13
 * Last modified: 2026-01-13
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { faRegularSquareCircleMinus, faRegularSquareCirclePlus } from '@awesome.me/kit-eb5c406148/icons/kit/custom'
import {
    WIDGET_EDITOR_POST_RENDER_EVENT, WIDGET_EDITOR_PRE_RENDER_EVENT, WIDGETS_CAPABILITIES, WIDGETS_EDITOR_DRAWER,
}                                                                from '@Core/constants'
import {
    WidgetDynamicRenderer,
}                                                                from '@Core/ui/widget-manager/dynamic-render/WidgetDynamicRender'
import {
    faArrowDown, faArrowDownLeft, faArrowDownRight, faArrowLeft, faArrowRight, faArrowUp, faArrowUpLeft, faArrowUpRight,
    faCompress, faPaintbrushPencil, faPlus, faTrashCan,
}                                                                from '@fortawesome/pro-regular-svg-icons'
import {
    SlIcon, SlTooltip,
}                                                                from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                 from '@Utils/FA2SL'
import React, { useMemo } from 'react'
import { useSnapshot }                                           from 'valtio'

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
        const elementId = __.ui.widgetManager.retrieveElementId(element)
        const container = config.container.getBoundingClientRect()

        if (factor === 1) {
            config.scale = {x: 1, y: 1}
        }
        else {
            config.scale = __.ui.widgetManager.clampScale(
                {
                    x: config.scale.x * (1 + factor),
                    y: config.scale.y * (1 + factor),
                },
                config,
            )
        }

        config.scale = __.ui.widgetManager.adaptScaleToContainer(config, container)
        config.position = __.ui.widgetManager.adaptPositionToContainer(config, container)

        if (config.persist) {
            __.ui.widgetManager.saveWidgetPosition(elementId, config)
        }

        __.ui.widgetManager.setScale(element, config.scale.x, config.scale.y)
        __.ui.widgetManager.applyPosition(element, config.position)

        if (factor === 1) {
            closeMenu()
        }
    }

    const moveTo = (methodName) => {
        __.ui.widgetManager[methodName](element, lgs.gutter.xs)
        closeMenu()
    }

    return (
        <div className="lgs-context-menu widget-context-menu lgs-card on-map" ref={menuRef}>
            <ul>
                {/* Size controls */}
                {capabilities.canReset && (
                    <li className="widget-grid-one-line widget-no-hover buttons-bar-on-map">
                        <SlTooltip content="Reset size" placement="top">
                            <SlIcon
                                library="fa"
                                name={FA2SL.set(faCompress)}
                                className="lgs-one-line-card on-map"
                                onClick={() => resetSize(1)}
                            />
                        </SlTooltip>

                        <SlTooltip content={`Shrink -${PERCENTAGE * 100}%`} placement="top">
                            <SlIcon
                                library="fa"
                                name={FA2SL.set(faRegularSquareCircleMinus)}
                                className="lgs-one-line-card on-map"
                                onClick={() => resetSize(-PERCENTAGE)}
                            />
                        </SlTooltip>

                        <SlTooltip content={`Expand +${PERCENTAGE * 100}%`} placement="top">
                            <SlIcon
                                library="fa"
                                name={FA2SL.set(faRegularSquareCirclePlus)}
                                className="lgs-one-line-card on-map"
                                onClick={() => resetSize(PERCENTAGE)}
                            />
                        </SlTooltip>
                    </li>
                )}

                {/* Edit action - Only show if not already being edited in the current entity context */}
                {capabilities.canEdit && (drawers.open !== WIDGETS_EDITOR_DRAWER || drawers.entity !== targetId) && (
                    <li onClick={editWidget}>
                        <SlIcon library="fa" name={FA2SL.set(faPaintbrushPencil)}/>
                        <SlTooltip content="Edit Widget" placement="left">
                            <span>Edit</span>
                        </SlTooltip>
                    </li>
                )}

                {/* Remove action */}
                {capabilities.canRemove && (
                    <li onClick={removeWidget}>
                        <SlIcon library="fa" name={FA2SL.set(faTrashCan)}/>
                        <SlTooltip content="Remove Widget" placement="left">
                            <span>Remove</span>
                        </SlTooltip>
                    </li>
                )}

                {/* Positioning Grid */}
                {capabilities.canPosition && (
                    <li className="widget-grid-position widget-no-hover buttons-bar-on-map">
                        <SlTooltip content="Top left">
                            <SlIcon library="fa" name={FA2SL.set(faArrowUpLeft)} className="lgs-one-line-card on-map"
                                    onClick={() => moveTo('toTopLeft')}/>
                        </SlTooltip>
                        <SlTooltip content="Top">
                            <SlIcon library="fa" name={FA2SL.set(faArrowUp)} className="lgs-one-line-card on-map"
                                    onClick={() => moveTo('toTop')}/>
                        </SlTooltip>
                        <SlTooltip content="Top right">
                            <SlIcon library="fa" name={FA2SL.set(faArrowUpRight)} className="lgs-one-line-card on-map"
                                    onClick={() => moveTo('toTopRight')}/>
                        </SlTooltip>
                        <SlTooltip content="Left">
                            <SlIcon library="fa" name={FA2SL.set(faArrowLeft)} className="lgs-one-line-card on-map"
                                    onClick={() => moveTo('toLeft')}/>
                        </SlTooltip>
                        <SlTooltip content="Center">
                            <SlIcon library="fa" name={FA2SL.set(faPlus)} className="lgs-one-line-card on-map"
                                    onClick={() => moveTo('toCenter')}/>
                        </SlTooltip>
                        <SlTooltip content="Right">
                            <SlIcon library="fa" name={FA2SL.set(faArrowRight)} className="lgs-one-line-card on-map"
                                    onClick={() => moveTo('toRight')}/>
                        </SlTooltip>
                        <SlTooltip content="Bottom left">
                            <SlIcon library="fa" name={FA2SL.set(faArrowDownLeft)} className="lgs-one-line-card on-map"
                                    onClick={() => moveTo('toBottomLeft')}/>
                        </SlTooltip>
                        <SlTooltip content="Bottom">
                            <SlIcon library="fa" name={FA2SL.set(faArrowDown)} className="lgs-one-line-card on-map"
                                    onClick={() => moveTo('toBottom')}/>
                        </SlTooltip>
                        <SlTooltip content="Bottom right">
                            <SlIcon library="fa" name={FA2SL.set(faArrowDownRight)} className="lgs-one-line-card on-map"
                                    onClick={() => moveTo('toBottomRight')}/>
                        </SlTooltip>
                    </li>
                )}
            </ul>
        </div>
    )
}