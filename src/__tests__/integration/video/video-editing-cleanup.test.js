/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: video-editing-cleanup.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-05
 * Last modified: 2026-10-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    cancelVideoEditing,
    cancelVideoRecording,
    prepareVideoCaptureUi,
    prepareVideoEditingUi,
    restoreVideoCaptureUi,
} from '@Components/MainUI/video/videoEditingCleanup'
import { CROP_TOOLS_WIDGETS, VIDEO_WIDGETS_BOARD } from '@Core/constants'

describe('cancelVideoEditing', () => {
    beforeEach(() => {
        globalThis.__ = {
            ui: {
                widgetManager: {
                    syncCropDimensionsFromElement: vi.fn(),
                    disposeByGroup: vi.fn(),
                },
                widgetCache: {
                    hideAllExceptBoards: vi.fn(),
                    restoreAllHiddenWidgetsExcept: vi.fn(),
                },
                contextMenu: {
                    hide: vi.fn(),
                },
                drawerManager: {
                    close: vi.fn(),
                },
            },
        }

        globalThis.lgs = {
            stores: {
                ui: {
                    video: {
                        editing: true,
                        cropper: {
                            ratioEditor:  true,
                            presetEditor: true,
                            widgetEditor: true,
                        },
                    },
                },
                replay: {
                    mainUiHidden: false,
                    recordingSync: true,
                },
            },
        }
    })

    it('prepares the editing UI without hiding MainUI or context menu support', () => {
        prepareVideoEditingUi()

        expect(__.ui.widgetCache.hideAllExceptBoards).toHaveBeenCalledWith(VIDEO_WIDGETS_BOARD)
        expect(__.ui.contextMenu.hide).not.toHaveBeenCalled()
        expect(lgs.stores.replay.mainUiHidden).toBe(false)
    })

    it('prepares and restores the capture UI mask', () => {
        prepareVideoCaptureUi()

        expect(__.ui.widgetCache.hideAllExceptBoards).toHaveBeenCalledWith(VIDEO_WIDGETS_BOARD)
        expect(__.ui.contextMenu.hide).toHaveBeenCalled()
        expect(lgs.stores.replay.mainUiHidden).toBe(true)
        expect(lgs.stores.ui.video.cropper).toEqual(expect.objectContaining({
            ratioEditor:  false,
            presetEditor: false,
            widgetEditor: false,
        }))

        restoreVideoCaptureUi()

        expect(__.ui.widgetCache.restoreAllHiddenWidgetsExcept).toHaveBeenCalledWith(VIDEO_WIDGETS_BOARD)
        expect(lgs.stores.replay.mainUiHidden).toBe(false)
    })

    it('hides MainUI for a standalone recording', () => {
        lgs.stores.replay.recordingSync = false

        prepareVideoCaptureUi()

        expect(lgs.stores.replay.mainUiHidden).toBe(true)
    })

    it('does not sync the crop when canceling', async () => {
        lgs.stores.replay.mainUiHidden = true

        cancelVideoEditing()

        expect(__.ui.widgetManager.syncCropDimensionsFromElement).not.toHaveBeenCalled()
        expect(lgs.stores.ui.video.editing).toBe(false)
        expect(lgs.stores.replay.mainUiHidden).toBe(false)
        expect(__.ui.widgetManager.disposeByGroup).toHaveBeenCalledWith(CROP_TOOLS_WIDGETS, true)
        expect(__.ui.widgetCache.restoreAllHiddenWidgetsExcept).toHaveBeenCalledWith(VIDEO_WIDGETS_BOARD)
        expect(__.ui.contextMenu.hide).toHaveBeenCalled()
        expect(__.ui.drawerManager.close).toHaveBeenCalled()
    })

    it('clears the transient linked timeline preparation on cancel', () => {
        lgs.stores.ui.video.timelinePreviewActive = true
        __.ui.replay = {
            leaveReplayPreparation: vi.fn(),
            pause:                 vi.fn(),
        }

        cancelVideoEditing()

        expect(__.ui.replay.pause).toHaveBeenCalledTimes(1)
        expect(__.ui.replay.leaveReplayPreparation).toHaveBeenCalledTimes(1)
        expect(lgs.stores.ui.video.timelinePreviewActive).toBe(false)
        expect(lgs.stores.replay.recordingSync).toBe(false)
    })

    it.each(['simple', 'expert'])('discards the active %s Replay recording and closes Replay', async mode => {
        const abortExport = vi.fn()
        const invalidateRecording = vi.fn()
        const linkedPreparation = mode === 'expert'
        Object.assign(lgs.stores.ui.video, {
            editing: true,
            preRecording: true,
            exporting: true,
            paused: true,
            size: 512,
            timelinePreviewActive: linkedPreparation,
        })
        Object.assign(lgs.stores.replay, {
            active: true,
            playing: true,
            paused: true,
            recordingSync: linkedPreparation,
            simplePreparationActive: !linkedPreparation,
            mainUiHidden: true,
            deferredExportPlan: {runtime: {abortExport}},
        })
        __.ui.replay = {
            leaveReplayPreparation: vi.fn(),
            pause: vi.fn(),
        }

        await cancelVideoRecording({invalidateRecording})

        expect(invalidateRecording).toHaveBeenCalledTimes(1)
        expect(abortExport).toHaveBeenCalledTimes(1)
        expect(lgs.stores.replay.deferredExportPlan).toBeNull()
        expect(lgs.stores.replay.recordingSync).toBe(false)
        expect(lgs.stores.replay.simplePreparationActive).toBe(false)
        expect(lgs.stores.replay.active).toBe(false)
        expect(lgs.stores.replay.playing).toBe(false)
        expect(lgs.stores.replay.paused).toBe(false)
        expect(lgs.stores.replay.preparationTimeline).toBeNull()
        expect(lgs.stores.ui.video).toEqual(expect.objectContaining({
            editing: false,
            preRecording: false,
            exporting: false,
            paused: false,
            size: 0,
            timelinePreviewActive: false,
        }))
        expect(__.ui.replay.leaveReplayPreparation).toHaveBeenCalledTimes(1)
        expect(__.ui.drawerManager.close).toHaveBeenCalledTimes(1)
        expect(lgs.stores.replay.mainUiHidden).toBe(false)
    })
})
