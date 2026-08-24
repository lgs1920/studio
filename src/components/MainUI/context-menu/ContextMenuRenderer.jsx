/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ContextMenuRenderer.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-04-27
 * Last modified: 2026-04-27
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { useEffect, useRef } from 'react'
import { useSnapshot }              from 'valtio'

import { MapPointContextMenu } from '@Components/MainUI/context-menu/MapPointContextMenu'
import { MapPOIContextMenu } from '@Components/MainUI/MapPOI/MapPOIContextMenu'
import { WidgetContextMenu } from '@Components/MainUI/widgets/WidgetContextMenu'
import {REPLAY_RECORDING_MONITOR_WIDGET_ID} from '@Core/constants'

/**
 * Global context menu renderer.
 * Delegates rendering to the appropriate menu component based on type.
 * Fully synchronized with the Valtio store and the ContextMenu singleton.
 */
export const ContextMenuRenderer = () => {
    /** Ref attached to the actual DOM element of the context menu */
    const _menu = useRef(null)

    const $contextMenu = lgs.stores.ui.contextMenu
    const contextMenu = useSnapshot($contextMenu)
    const video = useSnapshot(lgs.stores.ui.video)
    const replay = useSnapshot(lgs.stores.replay)
    const videoPreparationActive = video.editing === true || video.preRecording === true
    const synchronizedRecording = (video.recording === true || video.recordingHQ === true)
                                  && replay.recordingSync === true
    const monitorContextMenu = contextMenu.type === 'widget'
                               && contextMenu.targetId === REPLAY_RECORDING_MONITOR_WIDGET_ID
    const suppressContextMenu = (synchronizedRecording || replay.mainUiHidden === true) && !monitorContextMenu

    useEffect(() => {
        if (suppressContextMenu && contextMenu.visible) {
            __.ui.contextMenu.hide()
        }
    }, [contextMenu.visible, suppressContextMenu])

    // Initialize and Show/Hide logic
    useEffect(() => {
        // If we have the DOM element (visible), we must initialize it with the singleton
        if (_menu.current && contextMenu.visible) {
            __.ui.contextMenu.initialize(_menu.current)

            // If we have a position, apply it immediately to avoid flicker
            if (contextMenu.position) {
                __.ui.contextMenu.showAt(contextMenu.position)
            }
        }
    }, [contextMenu.visible, contextMenu.position, contextMenu.position?.x, contextMenu.position?.y])

    // Do not render anything when the menu is hidden
    if (!contextMenu.visible || !contextMenu.type || suppressContextMenu) {
        return null
    }

    // Delegate to the correct menu component
    switch (contextMenu.type) {
        case 'widget':
            return <WidgetContextMenu targetId={contextMenu.targetId} menuRef={_menu}/>
        case 'poi':
            return <MapPOIContextMenu targetId={contextMenu.targetId} menuRef={_menu}/>
        case 'map-point':
            return <MapPointContextMenu
                target={contextMenu.targetId}
                menuRef={_menu}
                hideVideoActions={videoPreparationActive}/>
        default:
            return null
    }
}
