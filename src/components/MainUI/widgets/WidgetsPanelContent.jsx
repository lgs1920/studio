/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetsPanelContent.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-27
 * Last modified: 2026-04-27
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    VIDEO_WIDGETS_BOARD, LGS_VISUAL_WIDGET, WIDGET_LAYER_START, WIDGET_LAYER_STEP,
}                                from '@Core/constants'
import { WidgetDynamicRenderer } from '@Core/ui/widget-manager/dynamic-render/WidgetDynamicRender'
import { WaDivider, WaIcon }     from '@web.awesome.me/webawesome-pro/dist/react'
import classNames                from 'classnames'
import { useEffect, useRef, useState }                from 'react'
import { useSnapshot }           from 'valtio'

/**
 * Widget panel that shows available widgets grouped by category.
 * Handles event propagation to avoid conflicts with draggable parent containers.
 *
 * @param {Object} props
 * @param {Iterable<string>} props.groups - Group IDs to show in the panel
 * @returns {JSX.Element | null}
 */
export const WidgetsPanelContent = ({groups}) => {
    const _widgetDeckPanel = useRef(null)
    const widgetDynamicRenderer = new WidgetDynamicRenderer()
    const toolbars = useSnapshot(lgs.settings.ui.toolbars)
    const reached = new Set()
    const [isInitialized, setIsInitialized] = useState(false)

    // Counter to ensure new widgets are placed on top of the stack
    const _widgetIndex = useRef(WIDGET_LAYER_START)

    /**
     * Filters and returns only valid groups from the global registry.
     * @returns {Map<string, Object>}
     */
    const theGroups = () => {
        return widgetDynamicRenderer.theGroups(groups)
    }

    /**
     * Synchronizes the global store map order with the zIndex values.
     * Required for consistent rendering order in Valtio snapshots.
     */
    const sortWidgetStore = () => {
        const $list = lgs.stores.ui.widget.list
        const sortedEntries = Array.from($list.entries())
            .sort(([, a], [, b]) => (a.zIndex || 0) - (b.zIndex || 0))

        $list.clear()
        for (const [id, data] of sortedEntries) {
            $list.set(id, data)
        }
    }

    /**
     * Adds a new instance of a widget to the map.
     * @param {string} group
     * @param {string} key
     * @param {Object} [props={}] - Existing widget properties (e.g. from DB)
     */
    const addWidget = (group, key, props = {}) => {
        const id = !/#/.test(key) ? __.ui.widgetManager.defineElementId(group, key) : key

        // Fetch definition to determine if zIndex is applicable
        const groupsMap = widgetDynamicRenderer.theGroups([group])
        const groupDef = groupsMap.get(group)
        const widgetDef = groupDef?.widgets.get(key.split('#')[0])

        const additionalProps = {}

        // Only apply zIndex to visual components
        if (widgetDef?.type === LGS_VISUAL_WIDGET) {
            // Priority: 1. Existing zIndex from props | 2. Current ref counter
            additionalProps.zIndex = props.zIndex || _widgetIndex.current

            // Increment counter only if a new zIndex was generated
            if (!props.zIndex) {
                _widgetIndex.current += WIDGET_LAYER_STEP
            }
        }

        widgetDynamicRenderer.renderWidget(group, id, {
            ...props,
            widgetsBoard: VIDEO_WIDGETS_BOARD,
            forceRefresh: true,
            ...additionalProps,
        })

        // Ensure the global list Map is ordered correctly after insertion
        sortWidgetStore()
    }

    /**
     * Stops event propagation for both mouse and touch interactions.
     * @param {MouseEvent|TouchEvent} e
     */
    const handleInteraction = (e) => {
        e.stopPropagation()
    }

    const handleKeyboardAction = (event, action) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return
        }

        event.preventDefault()
        event.stopPropagation()
        action()
    }

    useEffect(() => {
        const targetedGroups = theGroups()

        /**
         * Load widgets already existing in the state/database.
         */
        const displayWidgetsInBase = async () => {
            for (const [groupId] of targetedGroups.entries()) {
                const widgets = await __.ui.widgetManager.getWidgetsByGroup(groupId)
                for (const widgetToRender of widgets) {
                    // Pass existing widget data to preserve its original zIndex
                    addWidget(groupId, widgetToRender.id, widgetToRender)
                }
            }
        }

        /**
         * Trigger rendering for mandatory widgets not yet present in the list.
         */
        const displayMandatoryWidgets = () => {
            for (const [groupId, group] of targetedGroups.entries()) {
                for (const [widgetId, widgetDef] of group.widgets) {
                    const fullId = __.ui.widgetManager.defineElementId(groupId, widgetId)
                    if (widgetDef.mandatory && !lgs.stores.ui.widget.list.has(fullId)) {
                        addWidget(groupId, widgetId)
                    }
                }
            }
        }

        const initializePanel = async () => {
            await displayWidgetsInBase()
            displayMandatoryWidgets()
            setIsInitialized(true)
        }

        initializePanel()
    }, [])

    if (!isInitialized) {
        return null
    }

    const hasJourney = Boolean(lgs.theJourney)

          // Logic to track which widgets can still be added
    ;[...theGroups().entries()].forEach(([groupKey, groupValue]) => {
        ;[...groupValue.widgets.entries()].forEach(([widgetKey]) => {
            if (widgetKey === 'journey-stats-widget' && !hasJourney) {
                return
            }
            if (!__.ui.widgetManager.isMaxWidgetsReached(groupKey, widgetKey)) {
                reached.add(widgetKey)
            }
        })
    })

    if (reached.size === 0) {
        return null
    }

    return (
        <div
            className="lgs-widget-menu widget-deck-panel lgs-card wa-theme-lgs1920-on-map"
            ref={_widgetDeckPanel}
            style={{opacity: toolbars.opacity}}
            onMouseDown={handleInteraction}
            onTouchStart={handleInteraction}
        >
            <div className="widget-deck-entry widget-deck-title">
                <WaIcon name="box"/>
                <span>Widgets</span>
            </div>

            {[...theGroups().entries()].map(([groupKey, groupValue]) => (
                <ul key={groupKey} className="widget-group">
                    {[...groupValue.widgets.entries()].map(([widgetKey, widgetDef]) => {
                        if (widgetKey === 'journey-stats-widget' && !hasJourney) {
                            return null
                        }
                        if (reached.has(widgetKey)) {
                            return (
                                <li
                                    key={`${groupKey}-${widgetKey}`}
                                    role="button"
                                    tabIndex={0}
                                        onClick={() => addWidget(groupKey, widgetKey)}
                                        onMouseDown={handleInteraction}
                                        onTouchStart={handleInteraction}
                                    onKeyDown={(event) => handleKeyboardAction(event, () => addWidget(groupKey, widgetKey))}
                                        className={classNames(
                                            'widget-deck-entry', 'widget-deck-item', 'small',
                                        )}
                                    >
                                    <WaIcon name={widgetDef.icon} variant="regular"/>
                                        <span className="widget-name">{widgetDef.name}</span>
                                </li>
                            )
                        }
                    })}
                </ul>
            ))}
        </div>
    )
}
