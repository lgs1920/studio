/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetsPanelContent.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-13
 * Last modified: 2025-12-13
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { WIDGETS_CONFIGURATION } from '@Core/constants'
import { faBox }                 from '@fortawesome/pro-regular-svg-icons'
import { SlIcon, SlTooltip }     from '@shoelace-style/shoelace/dist/react'
import { WidgetDynamicRenderer } from '@Core/ui/widget-manager/dynamic-render/WidgetDynamicRender'
import { FA2SL }                 from '@Utils/FA2SL'
import classNames                from 'classnames'
import { useEffect, useRef }     from 'react'
import { useSnapshot }           from 'valtio'


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
    const widgetDynamicRenderer = new WidgetDynamicRenderer()

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
     * @param {Object} widgetDesc - The widget definition object.
     * @returns {string} The tooltip text.
     */
    const getTooltipText = (groupKey, widgetKey, widgetDesc) => {

        const remaining = __.ui.widgetManager.remainingWidgets(groupKey, widgetKey)
        const max = __.ui.widgetManager.maxWidgets(groupKey, widgetKey)
        let tooltipText = widgetDesc.description || ''
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
                    $widget.list.set(widgetToRender.id, {})
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
                        $widget.list.set(id, {})
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
                        const reached = __.ui.widgetManager.isMaxWidgetsReached(groupKey, widgetKey)

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