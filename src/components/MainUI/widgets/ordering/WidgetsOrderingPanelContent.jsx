/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetsOrderingPanelContent.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-24
 * Last modified: 2026-02-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGSScrollbars } from '@Components/MainUI/LGSScrollbars'
import { CREDITS_WIDGET, WIDGET_LAYER_START, WIDGET_LAYER_STEP, WIDGET_LAYER_TOP } from '@Core/constants'
import { useEffect, useRef, useState } from 'react'
import Sortable              from 'sortablejs'
import { useSnapshot }       from 'valtio'
import { SortableWidgetRow } from './SortableWidgetRow'

export const WidgetsOrderingPanelContent = ({widgetsBoard}) => {
    const _scrollRef = useRef(null)
    const _sortableInstance = useRef(null)
    const [_activeWidgets, _setActiveWidgets] = useState([])

    const $widget = lgs.stores.ui.widget
    const widget = useSnapshot($widget)

    const updateWidgetDOM = (id, zIndex) => {
        const el = document.querySelector(`.lgs-widget-container[data-widget="${id}"]`)
        if (el) {
            el.style.zIndex = zIndex
        }
    }

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
                    const currentZ = widgetType === CREDITS_WIDGET
                                     ? WIDGET_LAYER_TOP
                                     : (position?.zIndex && position.zIndex !== 0)
                                       ? position.zIndex
                                       : (WIDGET_LAYER_START + index * WIDGET_LAYER_STEP)

                    return {
                        id,
                        zIndex: parseInt(currentZ),
                        type:   widgetType,
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

    const handleReorder = async (oldIndex, newIndex) => {
        const newList = [..._activeWidgets]
        const [movedItem] = newList.splice(oldIndex, 1)
        if (movedItem.fixed) {
            return
        }

        newList.splice(newIndex, 0, movedItem)
        const totalItems = newList.length

        const updatedItems = newList.map((item, index) => {
            let newZ
            if (item.type === CREDITS_WIDGET) {
                newZ = WIDGET_LAYER_TOP
            }
            else {
                const reversedIndex = totalItems - 1 - index
                newZ = WIDGET_LAYER_START + (reversedIndex * WIDGET_LAYER_STEP)
            }
            return {...item, zIndex: newZ}
        })

        _setActiveWidgets(updatedItems)

        updatedItems.forEach(item => {
            const $item = $widget.list.get(item.id)
            if ($item) {
                $item.zIndex = item.zIndex
            }

            const currentCache = __.ui.widgetCache.get(item.id) || {}
            __.ui.widgetCache.set(item.id, {...currentCache, zIndex: item.zIndex})

            updateWidgetDOM(item.id, item.zIndex)
        })

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

    useEffect(() => {
        const scrollComponent = _scrollRef.current
        if (!scrollComponent || _activeWidgets.length === 0) {
            return
        }

        const el = scrollComponent.view.querySelector('.widget-sortable-list')
        if (!el) {
            return
        }

        _sortableInstance.current = new Sortable(el, {
            animation:  150,
            ghostClass: 'sortable-ghost',
            filter:     '.widget-row-fixed, .sortable-widget-actions',
            preventOnFilter: true,
            scroll:     scrollComponent.view,
            scrollSensitivity: 50,
            scrollSpeed: 15,
            onEnd: (evt) => {
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

    return (
        <div className="widget-ordering-panel lgs-card">
            <div className="widget-list-container">
                <LGSScrollbars ref={_scrollRef} autoHide>
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