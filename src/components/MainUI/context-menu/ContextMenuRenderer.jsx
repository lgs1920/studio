/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ContextMenuRenderer.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-01
 * Last modified: 2025-12-01
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import React, { useEffect, useRef } from 'react'
import { useSnapshot }              from 'valtio'

import { MapPOIContextMenu } from '@Components/MainUI/MapPOI/MapPOIContextMenu'
import { WidgetContextMenu } from '@Components/MainUI/widgets/WidgetContextMenu'

/**
 * Global context menu renderer.
 * Delegates rendering to the appropriate menu component based on type.
 * Fully synchronized with the Valtio store and the ContextMenu singleton.
 */
export const ContextMenuRenderer = () => {
    /** Ref attached to the actual DOM element of the context menu */
    const _menuRef = useRef(null)

    /** Global context menu store (Valtio proxy) */
    const $contextMenu = lgs.stores.ui.contextMenu
    const contextMenu = useSnapshot($contextMenu)

    // ------------------------------------------------------------
    // 1. Initialize and Show/Hide logic
    // ------------------------------------------------------------
    useEffect(() => {
        // If we have the DOM element (visible), we must initialize it with the singleton
        if (_menuRef.current && contextMenu.visible) {
            __.ui.contextMenu.initialize(_menuRef.current)

            // If we have a position, apply it immediately to avoid flicker
            if (contextMenu.position) {
                __.ui.contextMenu.showAt(contextMenu.position)
            }
        }
        else {
            // If hidden or no element, ensure singleton is hidden
            __.ui.contextMenu.hide()
        }
    }, [contextMenu.visible, contextMenu.type])

    // ------------------------------------------------------------
    // 2. Update position while visible
    // ------------------------------------------------------------
    useEffect(() => {
        if (_menuRef.current && contextMenu.visible && contextMenu.position) {
            __.ui.contextMenu.showAt(contextMenu.position)
        }
    }, [contextMenu.position?.x, contextMenu.position?.y])

    // Do not render anything when the menu is hidden
    if (!contextMenu.visible || !contextMenu.type) {
        return null
    }

    // Delegate to the correct menu component
    switch (contextMenu.type) {
        case 'widget':
            return <WidgetContextMenu targetId={contextMenu.targetId} menuRef={_menuRef}/>
        case 'poi':
            return <MapPOIContextMenu targetId={contextMenu.targetId} menuRef={_menuRef}/>
        default:
            return null
    }
}