/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetContextMenu.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-21
 * Last modified: 2025-10-21
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { WIDGETS_CAPABILITIES }       from '@Core/constants'
import { faArrowsRotate, faTrashCan } from '@fortawesome/pro-regular-svg-icons'
import { SlIcon }                     from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                      from '@Utils/FA2SL'
import React, { useEffect, useRef }   from 'react'
import Timeout                        from 'smart-timeout'
import { useSnapshot }                from 'valtio'

/**
 * WidgetContextMenu component renders a context menu for a widget with configurable actions.
 * The menu is displayed based on the widget's capabilities and configuration.
 * If hasCapabilities is false, the context menu is disabled.
 *
 * @returns {JSX.Element | null} The context menu component or null if not displayed.
 */
export const WidgetContextMenu = () => {
    const _anchor = useRef(null)
    const $widget = lgs.stores.ui.widget
    const {id, canDisplayContextMenu, timer, position} = useSnapshot($widget)
    const element = __.ui.widgetManager.getElementById(id)
    const config = __.ui.widgetManager.getWidgetConfig(id)

    // Close menu when clicking outside
    useEffect(() => {
        if (!canDisplayContextMenu) {
            return
        }

        const handleClickOutside = (event) => {
            if (_anchor.current && !_anchor.current.contains(event.target)) {
                $widget.canDisplayContextMenu = false
            }
        }

        // Add listener on next tick to avoid immediate close
        setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside)
        }, 0)

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [canDisplayContextMenu])

    /**
     * Handles the removal of the widget.
     */
    const handleRemove = () => {
        __.ui.widgetManager.disposeElement(element)
        $widget.canDisplayContextMenu = false
    }

    /**
     * Resets the widget to its original size.
     */
    const handleResetSize = () => {
        if (config?.id) {
            const originalConfig = __.ui.widgetManager.getWidgetConfig(id)
            if (originalConfig) {
                element.style.width = `${originalConfig.width}px`
                element.style.height = `${originalConfig.height}px`
            }
        }
        $widget.canDisplayContextMenu = false
    }

    // If the menu cannot be displayed or capabilities are not met, return null
    if (!canDisplayContextMenu || !__.ui.widgetManager.hasCapabilities(config?.contextMenu, WIDGETS_CAPABILITIES)) {
        return null
    }

    return (
        <div
            ref={_anchor}
            className="lgs-context-menu widget-context-menu lgs-card on-map"
            style={{top: position.y - 10, left: position.x - 10}}
            onPointerLeave={() => {
                if (timer) {
                    Timeout.restart(timer)
                }
            }}
            onPointerEnter={() => {
                if (timer) {
                    Timeout.pause(timer)
                }
            }}
        >
            <ul>
                {config.contextMenu.canRemove && (
                    <li key="remove-from-video" onClick={handleRemove}>
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faTrashCan)}/>
                        <span>Remove</span>
                    </li>
                )}
                {config.contextMenu.canReset && (
                    <li key="reset-size" onClick={handleResetSize}>
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faArrowsRotate)}/>
                        <span>Reset size</span>
                    </li>
                )}
                {config.contextMenu.canMaximize && (
                    <li key="maximize" onClick={handleResetSize}>
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faArrowsRotate)}/>
                        <span>Maximize</span>
                    </li>
                )}
                {config.contextMenu.canPosition && (
                    <li key="reposition" onClick={handleResetSize}>
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faArrowsRotate)}/>
                        <span>Reposition</span>
                    </li>
                )}
            </ul>
        </div>
    )
}