/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetsPanelContent.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-11
 * Last modified: 2025-11-11
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { WIDGETS_CONFIGURATION }             from '@Core/constants'
import { faBox }                             from '@fortawesome/pro-regular-svg-icons'
import { SlIcon, SlTooltip }                 from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                             from '@Utils/FA2SL'
import classNames      from 'classnames'
import { lazy, useEffect, useRef, useState } from 'react'
import { useSnapshot } from 'valtio'

/**
 * Renders the widget selection panel.
 *
 * @param {Object} props
 * @param {Iterable<string>} props.groups - Group keys to filter from global widget registry.
 * @param {function(string, Object): void} [props.onWidgetSelect] - Callback when a widget is selected.
 * @returns {JSX.Element} The widget panel with grouped entries.
 */
export const WidgetsPanelContent = ({groups}) => {
    const _widgetDeckPanel = useRef(null)
    const $widget = lgs.stores.ui.widget
    const widget = useSnapshot($widget)
    const [maxReached, setMaxReached] = useState(false)

    /**
     * Filters and returns only the groups that exist in the global registry.
     * @returns {Map<string, Object>} Map of valid group key → group data.
     */
    const theGroups = () => {
        const subGroups = new Map()
        for (const group of groups) {
            if (__.widgets.has(group)) {
                subGroups.set(group, __.widgets.get(group))
            }
        }
        return subGroups
    }


    useEffect(() => {
        const targetedGroups = theGroups()

        /**
         * Reads and displays the widgets saved in the base.
         * @return {Promise<void>}
         */
        const displayWidgetsInBase = async () => {
            for (const [id, group] of targetedGroups.entries()) {
                const widgets = await __.ui.widgetManager.getWidgetsByGroup(id)
                for (const widget of widgets) {
                    renderMyComponent(id, widget.id, {})
                    $widget.list.set(widget.id, widget)
                }
            }
        }

        /**
         * Displays the mandatory widgets
         */
        const displayMandatoryWidgets = () => {
            for (const [groupId, group] of targetedGroups.entries()) {
                for (const [id, widget] of group.widgets) {
                    if (!$widget.list.has(id) && widget.mandatory) {
                        renderMyComponent(groupId, id, {})
                        $widget.list.set(id, widget)
                    }
                }
            }
        }

        // We first show the widgets saved in the base to have their last size and position
        displayWidgetsInBase()
        // Then we show the mandatory widgets not already shown
        displayMandatoryWidgets()

    }, [])


    /**
     * Loads a widget component lazily and caches it.
     * Emits selection via onWidgetSelect.
     *
     * @param {string} group - Group key.
     * @param {string} key - Widget key.
     * @param {Record<string, any>} [extraProps] - Props to pass to the widget.
     */
    const renderMyComponent = async (group, id, extraProps = {}) => {
        const groupsMap = theGroups()
        if (!groupsMap.has(group)) {
            return
        }

        // Load and cache the lazy component only once
        const key = id.split('#')[0]
        const theId = (key === id) ? __.ui.widgetManager.defineElementId(group, key) : id

        const theWidget = groupsMap.get(group).widgets.get(key)
        const count = [...$widget.list.keys()].filter(k => k.startsWith(key)).length
        const canAddWidget = count < (theWidget?.max ?? 1)

        if (!__.ui.widgetCache.has(theId) && canAddWidget) {
            if (theWidget?.component) {
                const LazyWidget = lazy(() =>
                                            import(`./list/${theWidget.component}.jsx`)
                                                .then(module => {
                                                    // Support default export
                                                    if (module.default) {
                                                        return module
                                                    }
                                                    // Support named export matching component name
                                                    if (module[theWidget.component]) {
                                                        return {default: module[theWidget.component]}
                                                    }
                                                    throw new Error(`Component ${theWidget.component} not found`)
                                                })
                                                .catch(() => ({
                                                    default: () => (
                                                        <div className="widget-load-error">
                                                            Failed to load {theWidget.component}
                                                        </div>
                                                    ),
                                                })),
                )
                __.ui.widgetCache.set(theId, group, LazyWidget)
                $widget.list.set(theId, extraProps)

            }
        }
        setMaxReached(!canAddWidget)
    }

    useEffect(() => {
        if (maxReached) {
            setMaxReached(false)
        }

    }, [widget.list])

    // Clean up all widgets and cache on unmount
    useEffect(() => {
        return () => {
            __.ui.widgetCache.clear()
            $widget.list.clear()
        }
    }, [])

    /**
     * Triggers widget selection with default props.
     *
     * @param {string} group - Group key.
     * @param {string} key - Widget key.
     */
    const addWidget = (group, key) => {
        renderMyComponent(group, key, {})
    }

    return (
        <div className="widget-deck-panel lgs-card on-map" ref={_widgetDeckPanel}>
            <div className="widget-deck-entry widget-deck-title">
                <SlIcon library="fa" name={FA2SL.set(faBox)}/>
                <span>Widgets</span>
            </div>

            {/* Render grouped widget entries */}
            {[...theGroups().entries()].map(([groupKey, groupValue]) => (
                <section key={groupKey} className="widget-group">
                    {[...groupValue.widgets.entries()].map(([widgetKey, widget]) => (
                        <SlTooltip key={widgetKey} hoist placement="right" content={widget.description || ''}>
                            <div
                                onClick={() => addWidget(groupKey, widgetKey)}
                                className={classNames(
                                    'widget-deck-entry', 'small',
                                    'lgs-one-line-card on-map',
                                    {'widget-menu-disabled': maxReached},
                                )}
                            >
                                <SlIcon
                                    library="fa"
                                    name={FA2SL.set(WIDGETS_CONFIGURATION.get(widgetKey)?.icon || 'question-circle')}
                                />
                                <span className="widget-name">{widget.name}</span>
                            </div>
                        </SlTooltip>
                    ))}
                </section>
            ))}
        </div>
    )
}