/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: video-recording-settings-toolbar.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-05
 * Last modified: 2026-08-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

vi.mock('@Components/JourneyReplay/JourneyReplayButton', () => ({
    JourneyReplayButton: props => (
        <button type="button" aria-label={props.ariaLabel} aria-pressed="false">{props.ariaLabel}</button>
    ),
}))

vi.mock('@Components/LGSPopup', () => ({
    LGSPopup: ({active, children}) => active ? <div data-testid="settings-popup">{children}</div> : null,
}))

vi.mock('@Components/ToolsUI/cropper/widgets/CropRatioEditorToolbar', () => ({
    CropRatioEditorToolbar: () => <div data-testid="ratio-popup-content">Ratio choices</div>,
}))

vi.mock('@Components/MainUI/video/toolbox/VideoPresetToolbar', () => ({
    VideoPresetToolbar: () => <div data-testid="preset-popup-content">Preset, FPS and quality choices</div>,
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, ...props}) => <button type="button" {...props}>{children}</button>,
    WaIcon: ({name}) => <span data-icon={name}/>,
    WaTooltip: ({children}) => <span>{children}</span>,
}))

vi.mock('@Components/MainUI/video/videoEditingCleanup', () => ({
    cancelVideoEditing: vi.fn(),
    prepareVideoCaptureUi: vi.fn(),
    prepareVideoEditingUi: vi.fn(),
}))

import {
    cancelVideoEditing,
    prepareVideoCaptureUi,
    prepareVideoEditingUi,
} from '@Components/MainUI/video/videoEditingCleanup'
import { VideoRecordingSettingsToolbar } from '@Components/MainUI/video/toolbox/VideoRecordingSettingsToolbar'

