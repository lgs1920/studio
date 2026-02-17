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

import { LGSScrollbars } from '@Components/MainUI/LGSScrollbars'
import { CREDITS_WIDGET, WIDGET_LAYER_START, WIDGET_LAYER_STEP, WIDGET_LAYER_TOP } from '@Core/constants'
import {
    faAnglesUpDown,
}                                                                                  from '@fortawesome/pro-regular-svg-icons'
import {
    SlIcon,
}                                                                                  from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                                   from '@Utils/FA2SL'
import { useEffect, useRef, useState } from 'react'
import { Scrollbars }    from 'react-custom-scrollbars-2'
import Sortable                                                                    from 'sortablejs'
import { useSnapshot }                                                             from 'valtio'
import { SortableWidgetRow }                                                       from './SortableWidgetRow'

/**
 * Main content for the widget ordering panel.
 * Synchronizes SortableJS drag-and-drop with Valtio store, Cache, and Persistence.
 * Uses react-custom-scrollbars-2 for the UI and SortableJS for interaction.
 *
 * @param {Object} props
 * @param {string} props.widgetsBoard - The target board ID to filter widgets
 */
export const WidgetsOrderingPanelContent = ({widgetsBoard}) => {
    const _scrollRef = useRef(null)
    const _sortableInstance = useRef(null)
    const [_activeWidgets, _setActiveWidgets] = useState([])

    const $widget = lgs.stores.ui.widget
    const widget = useSnapshot($widget)

    /**
     * Updates the DOM element for a specific widget container.
     * Provides immediate visual feedback before React re-renders.
     * @param {string} id
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
                // Sorting descending: first in list = highest zIndex
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
     * @param {number} oldIndex
     * @param {number} newIndex
     */
    const handleReorder = async (oldIndex, newIndex) => {
        const newList = [..._activeWidgets]
        const [movedItem] = newList.splice(oldIndex, 1)

        if (movedItem.fixed) {
            return
        }

        newList.splice(newIndex, 0, movedItem)

        const totalItems = newList.length

        // 1. Calculate new values based on visual order
        const updatedItems = newList.map((item, index) => {
            let newZ

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

        // 2. Local state update
        _setActiveWidgets(updatedItems)

        // 3. Synchronous updates
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

        // 4. Persistence
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
     * Targets the inner list while using the Scrollbars view for auto-scroll.
     */
    useEffect(() => {
        const scrollComponent = _scrollRef.current
        if (!scrollComponent || _activeWidgets.length === 0) {
            return
        }

        // Target the inner div containing the actual items
        const el = scrollComponent.view.querySelector('.widget-sortable-list')

        if (!el) {
            return
        }

        _sortableInstance.current = new Sortable(el, {
            animation:       150,
            ghostClass:      'sortable-ghost',
            filter:          '.widget-row-fixed, .sortable-widget-actions',
            preventOnFilter: true,

            // Handle auto-scroll via the Scrollbars internal view
            scroll:            scrollComponent.view,
            scrollSensitivity: 50,
            scrollSpeed:       15,

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
        <div className="widget-ordering-panel">
            <div className="widget-deck-entry widget-deck-title">
                <SlIcon library="fa" name={FA2SL.set(faAnglesUpDown)} className="icon-main-title"/>
                <span>Widget Stack</span>
            </div>

            <div className="widget-list-container">
                <LGSScrollbars
                    ref={_scrollRef}
                    autoHeight
                    autoHeightMax={400}
                    autoHide
                >
                    <div className="widget-sortable-list">
                        {_activeWidgets.map((w) => (
                            <SortableWidgetRow key={w.id} widget={w}/>
                        ))}
                    </div>
                </LGSScrollbars>
            </div>
        </div>
    )
}