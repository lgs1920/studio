/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetContextMenu.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-01
 * Last modified: 2025-11-01
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { SECOND, WIDGETS_CAPABILITIES }                          from '@Core/constants'
import { faRegularSquareCirclePlus, faRegularSquareCircleMinus } from '@awesome.me/kit-eb5c406148/icons/kit/custom'

import {
    faArrowDown, faArrowDownLeft, faArrowDownRight, faArrowLeft, faArrowRight,
    faArrowUp, faArrowUpLeft, faArrowUpRight, faCompress, faPlus, faTrashCan,
}                            from '@fortawesome/pro-regular-svg-icons'
import { SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }             from '@Utils/FA2SL'
import React, { useEffect, useMemo, useRef } from 'react'
import { useSnapshot } from 'valtio'

/**
 * Offset value for menu positioning (in pixels).
 */
const MENU_OFFSET = 10
const PERCENTAGE = 0.1

/**
 * WidgetContextMenu component renders a context menu for a widget with configurable actions.
 * The menu is displayed based on the widget's capabilities and configuration.
 * If hasCapabilities is false, a drag is in progress, or position is invalid (0,0), the context menu is disabled.
 * The menu opens downward or upward and rightward or leftward based on available space in the window,
 * taking into account the menu's height and width, including the rendered <ul> and its grid content.
 * When opening upward, the menu is aligned to the bottom of the window with MENU_OFFSET margin.
 * When opening leftward, the menu is aligned to the right of the window with MENU_OFFSET margin.
 * On mobile, long tap is detected externally, and coordinates are validated with a fallback to widget element position.
 *
 * @returns {JSX.Element | null} The context menu component or null if not displayed.
 */
