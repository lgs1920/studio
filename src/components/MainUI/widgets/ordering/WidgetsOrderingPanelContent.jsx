/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetsOrderingPanelContent.jsx
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

import { LGSScrollbars }              from '@Components/MainUI/LGSScrollbars'
import { faAnglesUpDown }             from '@fortawesome/pro-regular-svg-icons'
import { SlIcon }                     from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                      from '@Utils/FA2SL'
import { useEffect, useMemo, useRef } from 'react'
import Sortable                       from 'sortablejs'
import { useSnapshot }                from 'valtio'
import { SortableWidgetRow }          from './SortableWidgetRow'

/**
 * Main content for the widget ordering panel.
 * Uses SortableJS attached to the inner view of LGSScrollbars.
 * * @param {Object} props
 * @param {string} props.widgetsBoard - The target board ID to filter widgets
 */
export const WidgetsOrderingPanelContent = ({widgetsBoard}) => {
    const _viewRef = useRef(null)
    const _sortableInstance = useRef(null)

    // Valtio stores
    const $widget = lgs.stores.ui.widget
    const widget = useSnapshot($widget)

    /**
     * Filters and sorts active widgets from the store based on the board.
     */
    const activeWidgets = useMemo(() => {
        // Return early if the Valtio snapshot list is unavailable
        if (!widget.list) {
            return []
        }

        // Filter IDs by widgetsBoard from the Valtio proxyMap snapshot
        const filteredIds = Array.from(widget.list.entries())
            .filter(([, w]) => w?.widgetsBoard === widgetsBoard)
            .map(([id]) => id)

        // Map IDs to curated objects with  name fallbacks and icon
        const list = filteredIds.map(id => {
            const widgetType = id.split('#')[0]
            const instance = lgs.settings.widgets[widgetType]
            if (!instance) {
                return null
            }
            const {configuration} = instance

            console.log(instance.name)

            const name = (configuration
                          ? (configuration.elements?.[id]?.text?.content
                        ?? configuration.user?.text?.content
                        ?? configuration.default?.text?.content
                        ?? instance.name)
                          : instance.name)
                ?? instance.name
            return {
                id,
                name,
                icon:   instance.icon,
                zIndex: instance.zIndex ?? 0,
                type:   widgetType,
            }
        })
            .filter(Boolean) // Ensure no null instances persist in the list

        // 5. Sort by zIndex (descending order for layer management)
        list.sort((a, b) => b.zIndex - a.zIndex)

        // Production-oriented logging for debugging purposes
        console.log('--- Active Widgets (Key/Object) ---')
        list.forEach(item => {
            console.log(`Key: ${item.id}`, item)
        })

        return list
    }, [widget.list, widgetsBoard])

    /**
     * Initialize SortableJS on the scrollbar's view element.
     */
    useEffect(() => {
        if (_viewRef.current && activeWidgets.length > 0) {
            // Clean up previous instance if any
            if (_sortableInstance.current) {
                _sortableInstance.current.destroy()
            }

            _sortableInstance.current = new Sortable(_viewRef.current, {
                animation:    150,
                handle:       '.reorder',      // Only the grip triggers the sort
                scroll:       true,            // Enable auto-scroll
                bubbleScroll: true,
                invertSwap:   true,
                ghostClass:   'sortable-ghost',
                // Prevents button clicks from initiating a drag
                filter:          '.sortable-widget-actions',
                preventOnFilter: true,

                onEnd: (evt) => {
                    const {oldIndex, newIndex} = evt
                    if (oldIndex !== newIndex) {
                        const movedId = activeWidgets[oldIndex].id
                        const targetId = activeWidgets[newIndex].id

                        // Production manager call to update z-indices
                    }
                },
            })
        }

        return () => {
            if (_sortableInstance.current) {
                _sortableInstance.current.destroy()
                _sortableInstance.current = null
            }
        }
    }, [activeWidgets])

    if (activeWidgets.length === 0) {
        return null
    }

    return (
        <div className="widget-ordering-panel lgs-card on-map">
            {/* This header is the 'handle' for the Parent Widget container
             as defined in Widget.jsx (config.handle)
             */}
            <div className="widget-deck-entry widget-deck-title">
                <SlIcon library="fa" name={FA2SL.set(faAnglesUpDown)} className="icon-main-title"/>
                <span>{'Widget Stack'}</span>
            </div>

            <div className="widget-list-container">
                {/* <LGSScrollbars ref={_viewRef}> */}
                <div className="widget-sortable-list">
                    {activeWidgets.map((w) => (
                        <SortableWidgetRow key={w.id} widget={w}/>
                    ))}
                </div>
                {/* </LGSScrollbars> */}
            </div>
        </div>
    )
}