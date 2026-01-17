/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetsPanelContent.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-17
 * Last modified: 2026-01-17
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { VIDEO_WIDGETS_BOARD, WIDGETS_CONFIGURATION } from '@Core/constants'
import { WidgetDynamicRenderer }                      from '@Core/ui/widget-manager/dynamic-render/WidgetDynamicRender'
import { faBox }             from '@fortawesome/pro-regular-svg-icons'
import { SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }             from '@Utils/FA2SL'
import classNames                                     from 'classnames'
import { useEffect, useRef, useState }                from 'react'
import { useSnapshot }                                from 'valtio'


/**
 * Widget panel that shows available widgets grouped by category.
 * Lets users add widgets to the map if they haven't reached the limit.
 *
 * @param {Object} props
 * @param {Iterable<string>} props.groups - Group IDs to show in the panel
 * @returns {JSX.Element | null}
 */
export const WidgetsPanelContent = ({groups}) => {
    // Variable to hold the reference to the main panel element
    const _widgetDeckPanel = useRef(null)
    const widgetDynamicRenderer = new WidgetDynamicRenderer()
    const $widget = lgs.stores.ui.widget
    const widget = useSnapshot($widget)
    // Set to store keys of widgets that have not reached their maximum instance limit
    const reached = new Set()
    // State to track if the initial mandatory and persisted widgets have been loaded
    const [isInitialized, setIsInitialized] = useState(false)

    /**
     * Filters and returns only valid groups from the global registry.
     * Delegates to the WidgetDynamicRenderer singleton.
     * @returns {Map<string, Object>}
     */
    const theGroups = () => {
        return widgetDynamicRenderer.theGroups(groups)
    }

    /**
     * Adds a new instance of a widget to the map by invoking the renderer.
     * Delegates to the WidgetDynamicRenderer singleton.
     *
     * @param {string} group - Group ID
     * @param {string} key - Widget ID (base key)
     * @param {Object} [props={}] - Additional props to pass to the widget (not used here, later)
     */
    const addWidget = (group, key, props = {}) => {
        const id = !/#/.test(key) ? __.ui.widgetManager.defineElementId(group, key) : key
        widgetDynamicRenderer.renderWidget(group, id, {
            ...props,
            widgetsBoard: VIDEO_WIDGETS_BOARD,
            forceRefresh: true,
        })
    }

    /**
     * Computes the tooltip text, including remaining instance count if applicable.
     *
     * @param {string} groupKey - Group ID.
     * @param {string} widgetKey - Widget ID (base key).
     * @param {Object} widgetDesc - The widget definition object.
     * @returns {string} The tooltip text.
     */
    const getTooltipText = (groupKey, widgetKey, widgetDesc) => {

        const remaining = __.ui.widgetManager.remainingWidgets(groupKey, widgetKey)
        const max = __.ui.widgetManager.maxWidgets(groupKey, widgetKey)
        let tooltipText = widgetDesc.description || ''
        if (max > 1 && max < 10 && remaining > 0) {
            tooltipText += ` (${remaining} remaining)`
        }
        return tooltipText
    }


    // Effect to initialize widgets based on base configuration and mandatory setting
    useEffect(() => {
        const targetedGroups = theGroups()

        /**
         * Loads and displays widgets configured in the base (persisted) list.
         */
        const displayWidgetsInBase = async () => {
            for (const [groupId] of targetedGroups.entries()) {
                // Get pre-configured/persisted widgets for this group
                const widgets = await __.ui.widgetManager.getWidgetsByGroup(groupId)
                for (const widgetToRender of widgets) {
                    addWidget(groupId, widgetToRender.id)                                           // 1st time
                }
            }
        }

        /**
         * Loads and displays mandatory widgets that are not already active.
         */
        const displayMandatoryWidgets = () => {
            for (const [groupId, group] of targetedGroups.entries()) {
                for (const [widgetId, widgetDef] of group.widgets) {
                    // Check if the widget is mandatory
                    if (widgetDef.mandatory) {
                        addWidget(groupId, widgetId)                                            // 1st time
                    }
                }
            }
        }

        /**
         * Orchestrates the widget display logic and signals completion
         * by updating the initialization state.
         */
        const initializePanel = async () => {
            await displayWidgetsInBase()
            displayMandatoryWidgets()
            // Mark initialization as complete to allow final rendering logic to execute
            setIsInitialized(true)
        }

        initializePanel()
    }, [])

    // Prevents the panel from rendering until all initial (persisted/mandatory) widgets are loaded
    if (!isInitialized) {
        return null
    }

    // Recalculates the set of available widgets for the current render cycle
    ;[...theGroups().entries()].map(([groupKey, groupValue]) => {
        ;[...groupValue.widgets.entries()].map(([widgetKey, widgetDef]) => {
            // Check if the maximum number of instances for this widget has been reached
            if (!__.ui.widgetManager.isMaxWidgetsReached(groupKey, widgetKey)) {
                reached.add(widgetKey)
            }
        })
    })

    // Conditional render: If no widget instance can be added, returns null
    if (reached.size === 0) {
        return null
    }

    return (

        <div className="lgs-widget-menu widget-deck-panel lgs-card on-map" ref={_widgetDeckPanel}>
            <div className="widget-deck-entry widget-deck-title">
                <SlIcon library="fa" name={FA2SL.set(faBox)}/>
                <span>Widgets</span>
            </div>

            {[...theGroups().entries()].map(([groupKey, groupValue]) => (
                <section key={groupKey} className="widget-group">
                    {[...groupValue.widgets.entries()].map(([widgetKey, widgetDef]) => {
                        // Check if the maximum number of instances for this widget has been reached
                        if (reached.has(widgetKey)) {
                            return (
                                <SlTooltip key={widgetKey} hoist placement="right"
                                           content={getTooltipText(groupKey, widgetKey, widgetDef)}
                                >
                                    <div
                                        onClick={() => addWidget(groupKey, widgetKey)}
                                        className={classNames(
                                            'widget-deck-entry', 'small',
                                            'lgs-one-line-card on-map',
                                        )}
                                    >
                                        <SlIcon
                                            library="fa"
                                            name={FA2SL.set(WIDGETS_CONFIGURATION.get(widgetKey)?.icon)}
                                        />
                                        <span className="widget-name">{widgetDef.name}</span>
                                    </div>
                                </SlTooltip>
                            )
                        }
                    })}
                </section>
            ))}
        </div>
    )
}