export const WidgetContextMenu = () => {
    const _anchor = useRef(null)
    const _timer = useRef(null) // Local timer reference
    const _isDragging = useRef(false) // Track if a drag is in progress
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
        if (!canDisplayContextMenu || !_anchor.current || !element) {
            return
        }

        // Use setTimeout to ensure the menu is fully rendered
        const timerId = setTimeout(() => {
            const menuHeight = _anchor.current.offsetHeight
            const menuWidth = _anchor.current.offsetWidth
            const windowHeight = window.innerHeight
            const windowWidth = window.innerWidth

            // Use widget element position as fallback if coordinates are invalid
            let cursorX = position.x
            let cursorY = position.y
            if (cursorX === 0 || cursorY === 0) {
                const rect = element.getBoundingClientRect()
                cursorX = rect.left
                cursorY = rect.top
            }

            // Vertical positioning: open downward if enough space, otherwise align to bottom
            if (cursorY + menuHeight > windowHeight) {
                _anchor.current.style.top = `${windowHeight - menuHeight - MENU_OFFSET}px`
            }
            else {
                _anchor.current.style.top = `${cursorY + MENU_OFFSET}px`
            }

            // Horizontal positioning: open rightward if enough space, otherwise align to right
            if (cursorX + menuWidth > windowWidth) {
                _anchor.current.style.left = `${windowWidth - menuWidth - MENU_OFFSET}px`
            }
            else {
                _anchor.current.style.left = `${cursorX + MENU_OFFSET}px`
            }
        }, 0)

        return () => clearTimeout(timerId)
    }, [canDisplayContextMenu, position.x, position.y, element])

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
    const handleResetSize = (scale) => {
        //const current = __.ui.widgetManager.getTransform(element)
        const elementId = __.ui.widgetManager.retrieveElementId(element)
        const container = config.container.getBoundingClientRect()

        config.scale = scale === 1
                         ? {x: 1, y: 1}
                         : {x: config.scale.x * (1 + scale), y: config.scale.y * (1 + scale)}
        config.scale = __.ui.widgetManager.adaptScaleToContainer(config, container)
        config.position = __.ui.widgetManager.adaptPositionToContainer(config, container)
        if (config.persist) {
            __.ui.widgetManager.saveWidgetPosition(elementId, config)
        }
        if (scale === 1) {
            $widget.canDisplayContextMenu = false
        }

        __.ui.widgetManager.setScale(element, config.scale.x, config.scale.y)
        __.ui.widgetManager.applyPosition(element, config.position)


    }

    if (!canDisplayContextMenu || _isDragging.current || !element || !__.ui.widgetManager.hasCapabilities(config?.contextMenu, WIDGETS_CAPABILITIES)) {
        return null
    }


    return (
        <div
            ref={_anchor}
            className="lgs-context-menu widget-context-menu lgs-card on-map"
            onPointerLeave={() => {
                _timer.current = setTimeout(() => hideMenu(), 200000 * SECOND)
            }}
            onPointerEnter={() => {
                if (_timer.current) {
                    clearTimeout(_timer.current)
                    _timer.current = null
                }
            }}
        >
            <ul>

                {config.contextMenu.canReset && (
                    <li key="reset-plus-minus" className="widget-grid-one-line widget-no-hover buttons-bar-on-map">
                        <SlTooltip key="reset-size" content={'Reset size'} placement="top">
                            <SlIcon library="fa" name={FA2SL.set(faCompress)}
                                    className="lgs-one-line-card on-map"
                                    onClick={() => handleResetSize(1)}/>
                        </SlTooltip>

                        <SlTooltip key="plus-ten" content={`Shrink -${PERCENTAGE * 100}%`} placement="top">
                            <SlIcon library="fa" name={FA2SL.set(faRegularSquareCircleMinus)}
                                    className="lgs-one-line-card on-map"
                                    onClick={() => handleResetSize(-PERCENTAGE)}/>
                        </SlTooltip>

                        <SlTooltip key="minus-ten" content={`Expand +${PERCENTAGE * 100}%`} placement="top">
                            <SlIcon library="fa" name={FA2SL.set(faRegularSquareCirclePlus)}
                                    className="lgs-one-line-card on-map"
                                    onClick={() => handleResetSize(PERCENTAGE)}/>
                        </SlTooltip>
                    </li>
                )}
                {config.contextMenu.canRemove && (
                    <li key="remove-from-video" onClick={handleRemove}>
                        <SlIcon library="fa" name={FA2SL.set(faTrashCan)}/>
                        <SlTooltip content="Remove Widget" placement="left">
                            <span>{'Remove'}</span>
                        </SlTooltip>
                    </li>
                )}

                {/* {config.contextMenu.canMaximize && ( */}
                {/*     <li key="maximize" onClick={handleResetSize}> */}
                {/*         <SlIcon slot="prefix" library="fa" name={FA2SL.set(faArrowsRotate)}/> */}
                {/*         <span>{'Maximize'}</span> */}
                {/*     </li> */}
                {/* )} */}


                {config.contextMenu.canPosition && (
                    <li
                        key="reposition"
                        className="widget-grid-position widget-no-hover buttons-bar-on-map"
                    >
                        <SlTooltip key="top-left" content="Top left" placement="left">
                            <SlIcon
                                library="fa"
                                className="lgs-one-line-card on-map"
                                onClick={() => {
                                    __.ui.widgetManager.toTopLeft(element, lgs.gutter.xs)
                                    hideMenu()
                                }}
                                name={FA2SL.set(faArrowUpLeft)}
                            />
                        </SlTooltip>
                        <SlTooltip key="top" content="Top" placement="top">
                            <SlIcon
                                library="fa"
                                className="lgs-one-line-card on-map"
                                onClick={() => {
                                    __.ui.widgetManager.toTop(element, lgs.gutter.xs)
                                    hideMenu()
                                }}
                                name={FA2SL.set(faArrowUp)}
                            />
                        </SlTooltip>
                        <SlTooltip key="top-right" content="Top right" placement="right">
                            <SlIcon
                                library="fa"
                                className="lgs-one-line-card on-map"
                                onClick={() => {
                                    __.ui.widgetManager.toTopRight(element, lgs.gutter.xs)
                                    hideMenu()
                                }}
                                name={FA2SL.set(faArrowUpRight)}
                            />
                        </SlTooltip>
                        <SlTooltip key="left" content="Left" placement="left">
                            <SlIcon
                                library="fa"
                                className="lgs-one-line-card on-map"
                                onClick={() => {
                                    __.ui.widgetManager.toLeft(element, lgs.gutter.xs)
                                    hideMenu()
                                }}
                                name={FA2SL.set(faArrowLeft)}
                            />
                        </SlTooltip>
                        <SlTooltip key="center" content="Center" placement="top">
                            <SlIcon
                                library="fa"
                                className="lgs-one-line-card on-map"
                                onClick={() => {
                                    __.ui.widgetManager.toCenter(element, lgs.gutter.xs)
                                    hideMenu()
                                }}
                                name={FA2SL.set(faPlus)}
                            />
                        </SlTooltip>
                        <SlTooltip key="right" content="Right" placement="right">
                            <SlIcon
                                library="fa"
                                className="lgs-one-line-card on-map"
                                onClick={() => {
                                    __.ui.widgetManager.toRight(element, lgs.gutter.xs)
                                    hideMenu()
                                }}
                                name={FA2SL.set(faArrowRight)}
                            />
                        </SlTooltip>
                        <SlTooltip key="bottom-left" content="Bottom left" placement="left">
                            <SlIcon
                                library="fa"
                                className="lgs-one-line-card on-map"
                                onClick={() => {
                                    __.ui.widgetManager.toBottomLeft(element, lgs.gutter.xs)
                                    hideMenu()
                                }}
                                name={FA2SL.set(faArrowDownLeft)}
                            />
                        </SlTooltip>
                        <SlTooltip key="bottom" content="Bottom" placement="bottom">
                            <SlIcon
                                library="fa"
                                className="lgs-one-line-card on-map"
                                onClick={() => {
                                    __.ui.widgetManager.toBottom(element, lgs.gutter.xs)
                                    hideMenu()
                                }}
                                name={FA2SL.set(faArrowDown)}
                            />
                        </SlTooltip>
                        <SlTooltip key="bottom-right" content="Bottom right" placement="right">
                            <SlIcon
                                library="fa"
                                className="lgs-one-line-card on-map"
                                onClick={() => {
                                    __.ui.widgetManager.toBottomRight(element, lgs.gutter.xs)
                                    hideMenu()
                                }}
                                name={FA2SL.set(faArrowDownRight)}
                            />
                        </SlTooltip>
                    </li>
                )}
            </ul>
        </div>
    )
}