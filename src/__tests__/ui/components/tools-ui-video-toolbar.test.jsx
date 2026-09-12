/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: tools-ui-video-toolbar.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-22
 * Last modified: 2026-09-12
 *
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

vi.mock('@Components/MainUI/widgets/DynamicWidget', () => ({
    DynamicWidget: ({id}) => <div data-testid={`dynamic-widget-${id}`}/>,
}))

vi.mock('@Components/MainUI/widgets/DockedWidgetDrawer', () => ({
    DockedWidgetDrawer: () => null,
}))

vi.mock('@Components/MainUI/widgets/DetachedWidgetPortal', () => ({
    DetachedWidgetPortal: () => null,
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

vi.mock('@Core/constants', async importOriginal => ({
    ...(await importOriginal()),
    JOURNEY_TOOLBAR_WIDGET: 'journey-toolbar-widget',
}))

vi.mock('@Editor/JourneyToolbarWidget', () => ({
    JourneyToolbarWidget: () => null,
}))

describe('ToolsUI linked replay video editing', () => {
    beforeEach(() => {
        const appContainer = document.createElement('div')
        appContainer.id = 'lgs1920-container'
        document.body.append(appContainer)

        globalThis.__ = {
            ui: {
                replay: {
                    hideJourneyToolbarVisibility: vi.fn(),
                    isJourneyToolbarTemporarilyHidden: vi.fn(() => false),
                    restoreJourneyToolbarVisibility: vi.fn(),
                    enterReplayPreparation: vi.fn(async () => true),
                },
            },
        }

        globalThis.lgs = {
            settings: {
                ui: {
                    journeyToolbar: proxy({show: true, usage: true}),
                    widgets: {
                        dock: {id: null, mode: 'scene', size: 320},
                    },
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
                    drawers: proxy({open: null}),
                    video: proxy({
                        editing: false,
                        cropper: proxy({}),
                    }),
                    widget: proxy({
                        docked:   {id: null},
                        undocked: {id: null},
                    }),
                }),
            },
        }
    })

    afterEach(() => {
        cleanup()
        document.getElementById('lgs1920-container')?.remove()
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

    it('lets the crop input layer expose Cesium while preserving child widget targets', async () => {
        globalThis.lgs.stores.ui.video.editing = true
        render(<ToolsUI/>)

        await waitFor(() => expect(document.getElementById('lgs1920-container')?.classList.contains('lgs-video-crop-input-mode')).toBe(true))
    })

    it('returns an interrupted linked recording to the canonical Replay preparation state', async () => {
        const enterReplayPreparation = globalThis.__.ui.replay.enterReplayPreparation
        render(<ToolsUI/>)

        globalThis.lgs.stores.ui.video.recording = true
        await waitFor(() => expect(globalThis.lgs.stores.ui.video.recording).toBe(true))

        globalThis.lgs.stores.ui.video.recording = false
        globalThis.lgs.stores.ui.video.editing = true

        await waitFor(() => expect(enterReplayPreparation).toHaveBeenCalledWith(expect.objectContaining({
            journey:     undefined,
            shouldApply: expect.any(Function),
        })))
        expect(enterReplayPreparation.mock.calls[0][0].shouldApply()).toBe(true)
    })

    it('mounts the persisted external timeline host only when the timeline is opened', async () => {
        globalThis.lgs.settings.ui.widgets = {
            dock: {
                id:   'replay-timeline-widget',
                mode: 'window',
                size: 320,
            },
        }

        const {queryByTestId, getByTestId} = render(<ToolsUI/>)
        expect(queryByTestId('dynamic-widget-replay-timeline-widget')).toBeNull()

        globalThis.lgs.stores.ui.video.editing = true
        globalThis.lgs.stores.ui.video.timelinePreviewActive = true

        await waitFor(() => expect(getByTestId('dynamic-widget-replay-timeline-widget')).toBeTruthy())
    })

    it('hydrates a persisted drawer when the timeline is opened', async () => {
        globalThis.lgs.settings.ui.widgets.dock = {
            id:   'replay-timeline-widget',
            mode: 'drawer',
            size: 420,
        }
        globalThis.lgs.stores.ui.video.editing = true
        globalThis.lgs.stores.ui.video.timelinePreviewActive = true

        render(<ToolsUI/>)

        await waitFor(() => expect(lgs.stores.ui.widget.docked.id).toBe('replay-timeline-widget'))
        expect(lgs.stores.ui.widget.docked.size).toBe(420)
    })
})
