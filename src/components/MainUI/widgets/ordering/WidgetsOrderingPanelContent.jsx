/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetsOrderingPanelContent.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-17
 * Last modified: 2026-02-17
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { CREDITS_WIDGET, WIDGET_LAYER_START, WIDGET_LAYER_STEP, WIDGET_LAYER_TOP } from '@Core/constants'
import {
    faAnglesUpDown,
}                                                                                  from '@fortawesome/pro-regular-svg-icons'
import {
    SlIcon,
}                                                                                  from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                                   from '@Utils/FA2SL'
import { useEffect, useRef, useState } from 'react'
import Sortable                                                                    from 'sortablejs'
import { useSnapshot }                                                             from 'valtio'
import { SortableWidgetRow }                                                       from './SortableWidgetRow'

/**
 * Main content for the widget ordering panel.
 * Synchronizes SortableJS drag-and-drop with Valtio store, Cache, and Persistence.
 * * @param {Object} props
 * @param {string} props.widgetsBoard - The target board ID to filter widgets
 */
export const WidgetsOrderingPanelContent = ({widgetsBoard}) => {
    const _viewRef = useRef(null)
    const _sortableInstance = useRef(null)
    const [_activeWidgets, _setActiveWidgets] = useState([])

    const $widget = lgs.stores.ui.widget
    const widget = useSnapshot($widget)

    /**
     * Updates the DOM element for a specific widget container.
     * Provides immediate visual feedback before React re-renders.
     * * @param {string} id
     * @param {number} zIndex
     */
    const updateWidgetDOM = (id, zIndex) => {
        const el = document.querySelector(`.lgs-widget-container[data-widget="${id}"]`)
        if (el) {
            el.style.zIndex = zIndex
        }
    }

    /**
     * Loads widget data and sorts them by zIndex.
     * Initial sorting is critical to ensure array indexes match DOM indexes for SortableJS.
     */
    useEffect(() => {
        let isMounted = true

        const loadWidgets = async () => {
            if (!widget.list) {
                return
            }

            const entries = Array.from(widget.list.entries())
            const listPromises = entries
                .filter(([, w]) => w?.widgetsBoard === widgetsBoard)
                .map(async ([id], index) => {
                    const widgetType = id.split('#')[0]
                    const instance = lgs.settings.widgets[widgetType]

                    if (!instance) {
                        return null
                    }

                    const position = await __.ui.widgetManager.getWidgetPosition(id)
                    const config = instance.configuration

                    const instanceConfig = config?.elements?.[id]
                        ?? config?.user
                        ?? config?.default

                    const name = instanceConfig?.text?.content
                        ?? instance.name
                        ?? widgetType

                    const currentZ = widgetType === CREDITS_WIDGET
                                     ? WIDGET_LAYER_TOP
                                     : (position?.zIndex && position.zIndex !== 0)
                                       ? position.zIndex
                                       : (WIDGET_LAYER_START + index * WIDGET_LAYER_STEP)

                    return {
                        id,
                        name,
                        icon:   instance.icon,
                        zIndex: parseInt(currentZ),
                        type:   widgetType,
                        onTop:  instance.alwaysOnTop ?? false,
                        fixed:  instance.fixedPosition ?? false,
                    }
                })

            const resolvedList = (await Promise.all(listPromises)).filter(Boolean)

            if (isMounted) {
                // Sorting is mandatory for index synchronization
                _setActiveWidgets(resolvedList.sort((a, b) => b.zIndex - a.zIndex))
            }
        }

        loadWidgets()
        return () => {
            isMounted = false
        }
    }, [widget.list, widgetsBoard])

    /**
     * Recalculates stack and saves via async saveWidgetPosition.
     * Updates the Valtio store, the internal cache, and the database.
     * * @param {number} oldIndex
     * @param {number} newIndex
     */
    const handleReorder = async (oldIndex, newIndex) => {
        const newList = [..._activeWidgets]
        const [movedItem] = newList.splice(oldIndex, 1)

        // Prevent moving fixed items
        if (movedItem.fixed) {
            return
        }

        newList.splice(newIndex, 0, movedItem)

        const totalItems = newList.length

        // 1. Calculate new values: Top of list gets highest standard zIndex
        const updatedItems = newList.map((item, index) => {
            let newZ

            // Specific rule: CREDITS_WIDGET always stays at the absolute top layer
            if (item.type === CREDITS_WIDGET) {
                newZ = WIDGET_LAYER_TOP
            }
            else {
                const reversedIndex = totalItems - 1 - index
                newZ = WIDGET_LAYER_START + (reversedIndex * WIDGET_LAYER_STEP)
            }

            return {
                ...item,
                zIndex: newZ,
            }
        })

        // 2. Immediate local state update
        _setActiveWidgets(updatedItems)

        // 3. Synchronous memory layers update (Store, Cache & DOM)
        updatedItems.forEach(item => {
            const $item = $widget.list.get(item.id)
            if ($item) {
                $item.zIndex = item.zIndex
            }

            const currentCache = __.ui.widgetCache.get(item.id) || {}
            __.ui.widgetCache.set(item.id, {
                ...currentCache,
                zIndex: item.zIndex,
            })

            updateWidgetDOM(item.id, item.zIndex)
        })

        // 4. Asynchronous database persistence
        const persistencePromises = updatedItems.map(async (item) => {
            const currentPos = await __.ui.widgetManager.getWidgetPosition(item.id)
            if (currentPos) {
                return __.ui.widgetManager.saveWidgetPosition(item.id, {
                    ...currentPos,
                    zIndex: item.zIndex,
                }, false)
            }
        })

        await Promise.all(persistencePromises)
    }
    /**
     * SortableJS lifecycle management.
     */
    useEffect(() => {
        const el = _viewRef.current
        if (!el || _activeWidgets.length === 0) {
            return
        }

        _sortableInstance.current = new Sortable(el, {
            animation:       150,
            ghostClass:      'sortable-ghost',
            filter:          '.widget-row-fixed, .sortable-widget-actions',
            preventOnFilter: true,

            onMove: (evt) => {
                if (evt.related.classList.contains('widget-row-fixed')) {
                    evt.to.classList.add('drop-is-forbidden')
                    return false
                }
                evt.to.classList.remove('drop-is-forbidden')
                evt.to.classList.add('drop-is-allowed')
                return true
            },

            onEnd: (evt) => {
                evt.to.classList.remove('drop-is-forbidden', 'drop-is-allowed')
                const {oldIndex, newIndex} = evt
                if (oldIndex !== newIndex) {
                    handleReorder(oldIndex, newIndex)
                }
            },
        })

        return () => {
            _sortableInstance.current?.destroy()
            _sortableInstance.current = null
        }
    }, [_activeWidgets])

    if (_activeWidgets.length === 0) {
        return null
    }

    return (
        <div className="widget-ordering-panel lgs-card">
            <div className="widget-deck-entry widget-deck-title">
                <SlIcon library="fa" name={FA2SL.set(faAnglesUpDown)} className="icon-main-title"/>
                <span>Widget Stack</span>
            </div>

            <div className="widget-list-container">
                <div className="widget-sortable-list" ref={_viewRef}>
                    {_activeWidgets.map((w) => (
                        <SortableWidgetRow key={w.id} widget={w}/>
                    ))}
                </div>
            </div>
        </div>
    )
}