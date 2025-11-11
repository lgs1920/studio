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

import { WIDGETS_CONFIGURATION }   from '@Core/constants'
import { faBox }                   from '@fortawesome/pro-regular-svg-icons'
import { SlIcon, SlTooltip }       from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                   from '@Utils/FA2SL'
import classNames                  from 'classnames'
import { lazy, useEffect, useRef } from 'react'
import { useSnapshot }             from 'valtio'

/**
 * Widget panel that shows available widgets grouped by category.
 * Lets users add widgets to the map if they haven't reached the limit.
 *
 * @param {Object} props
 * @param {Iterable<string>} props.groups - Group IDs to show in the panel
 * @returns {JSX.Element}
 */
export const WidgetsPanelContent = ({groups}) => {
    const _widgetDeckPanel = useRef(null)
    const $widget = lgs.stores.ui.widget
    const widget = useSnapshot($widget)

    /**
     * Filters and returns only valid groups from the global registry
     * @returns {Map<string, Object>}
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
     * Checks if a widget has reached its max allowed instances
     *
     * @param {string} groupKey - Group ID
     * @param {string} widgetKey - Widget ID
     * @returns {boolean}
     */
    const isMaxReached = (groupKey, widgetKey) => {
        const group = __.widgets.get(groupKey)
        const widgetDef = group?.widgets?.get(widgetKey)
        const baseKey = widgetKey.split('#')[0]

        const count = [...widget.list.keys()]
            .map(k => k.split('#')[0])
            .filter(k => k === baseKey).length

        const max = widgetDef?.max ?? 1
        return count >= max
    }

    /**
     * Loads and renders a widget component if allowed
     *
     * @param {string} group - Group ID
     * @param {string} id - Widget ID
     * @param {Object} extraProps - Optional props to pass to the widget
     */
    const renderMyComponent = async (group, id, extraProps = {}) => {
        const groupsMap = theGroups()
        if (!groupsMap.has(group)) {
            return
        }

        const key = id.split('#')[0]
        const theId = (key === id) ? __.ui.widgetManager.defineElementId(group, key) : id
        const theWidget = groupsMap.get(group).widgets.get(key)

        const count = [...$widget.list.keys()]
            .map(k => k.split('#')[0])
            .filter(k => k === key).length

        const max = theWidget?.max ?? 1
        const canAddWidget = count < max

        if (!__.ui.widgetCache.has(theId) && canAddWidget) {
            if (theWidget?.component) {
                const LazyWidget = lazy(() =>
                                            import(`./list/${theWidget.component}.jsx`)
                                                .then(module => {
                                                    if (module.default) {
                                                        return module
                                                    }
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
                                                    )
                                                }))
                )
                __.ui.widgetCache.set(theId, group, LazyWidget)
                $widget.list.set(theId, extraProps)
            }
        }
    }

    /**
     * Adds a widget to the map
     *
     * @param {string} group - Group ID
     * @param {string} key - Widget ID
     */
    const addWidget = (group, key) => {
        renderMyComponent(group, key, {})
    }

    useEffect(() => {
        const targetedGroups = theGroups()

        const displayWidgetsInBase = async () => {
            for (const [id, group] of targetedGroups.entries()) {
                const widgets = await __.ui.widgetManager.getWidgetsByGroup(id)
                for (const widget of widgets) {
                    renderMyComponent(id, widget.id, {})
                    $widget.list.set(widget.id, widget)
                }
            }
        }

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

        displayWidgetsInBase()
        displayMandatoryWidgets()
    }, [])
    const getTooltipText = (groupKey, widgetKey, widgetDef) => {
        const baseKey = widgetKey.split('#')[0]

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


    useEffect(() => {
        return () => {
            __.ui.widgetCache.clear()
            $widget.list.clear()
        }
    }, [])

    return (
        <div className="widget-deck-panel lgs-card on-map" ref={_widgetDeckPanel}>
            <div className="widget-deck-entry widget-deck-title">
                <SlIcon library="fa" name={FA2SL.set(faBox)}/>
                <span>Widgets</span>
            </div>

            {[...theGroups().entries()].map(([groupKey, groupValue]) => (
                <section key={groupKey} className="widget-group">
                    {[...groupValue.widgets.entries()].map(([widgetKey, widget]) => {
                        const reached = isMaxReached(groupKey, widgetKey)

                        return (
                            <SlTooltip key={widgetKey} hoist placement="right"
                                       content={getTooltipText(groupKey, widgetKey, widget)}
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
                                    <span className="widget-name">{widget.name}</span>
                                </div>
                            </SlTooltip>
                        )
                    })}
                </section>
            ))}
        </div>
    )
}