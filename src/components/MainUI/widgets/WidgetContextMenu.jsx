/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetContextMenu.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-12
 * Last modified: 2026-01-12
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WIDGETS_CAPABILITIES, WIDGETS_EDITOR_DRAWER } from '@Core/constants'
import {
    faRegularSquareCirclePlus,
    faRegularSquareCircleMinus,
}                                                      from '@awesome.me/kit-eb5c406148/icons/kit/custom'
import { WidgetDynamicRenderer } from '@Core/ui/widget-manager/dynamic-render/WidgetDynamicRender'
import {
    faArrowDown,
    faArrowDownLeft,
    faArrowDownRight,
    faArrowLeft,
    faArrowRight,
    faArrowUp,
    faArrowUpLeft,
    faArrowUpRight,
    faCompress,
    faPlus,
    faTrashCan,
    faPaintbrushPencil,
}                               from '@fortawesome/pro-regular-svg-icons'
import { SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                      from '@Utils/FA2SL'
import React, { useEffect, useState } from 'react'

const PERCENTAGE = 0.1

/**
 * Pure UI component that renders the context menu for a widget.
 * Receives only the widget ID (targetId) – no knowledge of positioning or visibility.
 * All actions close the global context menu via the shared store.
 *
 * @param {{ targetId: string | number }} props
 * @returns {JSX.Element|null} The menu markup or null if nothing can be shown
 */
export const WidgetContextMenu = ({targetId, menuRef}) => {
    // Retrieve DOM element and configuration for the targeted widget
    const element = __.ui.widgetManager.getElementById(targetId)
    const config = __.ui.widgetManager.getWidgetConfig(targetId)
    const [isEditing, setEditMode] = useState(false)
    const $drawers = lgs.stores.ui.drawers

    const hasCapabilities = config?.contextMenu ? __.ui.widgetManager.hasCapabilities(
        config.contextMenu,
        WIDGETS_CAPABILITIES,
    ) : false

    // Helper to close the global context menu (shared store)
    const closeMenu = () => {
        __.ui.contextMenu.hide()
    }

    /** Completely removes the widget from cache, store and DOM */
    const removeWidget = () => {
        new WidgetDynamicRenderer().destroyWidget(targetId)

        // remove from settings
        const type = targetId.split('#')[0]
        const elements = lgs.settings.widgets[type].configuration.elements
        if (elements && elements[targetId]) {
            delete elements[targetId]
        }

        // Remove from main DB
        element && __.ui.widgetManager.disposeElement(element)

        setEditMode(false)
        closeMenu()
    }

    /** Launch the widget editor */
    const editWidget = () => {
        __.ui.drawerManager.open(WIDGETS_EDITOR_DRAWER, {
            action: 'edit-current',
            entity: targetId,
        })
        closeMenu()
    }

    /**
     * Resizes the widget by a relative factor.
     * Factor = 1 → reset to original size.
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

        // Adapt scale & position to current container bounds
        config.scale = __.ui.widgetManager.adaptScaleToContainer(config, container)
        config.position = __.ui.widgetManager.adaptPositionToContainer(config, container)

        // Persist if needed
        if (config.persist) {
            __.ui.widgetManager.saveWidgetPosition(elementId, config)
        }

        // Apply visual changes
        __.ui.widgetManager.setScale(element, config.scale.x, config.scale.y)
        __.ui.widgetManager.applyPosition(element, config.position)

        if (factor === 1) {
            closeMenu()
        }
    }

    /** Moves the widget to one of the predefined snap positions */
    const moveTo = (methodName) => {
        __.ui.widgetManager[methodName](element, lgs.gutter.xs)
        closeMenu()
    }

    useEffect(() => {
        setEditMode($drawers.open === WIDGETS_EDITOR_DRAWER)
    }, [$drawers.open])

    // Early return AFTER all hooks if the widget no longer exists or has no context-menu config
    if (!element || !config?.contextMenu) {
        return null
    }

    // --------------------------------------------------------------------- //
    // Render
    // --------------------------------------------------------------------- //

    return (
        <div className="lgs-context-menu widget-context-menu lgs-card on-map" ref={menuRef}>
            <ul>
                {/* ----- Size controls ----- */}
                {hasCapabilities && config.contextMenu.canReset && (
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

                {/* ----- Edit widget ----- */}
                {hasCapabilities && config.contextMenu.canEdit && !isEditing && (
                    <li onClick={editWidget}>
                        <SlIcon library="fa" name={FA2SL.set(faPaintbrushPencil)}/>
                        <SlTooltip content="Edit Widget" placement="left">
                            <span>Edit</span>
                        </SlTooltip>
                    </li>
                )}

                {/* ----- Remove widget ----- */}
                {hasCapabilities && config.contextMenu.canRemove && !isEditing && (
                    <li onClick={removeWidget}>
                        <SlIcon library="fa" name={FA2SL.set(faTrashCan)}/>
                        <SlTooltip content="Remove Widget" placement="left">
                            <span>Remove</span>
                        </SlTooltip>
                    </li>
                )}

                {/* ----- Snap positioning grid ----- */}
                {hasCapabilities && config.contextMenu.canPosition && (
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