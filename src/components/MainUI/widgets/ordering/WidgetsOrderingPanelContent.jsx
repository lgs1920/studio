/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetsOrderingPanelContent.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-04-12
 * Last modified: 2026-04-12
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGSScrollbars } from '@Components/MainUI/LGSScrollbars'
import {
    CREDITS_WIDGET, LOGO_WIDGET, REPLAY_TIMELINE_WIDGET, WIDGET_LAYER_START, WIDGET_LAYER_STEP, WIDGET_LAYER_TOP,
} from '@Core/constants'
import { WaCard, WaDivider }                        from '@web.awesome.me/webawesome-pro/dist/react'
import classNames from 'classnames'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import Sortable              from 'sortablejs'
import { useSnapshot }       from 'valtio'
import { SortableWidgetRow } from './SortableWidgetRow'

const NO_EXCLUDED_WIDGET_TYPES = []
const CORE_FIXED_WIDGET_TYPES = [CREDITS_WIDGET, LOGO_WIDGET, REPLAY_TIMELINE_WIDGET]

export const WidgetsOrderingPanelContent = ({
    widgetsBoard,
    excludedWidgetTypes = NO_EXCLUDED_WIDGET_TYPES,
    fillHeight = false,
}) => {
    const _scroll = useRef(null)
    const _sortable = useRef(null)
    const _list = useRef(null)

    const $widget = lgs.stores.ui.widget
    const widget = useSnapshot($widget)
    const excludedWidgetTypeSet = useMemo(() => new Set(excludedWidgetTypes), [excludedWidgetTypes])

    /**
     * Direct DOM update for z-index to avoid re-render flicker
     */
    const updateWidgetDOM = (id, zIndex) => {
        const _el = document.querySelector(`.lgs-widget-container[data-widget="${id}"]`)
        if (_el) {
            _el.style.zIndex = zIndex
        }
    }

    const activeWidgets = useMemo(() => {
        if (!widget.list) {
            return []
        }

        return Array.from(widget.list.entries())
            .filter(([id, entry]) => {
                const _widgetType = id.split('#')[0]
                return entry?.widgetsBoard === widgetsBoard &&
                    !CORE_FIXED_WIDGET_TYPES.includes(_widgetType) &&
                    !excludedWidgetTypeSet.has(_widgetType)
            })
            .map(([id, entry], index) => {
                const _widgetType = id.split('#')[0]
                const _instance = lgs.settings.widgets[_widgetType]
                if (!_instance) {
                    return null
                }

                const _cacheEntry = __.ui.widgetCache.get(id)
                const _currentZ = Number(entry?.zIndex ?? _cacheEntry?.zIndex)
                    || (WIDGET_LAYER_START + index * WIDGET_LAYER_STEP)

                return {
                    id,
                    zIndex: parseInt(_currentZ, 10),
                    type:   _widgetType,
                    fixed:  _instance.fixedPosition ?? false,
                    canHide: _instance.canHide === true || __.ui.widgetManager.getWidgetConfig(id)?.canHide === true,
                    visible: entry?.visible !== false,
                }
            })
            .filter(Boolean)
            .sort((a, b) => b.zIndex - a.zIndex)
    }, [widget.list, widgetsBoard, excludedWidgetTypeSet])

    /**
     * Finalizes the new order by updating all layers (state, store, cache, disk)
     */
    const finalizeReorder = useCallback(async (newOrderedIds) => {
        const _totalItems = newOrderedIds.length

        // 1. Create the new sorted array based on DOM order
        const _updatedItems = newOrderedIds.map((id, index) => {
            const _item = activeWidgets.find(w => w.id === id)
            const _reversedIndex = _totalItems - 1 - index
            const _newZ = CORE_FIXED_WIDGET_TYPES.includes(_item?.type)
                          ? WIDGET_LAYER_TOP
                          : WIDGET_LAYER_START + (_reversedIndex * WIDGET_LAYER_STEP)

            return {..._item, zIndex: _newZ}
        }).filter(Boolean)

        // 2. Update reactive sources synchronously to avoid intermediate re-sorts
        for (const _item of _updatedItems) {
            const $target = $widget.list.get(_item.id)
            if ($target) {
                $target.zIndex = _item.zIndex
            }

            const _cache = __.ui.widgetCache.get(_item.id) || {}
            __.ui.widgetCache.set(_item.id, {..._cache, zIndex: _item.zIndex})

            updateWidgetDOM(_item.id, _item.zIndex)
        }

        // 3. Persist the final order after the UI/store state is already coherent
        await Promise.all(_updatedItems.map(async (_item) => {
            const _pos = await __.ui.widgetManager.getWidgetPosition(_item.id)
            if (_pos) {
                await __.ui.widgetManager.saveWidgetPosition(_item.id, {..._pos, zIndex: _item.zIndex}, false)
            }
        }))
    }, [activeWidgets, $widget])

    /**
     * SortableJS Initialization
     */
    useEffect(() => {
        if (!_list.current || activeWidgets.length === 0) {
            return
        }
        if (_sortable.current) {
            return
        }

        _sortable.current = new Sortable(_list.current, {
            animation:   150,
            forceFallback: true,
            dataIdAttr:  'data-id',
            handle:      '.widget-ordering-row',
            filter:      '.widget-row-fixed',
            ghostClass:  'widget-row-ghost',
            chosenClass: 'widget-row-chosen',
            dragClass:   'widget-row-drag',
            onEnd:       () => {
                // We get the IDs from the DOM nodes as they are NOW
                const _newIds = _sortable.current.toArray()
                finalizeReorder(_newIds)
            },
        })

        return () => {
            _sortable.current?.destroy()
            _sortable.current = null
        }
    }, [activeWidgets, finalizeReorder]) // We re-init or keep alive based on the list

    return (
        <WaCard appearance="plain" className={classNames('widget-ordering-panel', {'widget-ordering-panel-fill': fillHeight})}>
            <div className="widget-list-container">
                <LGSScrollbars ref={_scroll} autoHide>
                    <div ref={_list} className="widget-sortable-list">
                        {activeWidgets.map((w) => (
                            <SortableWidgetRow key={w.id} widget={w}/>
                        ))}
                    </div>
                </LGSScrollbars>
            </div>
            <WaDivider/>
        </WaCard>
    )
}
