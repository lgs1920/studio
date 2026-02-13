/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetsPanelContent.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-13
 * Last modified: 2026-02-13
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
 * Handles event propagation to avoid conflicts with draggable parent containers.
 *
 * @param {Object} props
 * @param {Iterable<string>} props.groups - Group IDs to show in the panel
 * @returns {JSX.Element | null}
 */
export const WidgetsPanelContent = ({groups}) => {
    const _widgetDeckPanel = useRef(null)
    const widgetDynamicRenderer = new WidgetDynamicRenderer()
    const $widget = lgs.stores.ui.widget
    const widget = useSnapshot($widget)
    const reached = new Set()
    const [isInitialized, setIsInitialized] = useState(false)

    /**
     * Filters and returns only valid groups from the global registry.
     * @returns {Map<string, Object>}
     */
    const theGroups = () => {
        return widgetDynamicRenderer.theGroups(groups)
    }

    /**
     * Adds a new instance of a widget to the map.
     * @param {string} group
     * @param {string} key
     * @param {Object} [props={}]
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
     * Stops event propagation for both mouse and touch interactions.
     * Prevents parent draggable elements from capturing the event.
     * @param {MouseEvent|TouchEvent} e
     */
    const handleInteraction = (e) => {
        e.stopPropagation()
    }

    /**
     * Computes the tooltip text.
     * @param {string} groupKey
     * @param {string} widgetKey
     * @param {Object} widgetDesc
     * @returns {string}
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

    useEffect(() => {
        const targetedGroups = theGroups()

        const displayWidgetsInBase = async () => {
            for (const [groupId] of targetedGroups.entries()) {
                const widgets = await __.ui.widgetManager.getWidgetsByGroup(groupId)
                for (const widgetToRender of widgets) {
                    addWidget(groupId, widgetToRender.id)
                }
            }
        }

        const displayMandatoryWidgets = () => {
            for (const [groupId, group] of targetedGroups.entries()) {
                for (const [widgetId, widgetDef] of group.widgets) {
                    if (widgetDef.mandatory) {
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
    ;[...theGroups().entries()].map(([groupKey, groupValue]) => {
        ;[...groupValue.widgets.entries()].map(([widgetKey, widgetDef]) => {
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
            className="lgs-widget-menu widget-deck-panel lgs-card on-map"
            ref={_widgetDeckPanel}
            onMouseDown={handleInteraction}
            onTouchStart={handleInteraction}
        >
            <div className="widget-deck-entry widget-deck-title">
                <SlIcon library="fa" name={FA2SL.set(faBox)}/>
                <span>Widgets</span>
            </div>

            {[...theGroups().entries()].map(([groupKey, groupValue]) => (
                <section key={groupKey} className="widget-group">
                    {[...groupValue.widgets.entries()].map(([widgetKey, widgetDef]) => {
                        if (widgetKey === 'journey-stats-widget' && !hasJourney) {
                            return null
                        }
                        if (reached.has(widgetKey)) {
                            return (
                                <SlTooltip key={widgetKey} hoist placement="right"
                                           content={getTooltipText(groupKey, widgetKey, widgetDef)}
                                >
                                    <div
                                        onClick={() => addWidget(groupKey, widgetKey)}
                                        onMouseDown={handleInteraction}
                                        onTouchStart={handleInteraction}
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