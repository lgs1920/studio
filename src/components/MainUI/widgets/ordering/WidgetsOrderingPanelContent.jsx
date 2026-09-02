/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetsOrderingPanelContent.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-02-13
 * Last modified: 2026-09-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGSScrollbars } from '@Components/MainUI/LGSScrollbars'
import {
    CREDITS_WIDGET, LOGO_WIDGET, REPLAY_TIMELINE_WIDGET, WIDGET_LAYER_START, WIDGET_LAYER_STEP,
} from '@Core/constants'
import { WaCard, WaDivider }                        from '@web.awesome.me/webawesome-pro/dist/react'
import classNames from 'classnames'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import Sortable              from 'sortablejs'
import { useSnapshot }       from 'valtio'
import { groupWidgetEntries } from '@Core/ui/widget-manager/WidgetGroupUtils'
import { SortableWidgetRow } from './SortableWidgetRow'
import { SortableWidgetGroupRow } from './SortableWidgetGroupRow'

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
                const _elementConfig = _instance.configuration?.elements?.[id]
                    ?? _instance.configuration?.user
                    ?? _instance.configuration?.default

                return {
                    id,
                    zIndex: parseInt(_currentZ, 10),
                    type:   _widgetType,
                    label:  _elementConfig?.text?.content ?? _instance.name ?? _widgetType,
                    fixed:  _instance.fixedPosition ?? false,
                    canHide: _instance.canHide === true || __.ui.widgetManager.getWidgetConfig(id)?.canHide === true,
                    visible: entry?.visible !== false,
                    widgetGroup: entry?.widgetGroup ?? null,
                }
            })
            .filter(Boolean)
            .sort((a, b) => b.zIndex - a.zIndex)
    }, [widget.list, widgetsBoard, excludedWidgetTypeSet])

    const widgetRows = useMemo(() => groupWidgetEntries(activeWidgets), [activeWidgets])

    /**
     * Finalizes the new order by updating all layers (state, store, cache, disk)
     */
    const finalizeReorder = useCallback(async newOrderedIds => {
        const orderedRows = newOrderedIds
            .map(id => widgetRows.find(row => row.id === id))
            .filter(Boolean)
        await __.ui.widgetManager.reorderWidgetLayers(orderedRows)
    }, [widgetRows])

    /**
     * SortableJS Initialization
     */
    useEffect(() => {
        if (!_list.current || widgetRows.length === 0) {
            _sortable.current?.destroy()
            _sortable.current = null
            return
        }
        if (_sortable.current) {
            return
        }

        _sortable.current = new Sortable(_list.current, {
            animation:   150,
            forceFallback: true,
            dataIdAttr:  'data-id',
            handle:      '.widget-ordering-row, .widget-ordering-group-handle',
            filter:      '.widget-row-fixed',
            ghostClass:  'widget-row-ghost',
            chosenClass: 'widget-row-chosen',
            dragClass:   'widget-row-drag',
            onEnd:       () => {
                // We get the IDs from the DOM nodes as they are NOW
                const _newIds = _sortable.current.toArray()
                void finalizeReorder(_newIds)
            },
        })

        return () => {
            _sortable.current?.destroy()
            _sortable.current = null
        }
    }, [widgetRows, finalizeReorder])

    return (
        <WaCard appearance="plain" className={classNames('widget-ordering-panel', {'widget-ordering-panel-fill': fillHeight})}>
            <div className="widget-list-container">
                <LGSScrollbars ref={_scroll} autoHide>
                    <div ref={_list} className="widget-sortable-list">
                        {widgetRows.map(row => row.isGroup
                            ? <SortableWidgetGroupRow key={row.id} group={row}/>
                            : <SortableWidgetRow key={row.id} widget={row}/>
                        )}
                    </div>
                </LGSScrollbars>
            </div>
            <WaDivider/>
        </WaCard>
    )
}
