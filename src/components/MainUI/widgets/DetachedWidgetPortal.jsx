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
import { WidgetWindowActionButton } from '@Components/MainUI/widgets/WidgetWindowActionButton'
import { isDockableWidgetId, canDockWidget } from '@Core/ui/widget-manager/WidgetDockManager'
import { WaCard } from '@web.awesome.me/webawesome-pro/dist/react'
import { createPortal } from 'react-dom'
import { useSnapshot } from 'valtio'

/**
 * Render the detached widget into the document owned by its external window.
 *
 * @returns {JSX.Element|null} The external-window portal, when one is active.
 */
export const DetachedWidgetPortal = () => {
    const widget = useSnapshot(lgs.stores.ui.widget)
    const widgetId = widget.undocked?.id ?? null
    const portalState = __.ui.widgetWindowManager?.getPortalState(widgetId)
    /**
     * Request reattachment from the external window.
     *
     * @returns {void}
     */
    const unlock = () => {
        void __.ui.widgetWindowManager?.reattachWidget()
    }

    /**
     * Attach the detached widget to the bottom drawer.
     *
     * @returns {void}
     */
    const attachToDrawer = () => {
        void __.ui.widgetWindowManager?.attachWidgetToDrawer?.()
    }

    const widgetEntry = widgetId ? widget.list?.get(widgetId) : null
    const widgetConfig = widgetId ? __.ui.widgetManager?.getWidgetConfig?.(widgetId) : null
    const widgetTitle = widgetConfig?.name ?? widgetEntry?.name ?? widgetId?.split('#')[0] ?? 'Detached widget'
    const canDetach = widgetConfig?.contextMenu?.canDetach === true && widgetConfig?.mandatory !== true
    const canDock = Boolean(widgetId
                            && widgetConfig?.contextMenu?.canDockable === true
                            && widgetConfig?.mandatory !== true
                            && isDockableWidgetId(widgetId)
                            && canDockWidget(widgetId))
    const detachedProps = {
        ...widgetEntry,
        group:        widgetEntry?.group ?? widgetConfig?.group,
        widgetsBoard: widgetEntry?.widgetsBoard ?? widgetConfig?.widgetsBoard,
        zIndex:       widgetEntry?.zIndex ?? widgetConfig?.zIndex,
        detached:     true,
    }

    if (!widgetId
        || !portalState?.container
        || !portalState.container.isConnected) {
        return null
    }

    return createPortal(
        <WaCard className="lgs-detached-window-card" appearance="filled" orientation="vertical"
                withHeaderActions>
            <span slot="header">{widgetTitle}</span>
            <div slot="header-actions" className="lgs-detached-window-actions" data-widget-capture="exclude">
                {canDetach && (
                    <WidgetWindowActionButton icon="lock-open" label="Unlock widget" onClick={unlock}/>
                )}
                {canDock && (
                    <WidgetWindowActionButton icon="arrow-down-to-bracket" label="Attach widget to drawer"
                                              onClick={attachToDrawer}/>
                )}
            </div>
            <div className="lgs-detached-window-content">
                <DynamicWidget id={widgetId} props={detachedProps}/>
            </div>
        </WaCard>,
        portalState.container,
    )
}
