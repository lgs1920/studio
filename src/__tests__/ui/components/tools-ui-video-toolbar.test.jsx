/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: tools-ui-video-toolbar.test.jsx
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { ToolsUI } from '@Components/MainUI/ToolsUI'
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

vi.mock('@Components/cesium/CameraAndTargetPanel/CameraAndTargetPanel', () => ({
    CameraAndTargetPanel: () => null,
}))

vi.mock('@Components/MainUI/video/toolbox/VideoPresetWidget', () => ({
    VideoPresetWidget: () => null,
}))

vi.mock('@Components/MainUI/video/toolbox/VideoRecordingSettingsWidget', () => ({
    VideoRecordingSettingsWidget: () => null,
}))

vi.mock('@Components/MainUI/video/VideoSettingsInfo', () => ({
    VideoSettingsInfo: () => null,
}))

vi.mock('@Components/MainUI/video/VideoRecordingScreenArea', () => ({
    VideoRecordingScreenArea: () => null,
}))

vi.mock('@Components/MainUI/widgets/SceneWidgetsRenderer', () => ({
    SceneWidgetsRenderer: () => null,
}))

vi.mock('@Components/MainUI/widgets/WidgetContextMenu', () => ({
    WidgetContextMenu: () => null,
}))

vi.mock('@Components/ToolsUI/cropper/Cropper', () => ({
    Cropper: () => null,
}))

vi.mock('@Core/constants', () => ({
    JOURNEY_TOOLBAR_WIDGET: 'journey-toolbar-widget',
}))

vi.mock('@Editor/JourneyToolbarWidget', () => ({
    JourneyToolbarWidget: () => null,
}))

describe('ToolsUI linked replay video editing', () => {
    beforeEach(() => {
        globalThis.__ = {
            ui: {
                replay: {
                    hideJourneyToolbarVisibility: vi.fn(),
                    isJourneyToolbarTemporarilyHidden: vi.fn(() => false),
                    restoreJourneyToolbarVisibility: vi.fn(),
                },
            },
        }

        globalThis.lgs = {
            settings: {
                ui: {
                    journeyToolbar: proxy({show: true, usage: true}),
                },
            },
            stores: {
                replay: proxy({
                    active:         false,
                    paused:         false,
                    playing:        false,
                    recordingSync:  true,
                }),
                ui: proxy({
                    video: proxy({
                        editing: false,
                        cropper: proxy({}),
                    }),
                }),
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('hides the Journey toolbar while linked video editing is open and restores it on close', async () => {
        render(<ToolsUI/>)

        globalThis.lgs.stores.ui.video.editing = true
        await waitFor(() => expect(globalThis.__.ui.replay.hideJourneyToolbarVisibility).toHaveBeenCalledTimes(1))

        globalThis.lgs.stores.ui.video.editing = false
        await waitFor(() => expect(globalThis.__.ui.replay.restoreJourneyToolbarVisibility).toHaveBeenCalledTimes(1))
        expect(globalThis.lgs.settings.ui.journeyToolbar.show).toBe(true)
    })
})
