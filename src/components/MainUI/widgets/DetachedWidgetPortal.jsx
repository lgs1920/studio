/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DetachedWidgetPortal.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-10
 * Last modified: 2026-09-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { DynamicWidget } from '@Components/MainUI/widgets/DynamicWidget'
import { JOURNEY_WIDGETS, SCENE_WIDGETS_BOARD } from '@Core/constants'
import { WaCard } from '@web.awesome.me/webawesome-pro/dist/react'
import { createPortal } from 'react-dom'
import { useSnapshot } from 'valtio'

/**
 * Resolve the catalog definition for a widget instance.
 *
 * @param {string|null|undefined} widgetId - Widget instance identifier.
 * @param {Object|null|undefined} widgetConfig - Runtime widget configuration.
 * @param {Object|null|undefined} widgetEntry - Persisted widget entry.
 * @returns {Object|null} Catalog definition or null when it cannot be resolved.
 */
const resolveWidgetDefinition = (widgetId, widgetConfig, widgetEntry) => {
    const baseId = typeof widgetId === 'string' ? widgetId.split('#')[0] : widgetId
    const groupId = widgetConfig?.group ?? widgetEntry?.group
    return globalThis.__?.widgets?.get?.(groupId)?.widgets?.get?.(baseId) ?? null
}

/**
 * Render the detached widget into the document owned by its external window.
 *
 * @returns {JSX.Element|null} The external-window portal, when one is active.
 */
export const DetachedWidgetPortal = () => {
    const widget = useSnapshot(lgs.stores.ui.widget)
    const widgetId = widget.undocked?.id ?? null
    const portalState = __.ui.widgetWindowManager?.getPortalState(widgetId)
    const widgetEntry = widgetId ? widget.list?.get(widgetId) : null
    const widgetConfig = widgetId ? __.ui.widgetManager?.getWidgetConfig?.(widgetId) : null
    const widgetDefinition = resolveWidgetDefinition(widgetId, widgetConfig, widgetEntry)
    const widgetTitle = widgetConfig?.name
                       ?? widgetEntry?.name
                       ?? widgetDefinition?.name
                       ?? widgetId?.split('#')[0]
                       ?? 'Detached widget'
    const entry = widgetEntry ?? {
        group:        JOURNEY_WIDGETS,
        widgetsBoard: SCENE_WIDGETS_BOARD,
    }
    const detachedProps = {
        ...entry,
        group:        entry.group ?? widgetConfig?.group ?? JOURNEY_WIDGETS,
        widgetsBoard: SCENE_WIDGETS_BOARD,
        zIndex:       entry.zIndex ?? widgetConfig?.zIndex,
        detached:     true,
    }

    if (!widgetId
        || !portalState?.container
        || !portalState.container.isConnected) {
        return null
    }

    return createPortal(
        <WaCard className="lgs-detached-window-card" appearance="filled" orientation="vertical">
            <span slot="header">{widgetTitle}</span>
            <div className="lgs-detached-window-content">
                <DynamicWidget key={`detached-${widgetId}`} id={widgetId} props={detachedProps}/>
            </div>
        </WaCard>,
        portalState.container,
    )
}
