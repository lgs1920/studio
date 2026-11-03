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
 * Last modified: 2026-11-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { CROP_TOOLS_WIDGETS, VIDEO_WIDGETS_BOARD } from '@Core/constants'
import {resetRuntimeProgress} from '@Core/ui/replay/JourneyReplayRuntime'
import {publishReplayTimelineTime} from '@Core/ui/replay/ReplayFramePublisher'
import {resolveReplayVideoFramePhase} from '@Core/ui/replay/ReplayVideoTimeline'

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

/** Return the Replay controller and preparation playhead to the selected range start. */
const resetReplayPreparationPlayhead = replayStore => {
    if (!replayStore) {
        return
    }

    const timeline = replayStore.preparationTimeline?.timeline
    const rangeStartMillis = Number(timeline?.rangeStartMillis)
    const startMillis = Number.isFinite(rangeStartMillis) ? Math.max(0, rangeStartMillis) : 0
    const phase = timeline
        ? resolveReplayVideoFramePhase({timeline, frameTimeMs: startMillis})
        : null
    const phaseProgress = timeline?.phases?.length ? phase?.progress : phase?.anchorProgress
    const fallbackProgress = Number(timeline?.direction ?? replayStore.direction) < 0 ? 1 : 0
    const progress = Number.isFinite(Number(phaseProgress)) ? Number(phaseProgress) : fallbackProgress
    const replayController = globalThis.__?.ui?.replay?.controller
    replayController?.stop?.({emit: false, clearProgress: true})
    replayController?.seek?.(progress)
    if (timeline) {
        timeline.currentTimeMillis = startMillis
    }
    replayStore.progress = progress
    publishReplayTimelineTime({replay: replayStore, timeMillis: startMillis})
}

/**
 * Cancel video editing and release any transient linked Replay preparation.
 *
 * @returns {void} Nothing.
 */
export const cancelVideoEditing = () => {
    const videoStore = lgs.stores.ui.video
    videoStore.mediaHandoffRevision = (videoStore.mediaHandoffRevision ?? 0) + 1
    const linkedTimelinePreparation = videoStore.timelinePreviewActive === true
    const basicPreparation = lgs.stores.replay.basicPreparationActive === true
    if (linkedTimelinePreparation || basicPreparation) {
        __.ui.replay?.pause?.()
        __.ui.replay?.leaveReplayPreparation?.()
        lgs.stores.replay.recordingSync = false
        lgs.stores.replay.basicPreparationActive = false
        videoStore.timelinePreviewActive = false
    }
    lgs.stores.replay.preparationTimeline = null
    videoStore.editing = false
    videoStore.dryRun = false
    videoStore.dryRunSelection = null
    __.ui.widgetManager.disposeByGroup(CROP_TOOLS_WIDGETS, true)

    restoreVideoCaptureUi()
    __.ui.contextMenu.hide()
    __.ui.drawerManager.close()
}

/**
 * Cancel the active Replay video export and discard its transient recording data.
 * @param {Object} [options={}] - Cancellation options.
 * @param {Function|null} [options.invalidateRecording=null] - Invalidates pending recording UI work.
 * @param {boolean} [options.returnToPreparation=false] - Restores the active Replay preparation instead of leaving Replay.
 * @returns {Promise<void>} Resolves after the active export releases its render resources.
 */
export const cancelVideoRecording = async ({invalidateRecording = null, returnToPreparation = false} = {}) => {
    const replayStore = globalThis.lgs?.stores?.replay
    const videoStore = globalThis.lgs?.stores?.ui?.video
    if (videoStore) {
        // Explicit cancellation invalidates media already handed to the dialog as well as active encoding.
        videoStore.mediaHandoffRevision = (videoStore.mediaHandoffRevision ?? 0) + 1
    }
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
        if (returnToPreparation) {
            try {
                if (replayStore?.recordingSync === true || replayStore?.basicPreparationActive === true) {
                    __.ui.replay?.pause?.()
                }
            }
            finally {
                if (replayStore) {
                    resetRuntimeProgress(replayStore)
                    replayStore.deferredExportPlan = null
                }
                if (videoStore) {
                    Object.assign(videoStore, {
                        preRecording: false,
                        exporting: false,
                        dryRun: false,
                        dryRunSelection: null,
                        snapshot: false,
                        paused: false,
                        size: 0,
                        finalizing: false,
                        editing: true,
                    })
                }
                restoreVideoCaptureUi()
                if (replayStore) {
                    resetReplayPreparationPlayhead(replayStore)
                }
            }
        }
        else if (videoStore) {
            cancelVideoEditing()
        }
    }
    finally {
        if (replayStore && !returnToPreparation) {
            resetRuntimeProgress(replayStore)
            replayStore.recordingSync = false
            replayStore.basicPreparationActive = false
            replayStore.preparationTimeline = null
            replayStore.deferredExportPlan = null
        }
        if (videoStore && !returnToPreparation) {
            Object.assign(videoStore, {
                preRecording: false,
                exporting:  false,
                dryRun:     false,
                dryRunSelection: null,
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