describe('VideoRecordingSettingsToolbar', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        globalThis.__ = {
            ui: {
                drawerManager: {
                    close: vi.fn(),
                    isCurrent: vi.fn(() => false),
                    open: vi.fn(),
                },
                replay: {
                    prepareReplayCamera: vi.fn(async () => true),
                },
                widgetManager: {
                    windowResizing: false,
                    getElementById: vi.fn(() => document.createElement('div')),
                    syncCropDimensionsFromElement: vi.fn(async () => null),
                    toCenter: vi.fn(),
                },
            },
            recorder: {},
        }

        globalThis.lgs = {
            theJourney: {slug: 'journey-a'},
            configuration: {
                videoFormats: [
                    {label: '16:9', value: '16x9', description: 'Landscape'},
                    {label: '4:5', value: '4x5', description: 'Portrait'},
                ],
            },
            settings: {
                ui: {
                    video: proxy({fps: 0, quality: 1, ratio: '16x9'}),
                },
            },
            stores: {
                ui: proxy({
                    video: proxy({
                        editing: true,
                        recording: false,
                        preRecording: false,
                        snapshot: false,
                        finalizing: false,
                        fps: 0,
                        quality: 1,
                        ratio: '16x9',
                        cropper: proxy({}),
                    }),
                }),
                replay: proxy({recordingSync: false}),
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('keeps the current ratio and video values visible in one horizontal HUD', () => {
        render(<VideoRecordingSettingsToolbar/>)

        expect(prepareVideoEditingUi).toHaveBeenCalledTimes(1)
        expect(screen.getByRole('button', {name: 'Ratio: 16:9'})).not.toBeNull()
        expect(screen.getByRole('button', {name: 'Quality: H · 30 FPS'})).not.toBeNull()
        expect(screen.getByRole('button', {name: 'Quality: H · 30 FPS'}).querySelector('[data-icon="ranking-star"]')).not.toBeNull()
        expect(screen.getByRole('button', {name: 'Record'})).not.toBeNull()
        expect(screen.getByRole('button', {name: 'Cancel'})).not.toBeNull()
        expect(screen.getByRole('toolbar', {name: 'Video recording settings'})).not.toBeNull()
    })

    it('opens Ratio and Quality/FPS popups above their triggers', () => {
        render(<VideoRecordingSettingsToolbar/>)

        fireEvent.click(screen.getByRole('button', {name: 'Ratio: 16:9'}))
        expect(screen.getByTestId('ratio-popup-content')).not.toBeNull()
        expect(screen.queryByTestId('fps-popup-content')).toBeNull()

        fireEvent.click(screen.getByRole('button', {name: 'Quality: H · 30 FPS'}))
        expect(screen.queryByTestId('ratio-popup-content')).toBeNull()
        expect(screen.getByTestId('preset-popup-content')).not.toBeNull()
    })

    it('shows the Replay settings sliders only when synchronization is active', () => {
        render(<VideoRecordingSettingsToolbar/>)
        expect(screen.queryByRole('button', {name: 'Journey Replay Settings'})).toBeNull()

        globalThis.lgs.stores.replay.recordingSync = true
        cleanup()
        render(<VideoRecordingSettingsToolbar/>)

        expect(screen.getByRole('button', {name: 'Journey Replay Settings'})).not.toBeNull()
        expect(screen.getByRole('button', {name: 'Journey Replay Settings'}).querySelector('[data-icon="sliders"]')).not.toBeNull()
        expect(document.querySelectorAll('.video-recording-settings-separator')).toHaveLength(2)
        expect(document.getElementById('launch-the-replay-editor-from-video')?.classList).toContain('video-recording-settings-action')
        expect(document.getElementById('video-start-recording')?.classList).toContain('video-recording-settings-action')

        fireEvent.click(screen.getByRole('button', {name: 'Journey Replay Settings'}))
        expect(globalThis.__.ui.drawerManager.open).toHaveBeenCalledWith('replay-drawer')
    })

    it('replaces Draft recording with direct HQ export during timeline preparation', () => {
        globalThis.lgs.stores.replay.recordingSync = true
        globalThis.lgs.stores.ui.video.timelinePreviewActive = true
        const requestHqExport = vi.fn()
        globalThis.window.addEventListener('lgs:video:start-hq-export', requestHqExport)

        render(<VideoRecordingSettingsToolbar/>)

        expect(screen.queryByRole('button', {name: 'Record'})).toBeNull()
        expect(screen.getByRole('button', {name: 'Create HQ video'})).not.toBeNull()
        fireEvent.click(screen.getByRole('button', {name: 'Create HQ video'}))
        expect(requestHqExport).toHaveBeenCalledTimes(1)

        globalThis.window.removeEventListener('lgs:video:start-hq-export', requestHqExport)
    })

    it('waits for crop persistence before starting capture', async () => {
        let resolveCropSync = null
        globalThis.__.ui.widgetManager.syncCropDimensionsFromElement = vi.fn(() => new Promise(resolve => {
            resolveCropSync = resolve
        }))
        render(<VideoRecordingSettingsToolbar/>)

        const transition = fireEvent.click(screen.getByRole('button', {name: 'Record'}))
        expect(transition).toBe(true)
        expect(globalThis.lgs.stores.ui.video.editing).toBe(true)
        expect(prepareVideoCaptureUi).not.toHaveBeenCalled()

        resolveCropSync()
        await vi.waitFor(() => expect(prepareVideoCaptureUi).toHaveBeenCalledTimes(1))
        expect(globalThis.__.ui.replay.prepareReplayCamera).not.toHaveBeenCalled()
        expect(globalThis.lgs.stores.ui.video.editing).toBe(false)
        expect(globalThis.lgs.stores.ui.video.preRecording).toBe(true)
    })

    it('prepares the Replay camera only for a synchronized video', async () => {
        globalThis.lgs.stores.replay.recordingSync = true
        render(<VideoRecordingSettingsToolbar/>)

        fireEvent.click(screen.getByRole('button', {name: 'Record'}))

        await vi.waitFor(() => expect(globalThis.__.ui.replay.prepareReplayCamera).toHaveBeenCalledWith({
            journey: globalThis.lgs.theJourney,
        }))
    })

    it('waits for crop persistence before cancelling video setup', async () => {
        let resolveCropSync = null
        globalThis.__.ui.widgetManager.syncCropDimensionsFromElement = vi.fn(() => new Promise(resolve => {
            resolveCropSync = resolve
        }))
        render(<VideoRecordingSettingsToolbar/>)

        fireEvent.click(screen.getByRole('button', {name: 'Cancel'}))
        expect(cancelVideoEditing).not.toHaveBeenCalled()

        resolveCropSync()
        await vi.waitFor(() => expect(cancelVideoEditing).toHaveBeenCalledTimes(1))
    })

    it('hides the HUD while video finalization is active', () => {
        globalThis.lgs.stores.ui.video.finalizing = true
        render(<VideoRecordingSettingsToolbar/>)

        expect(screen.queryByRole('toolbar', {name: 'Video recording settings'})).toBeNull()
        expect(prepareVideoEditingUi).not.toHaveBeenCalled()
    })
})
