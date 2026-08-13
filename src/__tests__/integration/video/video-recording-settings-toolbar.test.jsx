/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: video-recording-settings-toolbar.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-03
 * Last modified: 2026-07-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

let lastTunnelProps = null

vi.mock('@Components/Tunnel/Tunnel', () => ({
    Tunnel: props => {
        lastTunnelProps = props
        const {leadingAction, steps = [], cancelTooltip, defaultStepIndex = 0} = props
        return (
        <div data-testid="tunnel">
            <div data-testid="default-step-index">{String(defaultStepIndex)}</div>
            <div data-testid="leading-action-slot">{leadingAction}</div>
            <div data-testid="steps">{steps.map(step => <button key={step.text} type="button" variant={step.variant ?? 'neutral'} appearance={step.appearance ?? 'plain'}>{step.text}</button>)}</div>
            <div data-testid="cancel-tooltip">{JSON.stringify(cancelTooltip)}</div>
        </div>
        )
    },
    TunnelTooltip: ({children}) => <>{children}</>,
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, ...props}) => <button type="button" {...props}>{children}</button>,
    WaIcon: ({name}) => <span data-icon={name}/>,
    WaTooltip: () => null,
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
        lastTunnelProps = null
        globalThis.__ = {
            ui: {
                drawerManager: {
                    close:     vi.fn(),
                    isCurrent: vi.fn(() => false),
                },
                widgetCache: {
                    hideAllExceptBoards: vi.fn(),
                },
                widgetManager: {
                    windowResizing: false,
                    getWidgetConfig:               vi.fn(() => null),
                    syncCropDimensionsFromElement: vi.fn(async () => null),
                },
            },
            recorder: {},
        }

        globalThis.lgs = {
            theJourney: {slug: 'journey-a'},
            settings: {
                ui: {
                    video: proxy({
                        captureMode: 'speed',
                    }),
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
                        cropper: {},
                    }),
                }),
                replay: proxy({
                    recordingSync: false,
                }),
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('shows the JourneyReplay launcher only when the sync link is active', () => {
        const {unmount} = render(<VideoRecordingSettingsToolbar/>)

        expect(prepareVideoEditingUi).toHaveBeenCalledTimes(1)
        expect(prepareVideoCaptureUi).not.toHaveBeenCalled()
        expect(screen.queryByRole('button', {name: 'Journey Replay Settings'})).toBeNull()

        unmount()
        globalThis.lgs.stores.replay.recordingSync = true
        render(<VideoRecordingSettingsToolbar/>)

        const button = screen.getByRole('button', {name: 'Journey Replay Settings'})
        expect(button).not.toBeNull()
        expect(button.getAttribute('aria-pressed')).toBe('false')
        expect(button.getAttribute('variant')).toBe('neutral')
        expect(button.getAttribute('appearance')).toBe('plain')
        expect(button.className).not.toContain('square-button')
        expect(button.className).not.toContain('lgs-tunnel-element')

        expect(screen.getByRole('button', {name: 'Compose video'}).getAttribute('variant')).toBe('neutral')
        expect(screen.getByRole('button', {name: 'Compose video'}).getAttribute('appearance')).toBe('plain')
        const toolbar = screen.getByText('Compose video').closest('.video-recording-settings-toolbar')
        expect(toolbar).not.toBeNull()
        expect(toolbar.className).toContain('lgs-toolbar-content')
        expect(toolbar.className).toContain('lgs-toolbar')
        expect(toolbar.className).toContain('lgs-toolbar-horizontal')
        expect(toolbar.className).toContain('wa-theme-lgs1920-on-map')
        expect(__.ui.widgetManager.syncCropDimensionsFromElement).not.toHaveBeenCalled()
    })

    it('forces video UI masking before entering the recording phase', async () => {
        render(<VideoRecordingSettingsToolbar/>)
        prepareVideoCaptureUi.mockClear()
        prepareVideoEditingUi.mockClear()

        await lastTunnelProps.steps[1].onClick(1, {
            currentTarget: {
                getBoundingClientRect: () => ({left: 10, top: 20, width: 100, height: 40}),
            },
            nativeEvent: {
                clientX: 40,
                clientY: 60,
            },
        })
        expect(prepareVideoCaptureUi).toHaveBeenCalledTimes(1)
        expect(prepareVideoEditingUi).not.toHaveBeenCalled()
        expect(globalThis.lgs.stores.ui.video.preRecording).toBe(true)
    })

    it('waits for crop persistence before atomically leaving editing for pre-recording', async () => {
        let resolveCropSync = null
        globalThis.__.ui.widgetManager.syncCropDimensionsFromElement = vi.fn(() => new Promise(resolve => {
            resolveCropSync = resolve
        }))
        render(<VideoRecordingSettingsToolbar/>)

        const transition = lastTunnelProps.steps[1].onClick(1, {
            currentTarget: {
                getBoundingClientRect: () => ({left: 10, top: 20, width: 100, height: 40}),
            },
            nativeEvent: {
                clientX: 40,
                clientY: 60,
            },
        })

        expect(globalThis.lgs.stores.ui.video.editing).toBe(true)
        expect(globalThis.lgs.stores.ui.video.preRecording).toBe(false)
        expect(prepareVideoCaptureUi).not.toHaveBeenCalled()

        resolveCropSync()
        await transition

        expect(globalThis.lgs.stores.ui.video.editing).toBe(false)
        expect(globalThis.lgs.stores.ui.video.preRecording).toBe(true)
        expect(prepareVideoCaptureUi).toHaveBeenCalledTimes(1)
    })

    it('hides the tunnel while an HQ export is finalizing', () => {
        Object.assign(globalThis.lgs.stores.ui.video, {
            editing:    true,
            finalizing: true,
        })

        render(<VideoRecordingSettingsToolbar/>)

        expect(screen.queryByTestId('tunnel')).toBeNull()
        expect(prepareVideoEditingUi).not.toHaveBeenCalled()
        expect(prepareVideoCaptureUi).not.toHaveBeenCalled()
    })

    it('marks the JourneyReplay launcher as selected when the drawer is already open', () => {
        globalThis.lgs.stores.replay.recordingSync = true
        globalThis.__.ui.drawerManager.isCurrent = vi.fn(() => true)

        render(<VideoRecordingSettingsToolbar/>)

        const button = screen.getByRole('button', {name: 'Journey Replay Settings'})
        expect(button.getAttribute('aria-pressed')).toBe('true')
        expect(button.className).toContain('is-selected')
    })

    it('starts on the crop zone while recording is immediately available', () => {
        globalThis.__.ui.widgetManager.getWidgetConfig = vi.fn(() => ({
            cropDimensions: {
                left:   10,
                top:    20,
                width:  640,
                height: 360,
            },
        }))

        render(<VideoRecordingSettingsToolbar/>)

        expect(screen.getByTestId('default-step-index').textContent).toBe('0')
        expect(lastTunnelProps.steps[0].icon).toBe('paintbrush-pencil')
        expect(lastTunnelProps.steps[0].done).toBe(true)
        expect(__.ui.widgetManager.syncCropDimensionsFromElement).not.toHaveBeenCalled()
    })

    it('closes crop editors when entering the recording step directly', () => {
        globalThis.__.ui.widgetManager.getWidgetConfig = vi.fn(() => ({
            cropDimensions: {
                left:   10,
                top:    20,
                width:  640,
                height: 360,
            },
        }))
        Object.assign(globalThis.lgs.stores.ui.video.cropper, {
            ratioEditor:  true,
            presetEditor: true,
            widgetEditor: true,
        })

        render(<VideoRecordingSettingsToolbar/>)

        expect(lastTunnelProps.steps[1].beforeStep()).toBe(true)
        expect(globalThis.lgs.stores.ui.video.step).toBe(1)
        expect(globalThis.lgs.stores.ui.video.cropper).toEqual(expect.objectContaining({
                                                                                           ratioEditor:  false,
                                                                                           presetEditor: false,
                                                                                           widgetEditor: false,
                                                                                       }))
        expect(__.ui.widgetManager.windowResizing).toBe(false)

    })

    it('keeps crop resizing and widget editing active in the unified composition step', () => {
        globalThis.__.ui.widgetManager.getWidgetConfig = vi.fn(() => ({
            cropDimensions: {
                left:   10,
                top:    20,
                width:  640,
                height: 360,
            },
        }))
        globalThis.__.ui.widgetManager.windowResizing = true
        Object.assign(globalThis.lgs.stores.ui.video, {step: 1})
        Object.assign(globalThis.lgs.stores.ui.video.cropper, {
            ratioEditor:  true,
            presetEditor: true,
            widgetEditor: false,
        })

        render(<VideoRecordingSettingsToolbar/>)

        expect(lastTunnelProps.steps[0].beforeStep()).toBe(true)
        expect(globalThis.lgs.stores.ui.video.step).toBe(0)
        expect(globalThis.lgs.stores.ui.video.cropper).toEqual(expect.objectContaining({
                                                                                           ratioEditor:  true,
                                                                                           presetEditor: true,
                                                                                           widgetEditor: true,
                                                                                       }))
        expect(__.ui.widgetManager.windowResizing).toBe(true)
    })

    it('persists the current crop dimensions when leaving video parameters', () => {
        render(<VideoRecordingSettingsToolbar/>)

        expect(lastTunnelProps.steps[0].afterStep()).toBe(true)

        expect(__.ui.widgetManager.syncCropDimensionsFromElement).toHaveBeenCalledWith(
            expect.any(String),
            true,
            'composition-exit',
        )
    })

    it('waits for crop persistence before closing the video editor', async () => {
        let resolveCropSync = null
        globalThis.__.ui.widgetManager.syncCropDimensionsFromElement = vi.fn(() => new Promise(resolve => {
            resolveCropSync = resolve
        }))
        render(<VideoRecordingSettingsToolbar/>)

        const closing = lastTunnelProps.onCancel()

        expect(__.ui.widgetManager.syncCropDimensionsFromElement).toHaveBeenCalledWith(
            expect.any(String),
            true,
            'editing-exit',
        )
        expect(cancelVideoEditing).not.toHaveBeenCalled()

        resolveCropSync()
        await closing

        expect(cancelVideoEditing).toHaveBeenCalledTimes(1)
    })

    it('still starts on the crop zone when no dimensions are defined', () => {
        globalThis.__.ui.widgetManager.getWidgetConfig = vi.fn(() => ({
            cropDimensions: null,
        }))

        render(<VideoRecordingSettingsToolbar/>)

        expect(screen.getByTestId('default-step-index').textContent).toBe('0')
        expect(lastTunnelProps.steps[0].done).toBe(false)
    })

})
