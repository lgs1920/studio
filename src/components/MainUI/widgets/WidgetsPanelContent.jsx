/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetsPanelContent.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-11
 * Last modified: 2025-12-11
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { WIDGETS_CONFIGURATION } from '@Core/constants'
import { faBox }                 from '@fortawesome/pro-regular-svg-icons'
import { SlIcon, SlTooltip }     from '@shoelace-style/shoelace/dist/react'
import { WidgetDynamicRenderer } from '@Core/ui/widget-manager/WidgetDynamicRender'
import { FA2SL }                 from '@Utils/FA2SL'
import classNames                from 'classnames'
import { useEffect, useRef }     from 'react'
import { useSnapshot }           from 'valtio'

/**
 * Singleton instance of the widget renderer utility.
 * @type {WidgetDynamicRenderer}
 */
const widgetDynamicRenderer = WidgetDynamicRenderer.instance

/**
 * Widget panel that shows available widgets grouped by category.
 * Lets users add widgets to the map if they haven't reached the limit.
 *
 * @param {Object} props
 * @param {Iterable<string>} props.groups - Group IDs to show in the panel
 * @returns {JSX.Element}
 */
export const WidgetsPanelContent = ({groups}) => {
    // Variable to hold the reference to the main panel element
    const _widgetDeckPanel = useRef(null)
    // Proxy variable for the widget store
    const $widget = lgs.stores.ui.widget
    // Snapshot variable for immutable access to the widget store data
    const widget = useSnapshot($widget)

    /**
     * Filters and returns only valid groups from the global registry.
     * Delegates to the WidgetDynamicRenderer singleton.
     * @returns {Map<string, Object>}
     */
    const theGroups = () => {
        return widgetDynamicRenderer.theGroups(groups)
    }

    /**
     * Checks if a widget has reached its max allowed instances.
     * Delegates to the WidgetDynamicRenderer singleton.
     *
     * @param {string} groupKey - Group ID
     * @param {string} widgetKey - Widget ID
     * @returns {boolean}
     */
    const isMaxReached = (groupKey, widgetKey) => {
        return widgetDynamicRenderer.isMaxReached(groupKey, widgetKey)
    }

    /**
     * Adds a new instance of a widget to the map by invoking the renderer.
     * Delegates to the WidgetDynamicRenderer singleton.
     *
     * @param {string} group - Group ID
     * @param {string} key - Widget ID (base key)
     */
    const addWidget = (group, key) => {
        widgetDynamicRenderer.renderWidget(group, key, {})
    }

    /**
     * Computes the tooltip text, including remaining instance count if applicable.
     *
     * @param {string} groupKey - Group ID.
     * @param {string} widgetKey - Widget ID (base key).
     * @param {Object} widgetDef - The widget definition object.
     * @returns {string} The tooltip text.
     */
    const getTooltipText = (groupKey, widgetKey, widgetDef) => {
        const baseKey = widgetKey.split('#')[0]

        // Count current instances of this base widget
        const count = [...widget.list.keys()]
            .map(k => k.split('#')[0])
            .filter(k => k === baseKey).length

        const max = widgetDef?.max ?? 1
        const remaining = max - count

        let tooltipText = widgetDef.description || ''
        if (max > 1 && remaining > 0) {
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
            for (const [id] of targetedGroups.entries()) {
                // Get pre-configured/persisted widgets for this group
                const widgets = await __.ui.widgetManager.getWidgetsByGroup(id)
                for (const widgetToRender of widgets) {
                    // Use the renderer to load and register the widget instance
                    widgetDynamicRenderer.renderWidget(id, widgetToRender.id, {})
                    // Ensure the full widget definition (if it came from persistence) is set
                    $widget.list.set(widgetToRender.id, widgetToRender)
                }
            }
        }

        /**
         * Loads and displays mandatory widgets that are not already active.
         */
        const displayMandatoryWidgets = () => {
            for (const [groupId, group] of targetedGroups.entries()) {
                for (const [id, widgetDef] of group.widgets) {
                    // Check if the widget is mandatory and not currently in the list
                    if (!$widget.list.has(id) && widgetDef.mandatory) {
                        // Use the renderer to load and register the mandatory widget
                        widgetDynamicRenderer.renderWidget(groupId, id, {})
                        // Add the widget definition to the list with its base ID
                        $widget.list.set(id, widgetDef)
                    }
                }
            }
        }

        displayWidgetsInBase()
        displayMandatoryWidgets()
    }, [])

    return (
        <div className="widget-deck-panel lgs-card on-map" ref={_widgetDeckPanel}>
            <div className="widget-deck-entry widget-deck-title">
                <SlIcon library="fa" name={FA2SL.set(faBox)}/>
                <span>Widgets</span>
            </div>

            {[...theGroups().entries()].map(([groupKey, groupValue]) => (
                <section key={groupKey} className="widget-group">
                    {[...groupValue.widgets.entries()].map(([widgetKey, widgetDef]) => {
                        // Check if the maximum number of instances for this widget has been reached
                        const reached = isMaxReached(groupKey, widgetKey)

                        return (
                            <SlTooltip key={widgetKey} hoist placement="right"
                                       content={getTooltipText(groupKey, widgetKey, widgetDef)}
                            >
                                <div
                                    onClick={() => addWidget(groupKey, widgetKey)}
                                    className={classNames(
                                        'widget-deck-entry', 'small',
                                        'lgs-one-line-card on-map',
                                        {'widget-menu-disabled': reached},
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
                    })}
                </section>
            ))}
        </div>
    )
}