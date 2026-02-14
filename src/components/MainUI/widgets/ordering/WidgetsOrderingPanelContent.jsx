/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetsOrderingPanelContent.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-14
 * Last modified: 2026-02-14
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

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
     * Filters and sorts widgets.
     * Priority: onTop (desc) > zIndex (desc).
     */
    const activeWidgets = useMemo(() => {
        if (!widget.list) {
            return []
        }

        const filteredIds = Array.from(widget.list.entries())
            .filter(([, w]) => w?.widgetsBoard === widgetsBoard)
            .map(([id]) => id)

        const list = filteredIds.map(id => {
            const widgetType = id.split('#')[0]
            const instance = lgs.settings.widgets[widgetType]
            if (!instance) {
                return null
            }

            const {configuration} = instance

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
                onTop: instance.alwaysOnTop ?? false,
                fixed: instance.fixedPosition ?? false,
            }
        }).filter(Boolean)

        // Multi-level sort: onTop elements first, then by zIndex
        list.sort((a, b) => {
            if (a.onTop !== b.onTop) {
                return b.onTop ? 1 : -1
            }
            return b.zIndex - a.zIndex
        })

        return list
    }, [widget.list, widgetsBoard])

    /**
     * Initialize SortableJS with lock constraints for fixed elements.
     */
    useEffect(() => {
        const el = _viewRef.current?.getScrollElement ? _viewRef.current.getScrollElement() : _viewRef.current

        if (el && activeWidgets.length > 0) {
            if (_sortableInstance.current) {
                _sortableInstance.current.destroy()
            }
            _sortableInstance.current = new Sortable(el, {
                animation:  150,
                ghostClass: 'sortable-ghost',
                filter:     '.widget-row-fixed, .sortable-widget-actions',
                preventOnFilter: true,
                onMove:     (evt) => {
                    const isTargetFixed = evt.related.classList.contains('widget-row-fixed')
                    const parentEl = evt.to

                    if (isTargetFixed) {
                        parentEl.classList.add('drop-is-forbidden')
                        parentEl.classList.remove('drop-is-allowed')
                        return false
                    }
                    else {
                        parentEl.classList.add('drop-is-allowed')
                        parentEl.classList.remove('drop-is-forbidden')
                        return true
                    }
                },

                onEnd: (evt) => {
                    const parentEl = evt.to
                    parentEl.classList.remove('drop-is-forbidden', 'drop-is-allowed')

                    const {oldIndex, newIndex} = evt
                    if (oldIndex !== newIndex && !activeWidgets[oldIndex].fixed) {
                        //_.ui.widgetManager.reorder(activeWidgets[oldIndex].id, activeWidgets[newIndex].id)
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
        <div className="widget-ordering-panel lgs-card">
            <div className="widget-deck-entry widget-deck-title">
                <SlIcon library="fa" name={FA2SL.set(faAnglesUpDown)} className="icon-main-title"/>
                <span>{'Widget Stack'}</span>
            </div>

            <div className="widget-list-container">
                <div className="widget-sortable-list" ref={_viewRef}>
                    {activeWidgets.map((w) => (
                        <SortableWidgetRow key={w.id} widget={w}/>
                    ))}
                </div>
            </div>
        </div>
    )
}