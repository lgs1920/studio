/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetContextMenu.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-10
 * Last modified: 2026-05-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    EDIT_WIDGET_ICON, WIDGETS_CAPABILITIES, WIDGETS_EDITOR_DRAWER,
} from '@Core/constants'
import { WaButton, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import { useMemo } from 'react'
import { useSnapshot }           from 'valtio'

const PERCENTAGE = 0.1

const WidgetContextIconButton = ({id, icon, label, onClick}) => (
    <WaButton
        id={id}
        className="context-menu-icon-button widget-context-icon-button square-button"
        aria-label={label}
        appearance="outlined"
        variant="neutral"
        onClick={onClick}
    >
        <WaIcon name={icon} variant="regular"/>
    </WaButton>
)

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
    const canLock = config?.canLock ?? true
    const isLocked = canLock && Boolean(config?.locked)

    // Memoized capabilities for performance
    const capabilities = useMemo(() => {
        if (!config?.contextMenu) {
            return {
                hasAny:      canLock,
                canReset:    false,
                canEdit:     false,
                canRemove:   false,
                canPosition: false,
            }
        }
        return {
            hasAny:      canLock || __.ui.widgetManager.hasCapabilities(config.contextMenu, WIDGETS_CAPABILITIES),
            canReset:    config.contextMenu.canReset,
            canEdit:     config.contextMenu.canEdit,
            canRemove:   config.contextMenu.canRemove,
            canPosition: config.contextMenu.canPosition,
            canSnapshot: config.contextMenu.canSnapshot,
        }
    }, [canLock, config])

    // Early return if widget is invalid
    if (!element || !config || !capabilities.hasAny) {
        return null
    }

    const closeMenu = () => __.ui.contextMenu.hide()

    /**
     * Triggers widget deletion and cleans up associated UI state
     */
    const removeWidget = () => {
        void __.ui.widgetManager.removeWidget(targetId)
    }

    /**
     * Triggers widget snap
     */
    const snapWidget = () => {
        void __.ui.widgetManager.snapWidget(targetId)
    }

    /**
     * Toggles or opens the editor drawer for the current entity
     */
    const editWidget = () => {
        __.ui.widgetManager.editWidget(targetId, {toggle: true})
        closeMenu()
    }

    const toggleLocked = () => {
        const widgetConfig = __.ui.widgetManager.getWidgetConfig(targetId)
        if (!widgetConfig || widgetConfig.canLock === false) {
            return
        }

        const nextLocked = !widgetConfig.locked
        widgetConfig.locked = nextLocked
        __.ui.widgetManager.setConfig(targetId, widgetConfig)
        const currentEntry = lgs.stores.ui.widget.list.get(targetId) ?? {}
        lgs.stores.ui.widget.list.set(targetId, {...currentEntry, locked: nextLocked})

        if (nextLocked && lgs.stores.ui.widget.current?.id === targetId) {
            lgs.stores.ui.widget.current = {id: null}
        }
        else if (!nextLocked) {
            lgs.stores.ui.widget.current = {id: targetId}
        }

        if (widgetConfig.persist) {
            void __.ui.widgetManager.saveWidgetPosition(targetId, widgetConfig)
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
                {!isLocked && capabilities.canReset && (
                    <li className="widget-grid-one-line widget-no-hover buttons-bar-on-map">
                        <WaTooltip placement="top" for="compress-widget-context">{'Reset size'}</WaTooltip>
                        <WidgetContextIconButton
                            id="compress-widget-context"
                            icon="compress"
                            label="Reset size"
                            onClick={() => resetSize(1)}
                        />


                        <WaTooltip placement="top"
                                   for="shrink-widget-context">{`Shrink -${PERCENTAGE * 100}%`}</WaTooltip>
                        <WidgetContextIconButton
                            id="shrink-widget-context"
                            icon="arrow-down-left-and-arrow-up-right-to-center"
                            label={`Shrink -${PERCENTAGE * 100}%`}
                            onClick={() => resetSize(-PERCENTAGE)}
                        />


                        <WaTooltip placement="top"
                                   for="expand-widget-context">{`Expand +${PERCENTAGE * 100}%`}</WaTooltip>
                        <WidgetContextIconButton
                            id="expand-widget-context"
                            icon="arrow-up-right-and-arrow-down-left-from-center"
                            label={`Expand +${PERCENTAGE * 100}%`}
                            onClick={() => resetSize(PERCENTAGE)}
                        />

                    </li>
                )}

                {canLock && (
                    <li onClick={toggleLocked}>
                        <WaIcon name={isLocked ? 'unlock' : 'lock'} variant="regular"/>
                        <span>{isLocked ? 'Unlock' : 'Lock'}</span>
                    </li>
                )}

                {/* Edit action - Only show if not already being edited in the current entity context */}
                {!isLocked && capabilities.canEdit && (drawers.open !== WIDGETS_EDITOR_DRAWER || drawers.entity !== targetId) && (
                    <li onClick={editWidget}>
                        <WaIcon name={EDIT_WIDGET_ICON} variant="regular"/>
                        <WaTooltip content="Edit Widget" placement="left"></WaTooltip>
                        <span>Edit</span>

                    </li>
                )}

                {/* Snap action */}
                {!isLocked && capabilities.canSnapshot && (
                    <li onClick={snapWidget}><WaIcon name="camera" variant="regular"/>{'Snap'}</li>
                )}

                {/* Remove action */}
                {!isLocked && capabilities.canRemove && (
                    <li onClick={removeWidget}><WaIcon name="trash-can" variant="regular"/>{'Remove'}</li>
                )}

                {/* Positioning Grid */}
                {!isLocked && capabilities.canPosition && (
                    <li className="widget-grid-position widget-no-hover buttons-bar-on-map">
                        <WidgetContextIconButton icon="arrow-up-left" label="Move to top left"
                                                 onClick={() => moveTo('toTopLeft')}/>

                        <WidgetContextIconButton icon="arrow-up" label="Move to top"
                                                 onClick={() => moveTo('toTop')}/>

                        <WidgetContextIconButton icon="arrow-up-right" label="Move to top right"
                                                 onClick={() => moveTo('toTopRight')}/>

                        <WidgetContextIconButton icon="arrow-left" label="Move to left"
                                                 onClick={() => moveTo('toLeft')}/>

                        <WidgetContextIconButton icon="plus" label="Move to center"
                                                 onClick={() => moveTo('toCenter')}/>

                        <WidgetContextIconButton icon="arrow-right" label="Move to right"
                                                 onClick={() => moveTo('toRight')}/>

                        <WidgetContextIconButton icon="arrow-down-left" label="Move to bottom left"
                                                 onClick={() => moveTo('toBottomLeft')}/>

                        <WidgetContextIconButton icon="arrow-down" label="Move to bottom"
                                                 onClick={() => moveTo('toBottom')}/>

                        <WidgetContextIconButton icon="arrow-down-right" label="Move to bottom right"
                                                 onClick={() => moveTo('toBottomRight')}/>

                    </li>
                )}
            </ul>
        </div>
    )
}
