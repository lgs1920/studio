/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SortableWidgetRow.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-20
 * Last modified: 2026-06-20
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { EDIT_WIDGET_ICON }                   from '@Core/constants'
import { WaButton, WaCard, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import { useMemo }                             from 'react'
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

    const centerWidget = async (event) => {
        event?.preventDefault?.()
        event?.stopPropagation?.()

        const element = __.ui.widgetManager.getElementById(widget.id)
        if (!element) {
            return
        }

        __.ui.widgetManager.toCenter(element, lgs.gutter.xs ?? 0)
    }

    const removeWidget = async (event) => {
        event?.preventDefault?.()
        event?.stopPropagation?.()
        await __.ui.widgetManager.removeWidget(widget.id)
    }

    const editWidget = async (event) => {
        event?.preventDefault?.()
        event?.stopPropagation?.()
        __.ui.widgetManager.editWidget(widget.id, {stacked: true})
    }

    return (
        <WaCard appearance="outlined"
                onClick={() => selectWidget(widget.id)}
                className={`lgs--card-hoverable widget-ordering-row ${widget.fixed ? 'widget-row-fixed' : ''}`}
                data-id={widget.id}
        >
            <WaIcon name="grip-dots-vertical" variant="solid" className="icon-widget"/>&nbsp;
            <WaIcon name={instance.icon} variant="regular" className="icon-widget"/>
            <div className="sortable-widget-info">
                {displayName}
            </div>
            <div className="widget-ordering-actions">
                <WaTooltip placement="top" for={`center-widget-${widget.id}`}>{'Recenter'}</WaTooltip>
                <WaButton
                    id={`center-widget-${widget.id}`}
                    size="s"
                    appearance="plain"
                    variant="neutral"
                    className="widget-ordering-action-button"
                    aria-label="Recenter"
                    disabled={!__.ui.widgetManager.getElementById(widget.id)}
                    onClick={centerWidget}
                >
                    <WaIcon name="plus" variant="regular"/>
                </WaButton>

                <WaTooltip placement="top" for={`edit-widget-${widget.id}`}>{'Edit'}</WaTooltip>
                <WaButton
                    id={`edit-widget-${widget.id}`}
                    appearance="plain"
                    variant="brand"
                    className="widget-ordering-action-button"
                    aria-label="Edit"
                    onClick={editWidget}
                    size="s"
                >
                    <WaIcon name={EDIT_WIDGET_ICON} variant="regular"/>
                </WaButton>

                <WaTooltip placement="top" for={`remove-widget-${widget.id}`}>{'Remove'}</WaTooltip>
                <WaButton
                    id={`remove-widget-${widget.id}`}
                    appearance="plain"
                    variant="danger"
                    className="widget-ordering-action-button"
                    aria-label="Remove"
                    onClick={removeWidget}
                    size="s"
                >
                    <WaIcon name="trash-can" variant="regular"/>
                </WaButton>
            </div>
        </WaCard>
    )
}
