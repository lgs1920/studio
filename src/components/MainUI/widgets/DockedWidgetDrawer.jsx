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
 * Last modified: 2026-09-12
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import WaDrawer from '@Components/WaDrawerNonModal'
import {DockedWidgetResizeHandle} from '@Components/MainUI/widgets/DockedWidgetResizeHandle'
import {ReplayTimelineWidget} from '@Components/MainUI/widgets/list/ReplayTimelineWidget'
import {REPLAY_TIMELINE_WIDGET} from '@Core/constants'
import {
    setDockSize,
    undockWidget,
} from '@Core/ui/widget-manager/WidgetDockManager'
import {useCallback, useState} from 'react'
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
    if (event.target === event.currentTarget && !event.currentTarget.open) {
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
    const video = useSnapshot(lgs.stores.ui.video)
    const replay = useSnapshot(lgs.stores.replay)
    const drawerRoot = __.ui.drawerManager?.drawerRoot
    const dockedId = widget.docked?.id
    const supportedDockedId = dockedId && dockedId.split('#')[0] === REPLAY_TIMELINE_WIDGET
        ? dockedId
        : null
    const [drawer, setDrawer] = useState(null)

    /**
     * Store the Web Awesome drawer element used by the resize handle.
     *
     * @param {HTMLElement|null} element - Drawer element reference.
     * @returns {void}
     */
    const setDrawerElement = useCallback(element => setDrawer(element), [])

    const size = Number(widget.docked?.size) || 320
    const timelinePreparationActive = video.editing === true
        && video.timelinePreviewActive === true
        && replay.recordingSync === true
    const drawerStyle = {
        '--widget-dock-horizontal-left': drawers.open !== null ? 'var(--lgs-horizontal-panel-left)' : '0px',
        '--widget-dock-horizontal-width': drawers.open !== null ? 'var(--lgs-horizontal-panel-width)' : '100%',
    }

    if (!supportedDockedId || !timelinePreparationActive) {
        return null
    }

    const content = (
        <WaDrawer
            ref={setDrawerElement}
            id="widget-dock-bottom-drawer"
            open
            label="Replay timeline"
            withoutHeader
            placement="bottom"
            className="widget-dock-bottom-drawer lgs-theme"
            style={drawerStyle}
            onWaAfterHide={event => handleAfterHide(event, supportedDockedId)}
        >
            <div className="widget-dock-surface">
                <ReplayTimelineWidget key={`docked-${supportedDockedId}`}
                                      id={supportedDockedId}
                                      docked/>
            </div>
            <DockedWidgetResizeHandle drawer={drawer} size={size} onSizeChange={setDockSize}/>
        </WaDrawer>
    )

    return drawerRoot ? createPortal(content, drawerRoot) : content
}
