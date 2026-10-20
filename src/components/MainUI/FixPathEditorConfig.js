/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FixPathEditorConfig.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-19
 * Last modified: 2026-10-20
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {FIX_PATH_EDITOR_WIDGET, LGS_TOOLBAR, SCENE_WIDGETS_BOARD} from '@Core/constants'

export const FIX_PATH_WIDGET_CONFIG = {
    attachTo: 'top-right',
    canHide: false,
    canLock: false,
    canReduce: false,
    contextMenu: {canEdit: false, canRemove: false, canReset: false, canPosition: false, canMaximize: false},
    contextMenuEnabled: false,
    draggable: true,
    dynamic: true,
    id: FIX_PATH_EDITOR_WIDGET,
    left: '100%',
    margin: 12,
    opacity: 1,
    persist: false,
    max: {height: 10000},
    ratio: {aspectRatio: 1, locked: false},
    resizable: true,
    rotatable: false,
    scalable: false,
    showControlBox: true,
    snappable: false,
    stopPropagation: true,
    top: '0px',
    transient: true,
    type: LGS_TOOLBAR,
    widgetsBoard: SCENE_WIDGETS_BOARD,
}

export const SOURCE_SCAN_BATCH_SIZE = 256
export const OCCLUSION_SCAN_BATCH_SIZE = 12
export const SOURCE_VISIBILITY_CELL_SIZE = 4
export const EMPTY_CORRECTION_TRACKS = Object.freeze({})
