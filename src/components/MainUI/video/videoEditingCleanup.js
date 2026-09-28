/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: videoEditingCleanup.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-02
 * Last modified: 2026-09-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { CROP_TOOLS_WIDGETS, VIDEO_WIDGETS_BOARD } from '@Core/constants'
import {resetRuntimeProgress} from '@Core/ui/replay/JourneyReplayRuntime'

export const prepareVideoEditingUi = () => {
    globalThis.__?.ui?.widgetCache?.hideAllExceptBoards?.(VIDEO_WIDGETS_BOARD)
}

const closeVideoCropperMenus = () => {
    const cropper = globalThis.lgs?.stores?.ui?.video?.cropper
    if (!cropper) {
        return
    }

    cropper.ratioEditor = false
    cropper.presetEditor = false
    cropper.widgetEditor = false
}

export const prepareVideoCaptureUi = () => {
    prepareVideoEditingUi()
    closeVideoCropperMenus()
    globalThis.__?.ui?.contextMenu?.hide?.()

    const replayStore = globalThis.lgs?.stores?.replay
    if (replayStore) {
        // The capture canvas must stay free of the interactive MainUI for both
        // Replay exports and screenshots.
        replayStore.mainUiHidden = true
    }
}

export const restoreVideoCaptureUi = () => {
    globalThis.__?.ui?.widgetCache?.restoreAllHiddenWidgetsExcept?.(VIDEO_WIDGETS_BOARD)

    const replayStore = globalThis.lgs?.stores?.replay
    if (replayStore) {
        replayStore.mainUiHidden = false
    }
}

/**
 * Cancel video editing and release any transient linked Replay preparation.
 *
 * @returns {void} Nothing.
 */
export const cancelVideoEditing = () => {
    const videoStore = lgs.stores.ui.video
    const linkedTimelinePreparation = videoStore.timelinePreviewActive === true
    const simplePreparation = lgs.stores.replay.simplePreparationActive === true
    if (linkedTimelinePreparation || simplePreparation) {
        __.ui.replay?.pause?.()
        __.ui.replay?.leaveReplayPreparation?.()
        lgs.stores.replay.recordingSync = false
        lgs.stores.replay.simplePreparationActive = false
        videoStore.timelinePreviewActive = false
    }
    videoStore.editing = false
    __.ui.widgetManager.disposeByGroup(CROP_TOOLS_WIDGETS, true)

    restoreVideoCaptureUi()
    __.ui.contextMenu.hide()
    __.ui.drawerManager.close()
}

/**
 * Cancel the active Replay video export and discard its transient recording data.
 * @param {Object} [options={}] - Cancellation options.
 * @param {Function|null} [options.invalidateRecording=null] - Invalidates pending recording UI work.
 * @returns {Promise<void>} Resolves after the active export releases its render resources.
 */
export const cancelVideoRecording = async ({invalidateRecording = null} = {}) => {
    const replayStore = globalThis.lgs?.stores?.replay
    const videoStore = globalThis.lgs?.stores?.ui?.video
    invalidateRecording?.()
    const exportCompletion = replayStore?.deferredExportPlan?.runtime?.abortExport?.()
    if (replayStore) {
        try {
            await exportCompletion
        }
        catch {
            // The export owner reports failures while cancellation still releases Replay UI state.
        }
    }
    try {
        if (videoStore) {
            cancelVideoEditing()
        }
    }
    finally {
        if (replayStore) {
            resetRuntimeProgress(replayStore)
            replayStore.recordingSync = false
            replayStore.simplePreparationActive = false
            replayStore.preparationTimeline = null
            replayStore.deferredExportPlan = null
        }
        if (videoStore) {
            Object.assign(videoStore, {
                preRecording: false,
                recordingHQ:  false,
                snapshot:     false,
                paused:       false,
                size:         0,
                finalizing:   false,
                timelinePreviewActive: false,
                editing:      false,
            })
        }
    }
}
