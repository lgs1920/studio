/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: video-editing-cleanup.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-05
 * Last modified: 2026-06-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cancelVideoEditing } from '@Components/MainUI/video/videoEditingCleanup'
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
                    },
                },
            },
        }
    })

    it('does not sync the crop when canceling', async () => {
        cancelVideoEditing()

        expect(__.ui.widgetManager.syncCropDimensionsFromElement).not.toHaveBeenCalled()
        expect(lgs.stores.ui.video.editing).toBe(false)
        expect(__.ui.widgetManager.disposeByGroup).toHaveBeenCalledWith(CROP_TOOLS_WIDGETS, true)
        expect(__.ui.widgetCache.restoreAllHiddenWidgetsExcept).toHaveBeenCalledWith(VIDEO_WIDGETS_BOARD)
        expect(__.ui.contextMenu.hide).toHaveBeenCalled()
        expect(__.ui.drawerManager.close).toHaveBeenCalled()
    })
})
