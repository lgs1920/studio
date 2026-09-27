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
 * Last modified: 2026-09-27
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

vi.mock('@Components/LGSPopup', () => ({
    LGSPopup: ({active, children, placement}) => active ? <div data-testid="settings-popup" data-placement={placement}>{children}</div> : null,
}))

vi.mock('@Components/ToolsUI/cropper/widgets/CropRatioEditorToolbar', () => ({
    CropRatioEditorToolbar: ({mainTheme, unifiedChoices}) => <div data-testid="ratio-popup-content" data-main-theme={mainTheme} data-unified-choices={unifiedChoices}>Ratio choices</div>,
}))

vi.mock('@Components/MainUI/video/toolbox/VideoPresetToolbar', () => ({
    VideoPresetToolbar: ({compactSimple, inlineCustom, mainTheme}) => <div data-testid="preset-popup-content" data-compact-simple={compactSimple} data-inline-custom={inlineCustom} data-main-theme={mainTheme}>Preset, FPS and quality choices</div>,
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
                    toggle: vi.fn(),
                },
                replay: {
                    prepareReplayCamera: vi.fn(async () => true),
                },
                replayVideoSync: {
                    arm: vi.fn(),
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
                    replay: proxy({simple: {duration: 15}}),
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
                replay: proxy({recordingSync: false, simplePreparationActive: false, duration: 60}),
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
        expect(screen.getByRole('button', {name: 'High · 30 FPS'})).not.toBeNull()
        expect(screen.getByRole('button', {name: 'High · 30 FPS'}).querySelector('[data-icon="ranking-star"]')).not.toBeNull()
        expect(screen.queryByRole('button', {name: 'Record'})).toBeNull()
        expect(screen.getByRole('button', {name: 'Cancel'})).not.toBeNull()
        expect(screen.getByRole('toolbar', {name: 'Video recording settings'})).not.toBeNull()
    })

    it('uses the main application theme when embedded in the timeline menu', () => {
        render(<VideoRecordingSettingsToolbar mainTheme/>)

        const toolbar = document.querySelector('.video-recording-settings-toolbar')
        expect(toolbar.classList).toContain('wa-theme-lgs1920')
        expect(toolbar.classList).not.toContain('wa-theme-lgs1920-on-map')
    })

    it('renders only ratio and quality controls in the timeline drawer mode', () => {
        render(<VideoRecordingSettingsToolbar mainTheme layout="timeline-drawer" mode="video-options"/>)

        expect(screen.getByRole('button', {name: 'Ratio: 16:9'})).not.toBeNull()
        expect(screen.getByRole('button', {name: 'High · 30 FPS'})).not.toBeNull()
        expect(screen.queryByRole('button', {name: 'Journey Replay Settings'})).toBeNull()
        expect(screen.queryByRole('button', {name: 'Record'})).toBeNull()
        expect(screen.queryByRole('button', {name: 'Cancel'})).toBeNull()
    })

    it('keeps only the cancel action in the linked timeline toolbar', () => {
        globalThis.lgs.stores.replay.recordingSync = true
        render(<VideoRecordingSettingsToolbar mainTheme mode="actions"/>)

        expect(screen.queryByRole('button', {name: 'Ratio: 16:9'})).toBeNull()
        expect(screen.queryByRole('button', {name: 'High · 30 FPS'})).toBeNull()
        expect(screen.queryByRole('button', {name: 'Journey Replay Settings'})).toBeNull()
        expect(screen.queryByRole('button', {name: 'Create Replay video'})).toBeNull()
        expect(screen.getByRole('button', {name: 'Cancel'})).not.toBeNull()
    })

    it('opens Ratio and Quality/FPS popups at the bottom end of their triggers', () => {
        render(<VideoRecordingSettingsToolbar/>)

        expect(screen.getByRole('button', {name: 'Ratio: 16:9'}).querySelector('[data-icon="chevron-down"]')).not.toBeNull()
        expect(screen.getByRole('button', {name: 'High · 30 FPS'}).querySelector('[data-icon="chevron-down"]')).not.toBeNull()

        fireEvent.click(screen.getByRole('button', {name: 'Ratio: 16:9'}))
        expect(screen.getByTestId('ratio-popup-content')).not.toBeNull()
        expect(screen.getByTestId('settings-popup').dataset.placement).toBe('bottom-end')
        expect(screen.queryByTestId('fps-popup-content')).toBeNull()

        fireEvent.click(screen.getByRole('button', {name: 'High · 30 FPS'}))
        expect(screen.queryByTestId('ratio-popup-content')).toBeNull()
        expect(screen.getByTestId('preset-popup-content')).not.toBeNull()
        expect(screen.getByTestId('settings-popup').dataset.placement).toBe('bottom-end')
    })

    it('passes the main application theme to custom-menu submenus', () => {
        render(<VideoRecordingSettingsToolbar mainTheme/>)

        fireEvent.click(screen.getByRole('button', {name: 'Ratio: 16:9'}))
        expect(screen.getByTestId('ratio-popup-content').dataset.mainTheme).toBe('true')

        fireEvent.click(screen.getByRole('button', {name: 'High · 30 FPS'}))
        expect(screen.getByTestId('preset-popup-content').dataset.mainTheme).toBe('true')
        expect(document.querySelector('.video-recording-settings-popup')?.classList).toContain('wa-theme-lgs1920')
        expect(document.querySelector('.video-recording-settings-popup')?.classList).not.toContain('wa-theme-lgs1920-on-map')
    })

    it('opens the Simple Replay settings above the widget and applies its selected duration', () => {
        globalThis.lgs.stores.replay.simplePreparationActive = true
        render(<VideoRecordingSettingsToolbar/>)

        expect(screen.getByText('16:9')).not.toBeNull()
        expect(screen.getByText('High · 30 FPS')).not.toBeNull()
        expect(screen.getByText('15s')).not.toBeNull()
        expect(screen.getByRole('button', {name: 'Replay settings'}).querySelector('[data-icon="gear"]')).not.toBeNull()
        expect(screen.queryByRole('button', {name: 'Journey Replay Settings'})).toBeNull()
        expect(screen.queryByRole('button', {name: 'Ratio: 16:9'})).toBeNull()

        fireEvent.click(screen.getByRole('button', {name: 'Replay settings'}))
        expect(screen.getByTestId('settings-popup').dataset.placement).toBe('bottom')
        expect(screen.getByTestId('ratio-popup-content').dataset.unifiedChoices).toBe('true')
        expect(screen.getByText('Ratio')).not.toBeNull()
        expect(screen.getByText('Preset')).not.toBeNull()
        expect(screen.getByText('Duration')).not.toBeNull()
        expect(screen.getByRole('button', {name: '15s'}).getAttribute('aria-pressed')).toBe('true')
        expect(screen.getByTestId('preset-popup-content').dataset.inlineCustom).toBe('false')
        expect(screen.getByTestId('preset-popup-content').dataset.compactSimple).toBe('true')

        fireEvent.click(screen.getByRole('button', {name: '20s'}))
        expect(globalThis.lgs.settings.ui.replay.simple.duration).toBe(20)
        expect(globalThis.lgs.settings.ui.replay.duration).toBe(20)
        expect(globalThis.lgs.stores.replay.duration).toBe(20)
    })

    it('uses the Simple Replay gear popup for the Expert timeline without duration', () => {
        globalThis.lgs.stores.replay.recordingSync = true
        render(<VideoRecordingSettingsToolbar mainTheme mode="actions" timelineSettings/>)

        const summary = document.querySelector('.simple-replay-settings-summary')
        expect(summary.firstElementChild.getAttribute('aria-label')).toBe('Replay settings')
        expect(screen.getByText('16:9')).not.toBeNull()
        expect(screen.getByText('High · 30 FPS')).not.toBeNull()
        expect(screen.getByRole('button', {name: 'Replay settings'}).querySelector('[data-icon="gear"]')).not.toBeNull()
        expect(screen.getByRole('button', {name: 'Journey Replay settings'})).not.toBeNull()
        expect(screen.getByRole('button', {name: 'Record'})).not.toBeNull()
        expect(screen.queryByText('15s')).toBeNull()
        expect(screen.queryByText('Duration')).toBeNull()

        fireEvent.click(screen.getByRole('button', {name: 'Journey Replay settings'}))
        expect(globalThis.__.ui.drawerManager.toggle).toHaveBeenCalledWith('replay-drawer')

        fireEvent.click(screen.getByRole('button', {name: 'Replay settings'}))
        expect(screen.getByTestId('settings-popup').dataset.placement).toBe('bottom')
        expect(screen.getByTestId('ratio-popup-content').dataset.unifiedChoices).toBe('true')
        expect(screen.getByTestId('preset-popup-content').dataset.compactSimple).toBe('true')
        expect(screen.queryByText('Duration')).toBeNull()
    })

    it('exposes the video launch action during simple preparation', async () => {
        globalThis.lgs.stores.replay.simplePreparationActive = true
        render(<VideoRecordingSettingsToolbar/>)

        expect(screen.getByRole('button', {name: 'Record'})).not.toBeNull()
        expect(screen.queryByRole('button', {name: 'Create Replay video'})).toBeNull()

        fireEvent.click(screen.getByRole('button', {name: 'Record'}))

        await vi.waitFor(() => expect(globalThis.lgs.stores.ui.video.preRecording).toBe(true))
        expect(globalThis.lgs.stores.ui.video.editing).toBe(false)
        expect(prepareVideoCaptureUi).toHaveBeenCalledTimes(1)
        expect(globalThis.__.ui.replay.prepareReplayCamera).toHaveBeenCalledWith({
            journey: globalThis.lgs.theJourney,
        })
        expect(globalThis.__.ui.replayVideoSync.arm).toHaveBeenCalledWith({
            recorder:          globalThis.__.recorder,
            replay:            globalThis.__.ui.replay,
            store:             globalThis.lgs.stores.replay,
            autoStopRecording: true,
            resetToStart:      true,
        })
    })

    it('exposes the same video launch action during the Expert timeline', async () => {
        globalThis.lgs.stores.replay.recordingSync = true
        render(<VideoRecordingSettingsToolbar mode="actions" timelineSettings/>)

        fireEvent.click(screen.getByRole('button', {name: 'Record'}))

        await vi.waitFor(() => expect(globalThis.lgs.stores.ui.video.preRecording).toBe(true))
        expect(prepareVideoCaptureUi).toHaveBeenCalledTimes(1)
        expect(globalThis.__.ui.replayVideoSync.arm).toHaveBeenCalledWith({
            recorder:          globalThis.__.recorder,
            replay:            globalThis.__.ui.replay,
            store:             globalThis.lgs.stores.replay,
            autoStopRecording: true,
            resetToStart:      true,
        })
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
