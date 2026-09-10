/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DockedWidgetDrawer.jsx
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

import WaDrawer from '@Components/WaDrawerNonModal'
import {DynamicWidget} from '@Components/MainUI/widgets/DynamicWidget'
import {DockedWidgetResizeHandle} from '@Components/MainUI/widgets/DockedWidgetResizeHandle'
import {DockedWidgetContainerContext} from '@Components/MainUI/widgets/WidgetDockContext'
import {WidgetWindowActionButton} from '@Components/MainUI/widgets/WidgetWindowActionButton'
import {JOURNEY_WIDGETS, REPLAY_TIMELINE_WIDGET, SCENE_WIDGETS_BOARD} from '@Core/constants'
import {
    hydrateDockedWidget,
    getDockedWidgetDimensions,
    setDockSize,
    undockWidget,
} from '@Core/ui/widget-manager/WidgetDockManager'
import {useCallback, useEffect, useState} from 'react'
import {createPortal} from 'react-dom'
import {useSnapshot} from 'valtio'

/**
 * Return the docked widget to the scene after the drawer has finished closing.
 *
 * @param {Event} event - Web Awesome drawer lifecycle event.
 * @param {string|null|undefined} widgetId - Docked widget identifier.
 * @returns {void}
 */
const handleAfterHide = (event, widgetId) => {
    if (event?.target?.tagName === 'WA-DRAWER') {
        undockWidget(widgetId)
    }
}

/**
 * Render the bottom drawer hosting the currently docked widget.
 *
 * @returns {JSX.Element|null} Docked widget drawer or null when no supported widget is docked.
 */
export const DockedWidgetDrawer = () => {
    const widget = useSnapshot(lgs.stores.ui.widget)
    const drawers = useSnapshot(lgs.stores.ui.drawers)
    const drawerRoot = __.ui.drawerManager?.drawerRoot
    const [drawer, setDrawer] = useState(null)
    const [surface, setSurface] = useState(null)

    useEffect(() => {
        hydrateDockedWidget()
    }, [])

    const dockedId = widget.docked?.id

    /**
     * Store the Web Awesome drawer element used by the resize handle.
     *
     * @param {HTMLElement|null} element - Drawer element reference.
     * @returns {void}
     */
    const setDrawerElement = useCallback(element => setDrawer(element), [])

    /**
     * Return the docked widget to the scene.
     *
     * @returns {void}
     */
    const handleUndock = useCallback(() => {
        if (dockedId) {
            undockWidget(dockedId)
        }
    }, [dockedId])

    /**
     * Open the docked widget in the external PiP or popup window.
     *
     * @returns {void}
     */
    const handleDetach = useCallback(() => {
        if (!dockedId) {
            return
        }

        const windowManager = __.ui.widgetWindowManager
        if (!windowManager?.canDetachWidget?.(dockedId)) {
            return
        }

        const dimensions = getDockedWidgetDimensions(dockedId)
        undockWidget(dockedId)
        void windowManager.detachWidget(dockedId, {dimensions, useConfigDimensions: true})
    }, [dockedId])
    if (!dockedId || dockedId.split('#')[0] !== REPLAY_TIMELINE_WIDGET) {
        return null
    }

    const entry = widget.list.get(dockedId) ?? {
        group:        JOURNEY_WIDGETS,
        widgetsBoard: SCENE_WIDGETS_BOARD,
    }
    const size = Number(widget.docked?.size) || 320
    const drawerStyle = {
        '--widget-dock-horizontal-left': drawers.open !== null ? 'var(--lgs-horizontal-panel-left)' : '0px',
        '--widget-dock-horizontal-width': drawers.open !== null ? 'var(--lgs-horizontal-panel-width)' : '100%',
    }
    const content = (
        <WaDrawer
            ref={setDrawerElement}
            id="widget-dock-bottom-drawer"
            open={true}
            modal={false}
            placement="bottom"
            className="widget-dock-bottom-drawer lgs-theme"
            style={drawerStyle}
            onWaAfterHide={event => handleAfterHide(event, dockedId)}
        >
            <div slot="label" className="widget-dock-bottom-drawer-title">{'Replay Timeline'}</div>
            <div slot="header-actions" className="widget-dock-bottom-drawer-actions">
                <WidgetWindowActionButton icon="arrow-up-from-bracket" label="Undock widget" onClick={handleUndock}/>
                <WidgetWindowActionButton icon="picture-in-picture" label="Detach widget to PiP" onClick={handleDetach}/>
            </div>
            <div className="widget-dock-surface" ref={setSurface}>
                {surface && (
                    <DockedWidgetContainerContext.Provider value={surface}>
                        <DynamicWidget
                            key={`docked-${dockedId}`}
                            id={dockedId}
                            props={{
                                ...entry,
                                docked:       true,
                                widgetsBoard: SCENE_WIDGETS_BOARD,
                            }}
                        />
                    </DockedWidgetContainerContext.Provider>
                )}
            </div>
            <DockedWidgetResizeHandle drawer={drawer} size={size} onSizeChange={setDockSize}/>
        </WaDrawer>
    )

    return drawerRoot ? createPortal(content, drawerRoot) : content
}
