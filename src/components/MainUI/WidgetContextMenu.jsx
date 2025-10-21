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

import { SECOND, WIDGETS_CAPABILITIES } from '@Core/constants'
import { faArrowsRotate, faTrashCan } from '@fortawesome/pro-regular-svg-icons'
import { SlIcon }                       from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                        from '@Utils/FA2SL'
import React, { useEffect, useRef }     from 'react'
import { useSnapshot }                  from 'valtio'

/**
 * Offset value for menu positioning (in pixels).
 */
const MENU_OFFSET = 10

/**
 * WidgetContextMenu component renders a context menu for a widget with configurable actions.
 * The menu is displayed based on the widget's capabilities and configuration.
 * If hasCapabilities is false, the context menu is disabled.
 * The menu opens downward or upward and rightward or leftward based on available space in the window.
 *
 * @returns {JSX.Element | null} The context menu component or null if not displayed.
 */
export const WidgetContextMenu = () => {
    const _anchor = useRef(null)
    const _timer = useRef(null) // Local timer reference
    const $widget = lgs.stores.ui.widget
    const {id, canDisplayContextMenu, position} = useSnapshot($widget)
    const element = __.ui.widgetManager.getElementById(id)
    const config = __.ui.widgetManager.getWidgetConfig(id)

    // Close menu when clicking outside
    useEffect(() => {
        if (!canDisplayContextMenu) {
            return
        }

        const handleClickOutside = (event) => {
            if (_anchor.current && !_anchor.current.contains(event.target)) {
                hideMenu()
            }
        }

        // Add listener on next tick to avoid immediate close
        setTimeout(() => {
            document.addEventListener('pointerdown', handleClickOutside)
        }, 0)

        return () => {
            document.removeEventListener('pointerdown', handleClickOutside)
        }
    }, [canDisplayContextMenu])

    // Clean up timer on unmount or when menu is hidden
    useEffect(() => {
        if (!canDisplayContextMenu) {
            if (_timer.current) {
                clearTimeout(_timer.current)
                _timer.current = null
            }
        }

        return () => {
            if (_timer.current) {
                clearTimeout(_timer.current)
                _timer.current = null
            }
        }
    }, [canDisplayContextMenu])

    // Calculate menu position based on available space
    useEffect(() => {
        if (!canDisplayContextMenu || !_anchor.current) {
            return
        }

        const menuHeight = _anchor.current.offsetHeight
        const menuWidth = _anchor.current.offsetWidth
        const windowHeight = window.innerHeight
        const windowWidth = window.innerWidth
        const cursorY = position.y
        const cursorX = position.x

        // Vertical positioning: open downward if enough space, otherwise upward
        if (cursorY + menuHeight + MENU_OFFSET > windowHeight) {
            _anchor.current.style.top = `${cursorY - menuHeight + MENU_OFFSET}px`
        }
        else {
            _anchor.current.style.top = `${cursorY - MENU_OFFSET}px`
        }

        // Horizontal positioning: open rightward if enough space, otherwise leftward
        if (cursorX + menuWidth + MENU_OFFSET > windowWidth) {
            _anchor.current.style.left = `${cursorX - menuWidth + MENU_OFFSET}px`
        }
        else {
            _anchor.current.style.left = `${cursorX - MENU_OFFSET}px`
        }
    }, [canDisplayContextMenu, position])

    /**
     * Handles the removal of the widget.
     */
    const handleRemove = () => {
        __.ui.widgetManager.disposeElement(element)
        $widget.canDisplayContextMenu = false
    }

    /**
     * Hides the menu in the application by clearing the timer and updating visibility settings.
     */
    const hideMenu = () => {
        if (_timer.current) {
            clearTimeout(_timer.current)
            _timer.current = null
        }
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
            onPointerLeave={() => {
                _timer.current = setTimeout(() => hideMenu(), 2 * SECOND)
            }}
            onPointerEnter={() => {
                if (_timer.current) {
                    clearTimeout(_timer.current)
                    _timer.current = null
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