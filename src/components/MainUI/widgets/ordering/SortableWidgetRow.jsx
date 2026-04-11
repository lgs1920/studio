/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SortableWidgetRow.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-11
 * Last modified: 2026-04-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaCard, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import React, { useMemo } from 'react'
import { useSnapshot }    from 'valtio'

/**
 * Row component for the sortable list.
 * Targets the specific configuration proxy for name reactivity.
 * * @param {Object} props - Component properties.
 * @param {Object} props.widget - Widget data object.
 */
export const SortableWidgetRow = ({widget}) => {
    /** @type {string} Extract widget base type from id */
    const widgetType = widget.id.split('#')[0]

    /** @type {Object} Valtio proxy reference */
    const $instance = lgs.settings.widgets[widgetType]

    /** @type {Object} Local snapshot for reactivity */
    const instance = useSnapshot($instance)

    /** @type {Object} Resolved element configuration from snapshot */
    const elementConfig = instance?.configuration?.elements?.[widget.id]
        ?? instance?.configuration?.user
        ?? instance?.configuration?.default

    /**
     * Resolves name by looking into the reactive configuration.
     * Prevents re-computation unless specific snapshot values change.
     */
    const displayName = useMemo(() => {
        const rawName = elementConfig?.text?.content
            ?? instance?.name
            ?? widget.type

        return rawName.length > 25 ? `${rawName.slice(0, 25)}...` : rawName
    }, [elementConfig?.text?.content, instance?.name, widget.type])

    /**
     * Updates global UI state and forces Moveable refresh.
     * @param {string} id - Widget identifier.
     */
    const selectWidget = (id) => {
        lgs.stores.ui.widget.selected = id

        // Ensure Moveable updates after DOM cycle
        setTimeout(() => {
            const _moveable = __.ui.widgetManager.getMoveable(id)
            if (_moveable?.current) {
                _moveable.current.updateRect()
            }
        }, 0)
    }

    return (
        <WaCard appearance="outlined"
                onClick={() => selectWidget(widget.id)}
                className={`widget-ordering-row ${widget.fixed ? 'widget-row-fixed' : ''}`}
                data-id={widget.id}
        >
            <WaIcon name="grip-dots-vertical" variant="solid" className="icon-widget"/>&nbsp;
            <WaIcon name={instance.icon} variant="regular" className="icon-widget"/>
            <div className="sortable-widget-info">
                {displayName}
            </div>
        </WaCard>
    )
}