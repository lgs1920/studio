/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: orbitWidgetConfig.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-27
 * Last modified: 2026-04-27
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGS_WIDGET, SCENE_WIDGETS, SCENE_WIDGETS_BOARD } from '@Core/constants'

const DISABLED_CONTEXT_MENU = {
    canEdit:     false,
    canMaximize: false,
    canPosition: false,
    canRemove:   false,
    canReset:    false,
}

const parseCssPx = (variableName, fallback = 0) => {
    const raw = __.ui.css.getCSSVariable(variableName)
    const parsed = __.app.parsePx(raw)
    return Number.isFinite(parsed) ? parsed : fallback
}

export const getOrbitWidgetConfig = (id, fromStart) => {
    const canvasRect = lgs.canvas?.getBoundingClientRect?.()
    const width = canvasRect?.width ?? window.innerWidth
    const height = canvasRect?.height ?? window.innerHeight
    const gutter = lgs.gutter?.s ?? 8
    const toolbarSize = parseCssPx('--lgs-dimension', 48)
    const edgeInset = parseCssPx(fromStart ? '--left' : '--right', gutter)
    const bottomInset = parseCssPx('--bottom', gutter)

    const horizontalAnchor = fromStart
                             ? edgeInset + toolbarSize + gutter
                             : width - edgeInset - toolbarSize - gutter

    return {
        attachTo:        fromStart ? 'bottom-left' : 'bottom-right',
        contextMenu:     DISABLED_CONTEXT_MENU,
        draggable:       true,
        dynamic:         true,
        group:           SCENE_WIDGETS,
        id,
        icon:            id === 'rotation-widget' ? 'arrows-rotate' : 'camera',
        left:            `${Math.round(horizontalAnchor)}px`,
        mandatory:       false,
        opacity:         1,
        persist:         true,
        resizable:       false,
        rotatable:       false,
        scalable:        false,
        snappable:       false,
        stopPropagation: true,
        top:             `${Math.round(height - bottomInset)}px`,
        transient:       true,
        type:            LGS_WIDGET,
        widgetsBoard:    SCENE_WIDGETS_BOARD,
        zIndex:          12000,
    }
}
