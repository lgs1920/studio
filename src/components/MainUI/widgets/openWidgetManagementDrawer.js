/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: openWidgetManagementDrawer.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-20
 * Last modified on: 2026-06-20
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { COMPASS_WIDGET, CREDITS_WIDGET, SCENE_WIDGETS_BOARD, VIDEO_WIDGETS_BOARD, WIDGET_MANAGEMENT_DRAWER } from '@Core/constants'

const resolveCurrentBoard = () => {
    const currentWidgetId = lgs.stores.ui.widget.current?.id
    if (currentWidgetId) {
        const currentConfig = __.ui.widgetManager.getWidgetConfig(currentWidgetId)
        const currentBoard = currentConfig?.widgetsBoard ?? lgs.stores.ui.widget.cache.get(currentWidgetId)?.widgetsBoard
        if (currentBoard) {
            return currentBoard
        }
    }

    if (lgs.stores.ui.video.editing) {
        return VIDEO_WIDGETS_BOARD
    }

    return SCENE_WIDGETS_BOARD
}

export const getWidgetManagementExcludedTypes = (widgetsBoard) => {
    return widgetsBoard === SCENE_WIDGETS_BOARD ? [COMPASS_WIDGET, CREDITS_WIDGET] : [CREDITS_WIDGET]
}

export const getManageableWidgets = (widgetsBoard, widgetList = lgs.stores?.ui?.widget?.list) => {
    if (!widgetsBoard || !widgetList) {
        return []
    }

    const excludedWidgetTypes = new Set(getWidgetManagementExcludedTypes(widgetsBoard))
    return Array.from(widgetList.entries()).filter(([id, entry]) => {
        const widgetType = id.split('#')[0]
        return entry?.widgetsBoard === widgetsBoard &&
            !excludedWidgetTypes.has(widgetType) &&
            Boolean(lgs.settings.widgets?.[widgetType])
    })
}

export const hasManageableWidgets = (widgetsBoard, widgetList) => getManageableWidgets(widgetsBoard, widgetList).length > 0

export const openWidgetManagementDrawer = (widgetsBoard = null) => {
    const board = widgetsBoard ?? resolveCurrentBoard()
    if (!hasManageableWidgets(board)) {
        return null
    }

    __.ui.drawerManager.open(WIDGET_MANAGEMENT_DRAWER, {
        action: 'widget-management',
        entity: board,
    })
    return board
}
