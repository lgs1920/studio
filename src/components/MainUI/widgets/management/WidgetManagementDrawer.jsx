/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetManagementDrawer.jsx
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

import DrawerFooter from '@Components/DrawerFooter'
import WaDrawer from '@Components/WaDrawerNonModal'
import { WidgetsOrderingPanelContent } from '@Components/MainUI/widgets/ordering/WidgetsOrderingPanelContent'
import {
    getManageableWidgets,
    getWidgetManagementExcludedTypes,
} from '@Components/MainUI/widgets/openWidgetManagementDrawer'
import { SCENE_WIDGETS_BOARD, VIDEO_WIDGETS_BOARD, WIDGET_MANAGEMENT_DRAWER } from '@Core/constants'
import { WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import PanelActions from '@Components/PanelsActions'
import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useSnapshot } from 'valtio'

const resolveBoardLabel = (widgetsBoard) => {
    if (widgetsBoard === VIDEO_WIDGETS_BOARD) {
        return 'Video widgets'
    }
    if (widgetsBoard === SCENE_WIDGETS_BOARD) {
        return 'Scene widgets'
    }
    return widgetsBoard || 'Widgets'
}

export const WidgetManagementDrawer = () => {
    const drawers = useSnapshot(lgs.stores.ui.drawers)
    const video = useSnapshot(lgs.stores.ui.video)
    const widget = useSnapshot(lgs.stores.ui.widget)
    const {drawer: drawerPlacement} = useSnapshot(lgs.editorSettingsProxy.menu)
    const drawerRoot = __.ui.drawerManager.drawerRoot
    const isVideoBoardContext = video.editing
        || video.preRecording
        || video.recording
        || video.snapshot
        || video.finalizing
        || video.cropper?.widgetEditor === true
        || video.cropper?.ratioEditor === true
    const widgetsBoard = drawers.entity || (isVideoBoardContext ? VIDEO_WIDGETS_BOARD : SCENE_WIDGETS_BOARD)
    const isCurrentDrawer = drawers.open === WIDGET_MANAGEMENT_DRAWER && Boolean(widgetsBoard)
    const manageableWidgets = useMemo(
        () => getManageableWidgets(widgetsBoard, widget.list),
        [widgetsBoard, widget.list],
    )
    const hasListedWidgets = manageableWidgets.length > 0

    useEffect(() => {
        if (isCurrentDrawer && !hasListedWidgets && __.ui.drawerManager.isCurrent(WIDGET_MANAGEMENT_DRAWER)) {
            __.ui.drawerManager.close()
        }
    }, [hasListedWidgets, isCurrentDrawer])

    if (!isCurrentDrawer || !hasListedWidgets) {
        return null
    }

    const excludedWidgetTypes = getWidgetManagementExcludedTypes(widgetsBoard)

    const content = (
        <WaDrawer
            id={WIDGET_MANAGEMENT_DRAWER}
            open={true}
            modal={false}
            className="widget-management-drawer lgs-theme"
            placement={drawerPlacement}
            onWaAfterHide={(event) => {
                if (event?.target?.tagName === 'WA-DRAWER' && __.ui.drawerManager.isCurrent(WIDGET_MANAGEMENT_DRAWER)) {
                    __.ui.drawerManager.close()
                }
            }}
        >
            <PanelActions/>
            <div slot="label" className="widget-management-drawer-title">
                <WaIcon name="layer"/>
                <span>{'Widget management'}</span>
            </div>

            <div className="widget-management-drawer-content">
                <div className="widget-management-drawer-board">
                    <span>{'Board:'}</span><strong>{resolveBoardLabel(widgetsBoard)}</strong>
                </div>
                <WidgetsOrderingPanelContent
                    widgetsBoard={widgetsBoard}
                    excludedWidgetTypes={excludedWidgetTypes}
                    fillHeight
                />
            </div>

            <DrawerFooter slot="footer"/>
        </WaDrawer>
    )

    return drawerRoot ? createPortal(content, drawerRoot) : content
}
