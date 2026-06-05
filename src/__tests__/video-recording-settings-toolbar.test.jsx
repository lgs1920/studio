/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: video-recording-settings-toolbar.test.jsx
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

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

vi.mock('@Components/Tunnel/Tunnel', () => ({
    Tunnel: ({leadingAction, steps = [], cancelTooltip}) => (
        <div data-testid="tunnel">
            <div data-testid="leading-action-slot">{leadingAction}</div>
            <div data-testid="steps">{steps.map(step => <button key={step.text} type="button" variant={step.variant ?? 'neutral'} appearance={step.appearance ?? 'plain'}>{step.text}</button>)}</div>
            <div data-testid="cancel-tooltip">{JSON.stringify(cancelTooltip)}</div>
        </div>
    ),
    TunnelTooltip: ({children}) => <>{children}</>,
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, ...props}) => <button type="button" {...props}>{children}</button>,
    WaIcon: ({name}) => <span data-icon={name}/>,
    WaTooltip: () => null,
}))

vi.mock('@Components/MainUI/video/videoEditingCleanup', () => ({
    cancelVideoEditing: vi.fn(),
}))

import { VideoRecordingSettingsToolbar } from '@Components/MainUI/video/toolbox/VideoRecordingSettingsToolbar'

describe('VideoRecordingSettingsToolbar', () => {
    beforeEach(() => {
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
                },
            },
            recorder: {},
        }

        globalThis.lgs = {
            theJourney: {slug: 'journey-a'},
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
                flythrough: proxy({
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

    it('shows the Flythrough launcher only when the sync link is active', () => {
        const {unmount} = render(<VideoRecordingSettingsToolbar/>)

        expect(screen.queryByRole('button', {name: 'Open Flythrough drawer'})).toBeNull()

        unmount()
        globalThis.lgs.stores.flythrough.recordingSync = true
        render(<VideoRecordingSettingsToolbar/>)

        const button = screen.getByRole('button', {name: 'Open Flythrough drawer'})
        expect(button).not.toBeNull()
        expect(button.getAttribute('aria-pressed')).toBe('false')
        expect(button.getAttribute('variant')).toBe('neutral')
        expect(button.getAttribute('appearance')).toBe('plain')
        expect(button.className).not.toContain('square-button')
        expect(button.className).not.toContain('lgs-tunnel-element')

        expect(screen.getByRole('button', {name: 'Video parameters'}).getAttribute('variant')).toBe('neutral')
        expect(screen.getByRole('button', {name: 'Video parameters'}).getAttribute('appearance')).toBe('plain')
        const toolbar = screen.getByText('Video parameters').closest('.video-recording-settings-toolbar')
        expect(toolbar).not.toBeNull()
        expect(toolbar.className).toContain('lgs-toolbar-content')
        expect(toolbar.className).toContain('lgs-toolbar')
        expect(toolbar.className).toContain('lgs-toolbar-horizontal')
        expect(toolbar.className).toContain('wa-theme-lgs1920-on-map')
    })

    it('marks the Flythrough launcher as selected when the drawer is already open', () => {
        globalThis.lgs.stores.flythrough.recordingSync = true
        globalThis.__.ui.drawerManager.isCurrent = vi.fn(() => true)

        render(<VideoRecordingSettingsToolbar/>)

        const button = screen.getByRole('button', {name: 'Open Flythrough drawer'})
        expect(button.getAttribute('aria-pressed')).toBe('true')
        expect(button.className).toContain('is-selected')
    })
})
