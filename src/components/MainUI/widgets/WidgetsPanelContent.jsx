/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetsPanelContent.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-08
 * Last modified: 2025-11-08
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { WIDGETS_CONFIGURATION }             from '@Core/constants'
import { faBox }                             from '@fortawesome/pro-regular-svg-icons'
import { SlIcon, SlTooltip }                 from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                             from '@Utils/FA2SL'
import { useEffect, useRef, useState, lazy } from 'react'
import { useSnapshot } from 'valtio'

/**
 * Renders the widget selection panel.
 *
 * @param {Object} props
 * @param {Iterable<string>} props.groups - Group keys to filter from global widget registry.
 * @param {function(string, Object): void} [props.onWidgetSelect] - Callback when a widget is selected.
 * @returns {JSX.Element} The widget panel with grouped entries.
 */
export const WidgetsPanelContent = ({groups, onWidgetSelect, onWidgetUnselect}) => {
    const _widgetDeckPanel = useRef(null)
    const [selectedKeys, setSelectedKeys] = useState([])
    const $widget = lgs.stores.ui.widget

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

    /**
     * Dynamically unmounts a widget: removes from UI, cache and emits unselect.
     *
     * @param {string} key - Widget key to unmount
     */
    const unmountWidget = (key) => {
        __.ui.widgetCache.delete(key)
        $widget.list.delete(key)
    }

    // Global cleanup on panel unmount
    useEffect(() => {
        return () => {
            selectedKeys.forEach(key => unmountWidget(key))
        }
    }, [])

    /**
     * Loads a widget component lazily and caches it.
     * Emits selection via onWidgetSelect.
     *
     * @param {string} group - Group key.
     * @param {string} key - Widget key.
     * @param {Record<string, any>} [extraProps] - Props to pass to the widget.
     */
    const renderMyComponent = (group, key, extraProps = {}) => {
        const groupsMap = theGroups()
        if (!groupsMap.has(group)) {
            return
        }

        // Load and cache the lazy component only once
        if (!__.ui.widgetCache.has(key)) {
            const widget = groupsMap.get(group).widgets.get(key)
            if (widget?.component) {
                const LazyWidget = lazy(() =>
                                            import(`./list/${widget.component}.jsx`)
                                                .then(module => {
                                                    // Support default export
                                                    if (module.default) {
                                                        return module
                                                    }
                                                    // Support named export matching component name
                                                    if (module[widget.component]) {
                                                        return {default: module[widget.component]}
                                                    }
                                                    throw new Error(`Component ${widget.component} not found`)
                                                })
                                                .catch(() => ({
                                                    default: () => (
                                                        <div className="widget-load-error">
                                                            Failed to load {widget.component}
                                                        </div>
                                                    ),
                                                })),
                )
                __.ui.widgetCache.set(key, LazyWidget)
                $widget.list.set(key, extraProps)

            }
        }
    }

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
    const showWidget = (group, key) => {
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
                                onClick={() => showWidget(groupKey, widgetKey)}
                                className="widget-deck-entry small lgs-one-line-card on-map"
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