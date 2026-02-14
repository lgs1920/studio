/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetsOrderingPanelContent.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-15
 * Last modified: 2026-02-15
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { faAnglesUpDown }             from '@fortawesome/pro-regular-svg-icons'
import { SlIcon }                     from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                      from '@Utils/FA2SL'
import { useEffect, useRef, useState } from 'react'
import Sortable                       from 'sortablejs'
import { useSnapshot }                from 'valtio'
import { SortableWidgetRow }          from './SortableWidgetRow'

/**
 * Main content for the widget ordering panel.
 * Handles asynchronous widget position management and DOM notification for zIndex changes.
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
     * Updates the DOM element for a specific widget to reflect the new zIndex.
     * This targets .lgs-widget-container elements with the matching data-widget attribute.
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
     * Loads widget data asynchronously.
     * Fetches positions using the async getWidgetPosition method.
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

                    const currentZ = (position?.zIndex && position.zIndex !== 0)
                                     ? position.zIndex
                                     : (10000 - index)

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
     * Updates both the database and the active DOM elements.
     */
    const handleReorder = async (oldIndex, newIndex) => {
        const newList = [..._activeWidgets]
        const [movedItem] = newList.splice(oldIndex, 1)

        if (movedItem.fixed) {
            return
        }

        newList.splice(newIndex, 0, movedItem)

        const TOP_Z_INDEX = 10000
        const STEP = 1

        const updatePromises = newList.map(async (item, index) => {
            const targetZ = TOP_Z_INDEX - (index * STEP)
            const currentPos = await __.ui.widgetManager.getWidgetPosition(item.id)

            if (currentPos) {
                // Update DOM immediately for visual feedback
                updateWidgetDOM(item.id, targetZ)

                // Persist change to database
                return __.ui.widgetManager.saveWidgetPosition(item.id, {
                    ...currentPos,
                    zIndex: targetZ,
                }, false)
            }
        })

        await Promise.all(updatePromises)

        _setActiveWidgets(newList.map((item, index) => ({
            ...item,
            zIndex: TOP_Z_INDEX - (index * STEP),
        })))
    }

    /**
     * SortableJS lifecycle management.
     */
    useEffect(() => {
        const el = _viewRef.current

        if (el && _activeWidgets.length > 0) {
            _sortableInstance.current = new Sortable(el, {
                animation:  150,
                ghostClass: 'sortable-ghost',
                filter:     '.widget-row-fixed, .sortable-widget-actions',
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
                }
            })
        }

        return () => {
            if (_sortableInstance.current) {
                try {
                    _sortableInstance.current.destroy()
                }
                catch (e) {
                    // silent catch
                }
                _sortableInstance.current = null
            }
        }
    }, [_activeWidgets])

    if (_activeWidgets.length === 0) {
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
                    {_activeWidgets.map((w) => (
                        <SortableWidgetRow key={w.id} widget={w}/>
                    ))}
                </div>
            </div>
        </div>
    )
}