/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SortableWidgetRow.jsx
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

import { WIDGETS_CONFIGURATION } from '@Core/constants'
import { SlIcon }                from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                 from '@Utils/FA2SL'
import { useSnapshot }           from 'valtio'
import React, { useMemo }        from 'react'

/**
 * Row component for the sortable list.
 * Targets the specific configuration proxy for name reactivity.
 */
export const SortableWidgetRow = ({widget}) => {
    // 1. We need to target the ACTUAL configuration proxy to be reactive
    const widgetType = widget.id.split('#')[0]
    const $instance = lgs.settings.widgets[widgetType]

    // We snapshot the instance and the specific element config
    const instance = useSnapshot($instance)
    const elementConfig = instance?.configuration?.elements?.[widget.id]
        ?? instance?.configuration?.user
        ?? instance?.configuration?.default

    const widgetConf = WIDGETS_CONFIGURATION.get(widget.type)
    const iconToRender = widgetConf?.icon

    /**
     * Resolves name by looking into the reactive configuration.
     */
    const displayName = useMemo(() => {
        // We look for the text content in the reactive elementConfig
        const rawName = elementConfig?.text?.content
            ?? instance?.name
            ?? widget.type

        return rawName.length > 25 ? `${rawName.slice(0, 25)}...` : rawName
    }, [elementConfig?.text?.content, instance?.name, widget.type])

    const selectWidget = (id) => {
        lgs.stores.ui.widget.selected = id
        setTimeout(() => {
            const moveable = __.ui.widgetManager.getMoveable(id)
            if (moveable?.current) {
                moveable.current.updateRect()
            }
        }, 0)
    }

    return (
        <div
            onClick={() => selectWidget(widget.id)}
            className={`widget-ordering-row lgs-one-line-card ${widget.fixed ? 'widget-row-fixed' : ''}`}
            data-id={widget.id}
        >
            <SlIcon library="fa" name={FA2SL.set(iconToRender)} className="icon-widget"/>
            <div className="sortable-widget-info">
                {displayName}
            </div>
        </div>
    )
}