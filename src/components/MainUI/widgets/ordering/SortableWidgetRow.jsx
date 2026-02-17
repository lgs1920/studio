/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SortableWidgetRow.jsx
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

import { WIDGETS_CONFIGURATION } from '@Core/constants'
import { SlIcon }                from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                 from '@Utils/FA2SL'

/**
 * Row component for the sortable list.
 * Applies conditional 'is-fixed' class for SortableJS filtering.
 * * @param {Object} props
 * @param {Object} props.widget - The widget data object
 */
export const SortableWidgetRow = ({widget}) => {
    const widgetConf = WIDGETS_CONFIGURATION.get(widget.type)
    const iconToRender = widgetConf?.icon

    /**
     * Handles widget selection from the panel.
     * @param {string} id
     */
    const selectWidget = (id) => {
        // 1. Update your global selection store
        lgs.stores.ui.widget.selected = id

        // 2. Give React/Browser a tick to update the DOM
        setTimeout(() => {
            const moveable = __.ui.widgetManager.getMoveable(id)
            console.log(moveable)
            if (moveable?.current) {
                moveable.current.updateRect()
            }
        }, 0)
    }

    return (
        <div onClick={() => selectWidget(widget.id)}
            className={`widget-ordering-row lgs-one-line-card ${widget.fixed ? 'widget-row-fixed' : ''}`}
            data-id={widget.id}
        >
            <SlIcon library="fa" name={FA2SL.set(iconToRender)} className="icon-widget"/>

            <div className="sortable-widget-info">
                {widget.zIndex} {widget.name.length > 15 ? `${widget.name.slice(0, 15)}...` : widget.name}
            </div>
        </div>
    )
}