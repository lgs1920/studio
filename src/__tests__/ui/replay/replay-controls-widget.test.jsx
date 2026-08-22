/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-controls-widget.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-18
 * Last modified: 2026-08-04
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

vi.mock('@Components/MainUI/widgets/Widget', () => ({
    Widget: ({children, config}) => <div data-config={JSON.stringify(config)}
                                                                data-testid="widget">{children}</div>,
}))

vi.mock('@Core/ui/ReplayCropSnapshot', () => ({
    captureReplayCropSnapshot: vi.fn(),
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaCard: ({children, ...props}) => <div {...props}>{children}</div>,
    WaButton: ({children, ...props}) => <button type="button" {...props}>{children}</button>,
    WaIcon: ({animation, className, family, name}) => <span className={className} data-animation={animation}
                                                            data-family={family} data-icon={name}/>,
    WaTooltip: ({children}) => <>{children}</>,
}))

import { JourneyReplayControlsWidget } from '@Components/JourneyReplay/JourneyReplayControlsWidget'
import { captureReplayCropSnapshot } from '@Core/ui/ReplayCropSnapshot'

describe('JourneyReplayControlsWidget', () => {
    beforeEach(() => {
        globalThis.lgs = {
            settings: {
                unitSystem: proxy({current: 0}),
                ui: {
                    toolbars: {
                        opacity: 1,
                    },
                },
            },
            stores: {
                replay: proxy({
                    active: false,
                    playing: false,
                    paused: false,
                    toolbarVisible: true,
                    recordingSync: false,
                    mainUiHidden: false,
                }),
                ui: proxy({
                    drawers: proxy({
                        open: null,
                    }),
                    video: proxy({
                        preRecording: false,
                        recording: false,
                        recordingHQ: false,
                        snapshot: false,
                        finalizing: false,
                    }),
                }),
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.lgs = undefined
    })

    it('hides the floating replay toolbar while the sync link is active', () => {
        globalThis.lgs.stores.replay.recordingSync = true

        render(<JourneyReplayControlsWidget/>)

        expect(screen.queryByTestId('widget')).toBeNull()
    })

    it('hides the floating replay toolbar during HQ recording', () => {
        globalThis.lgs.stores.ui.video.recordingHQ = true

        render(<JourneyReplayControlsWidget/>)

        expect(screen.queryByTestId('widget')).toBeNull()
    })

    it('hides the floating replay toolbar while the video editor is open', () => {
        globalThis.lgs.stores.ui.video.editing = true

        render(<JourneyReplayControlsWidget/>)

        expect(screen.queryByTestId('widget')).toBeNull()
    })

    it('keeps the default position and dragging available in Draft and HQ modes', () => {
        const draftView = render(<JourneyReplayControlsWidget/>)
        const draftConfig = JSON.parse(screen.getByTestId('widget').dataset.config)

        expect(draftConfig.top).toBe('66.7%')
        expect(draftConfig.left).toBe('50%')
        expect(draftConfig.attachTo).toBe('center')
        expect(draftConfig.locked).toBe(false)
        expect(draftConfig.contextMenu.canPosition).toBe(true)
        expect(screen.getByTestId('widget').parentElement).toBe(document.body)

        draftView.unmount()
        globalThis.lgs.stores.replay.deferredExportPlan = {
            runtime: {
                status: 'exporting',
            },
        }

        render(<JourneyReplayControlsWidget/>)
        const hqConfig = JSON.parse(screen.getByTestId('widget').dataset.config)

        expect(hqConfig.top).toBe(draftConfig.top)
        expect(hqConfig.left).toBe(draftConfig.left)
        expect(hqConfig.attachTo).toBe(draftConfig.attachTo)
        expect(hqConfig.locked).toBe(false)
        expect(hqConfig.contextMenu.canPosition).toBe(true)
        expect(screen.getByTestId('widget').parentElement).toBe(document.body)
    })

    it('shows a stop button while HQ export is running', () => {
        const pauseExport = vi.fn()
        const resumeExport = vi.fn()
        const abortExport = vi.fn()
        globalThis.lgs.stores.replay.deferredExportPlan = {
            dimensions: {
                width:  1920,
                height: 1080,
            },
            runtime: {
                status:                         'exporting',
                exportProgress:                 0.5,
                exportElapsedMillis:            5000,
                exportEstimatedRemainingMillis: 5000,
                exportFileSize:                 1572864,
                exportPaused:                   false,
                pauseExport,
                resumeExport,
                abortExport,
            },
        }

        const view = render(<JourneyReplayControlsWidget/>)

        expect(document.querySelector('.replay-controls.video-recorder-widget-recording')).not.toBeNull()
        expect(screen.queryByText('Recording...')).toBeNull()
        expect(document.querySelector('[data-icon="circle"][data-family="duotone"]')).not.toBeNull()
        expect(document.querySelector('[data-icon="circle"]').className).toContain('video-recorder-indicator')
        expect(document.querySelector('[data-icon="circle"]').getAttribute('data-animation')).toBeNull()
        expect(screen.queryByText('HQ Video creation')).toBeNull()
        expect(screen.queryByText('MP4')).toBeNull()
        expect(screen.getByText(/1\.5 MB/)).not.toBeNull()
        expect(screen.queryByText('1920x1080')).toBeNull()
        expect(document.querySelector('[data-icon="films"]')).not.toBeNull()
        expect(document.querySelector('[data-icon="stopwatch"]')).not.toBeNull()
        expect(screen.getByText('00:05')).not.toBeNull()
        expect(screen.getByText('50%')).not.toBeNull()
        expect(screen.queryByText(/km/)).toBeNull()
        fireEvent.click(screen.getByRole('button', {name: 'Pause HQ creation'}))
        fireEvent.click(screen.getByRole('button', {name: 'Abort HQ creation'}))
        fireEvent.click(screen.getByRole('button', {name: 'Take replay snapshot'}))

        expect(pauseExport).toHaveBeenCalledTimes(1)
        expect(abortExport).toHaveBeenCalledTimes(1)
        expect(captureReplayCropSnapshot).toHaveBeenCalledTimes(1)

        view.unmount()
        globalThis.lgs.stores.replay.deferredExportPlan.runtime.exportPaused = true
        globalThis.lgs.stores.replay.deferredExportPlan.runtime.exportFileSize = 2097152
        render(<JourneyReplayControlsWidget/>)
        expect(screen.getByText(/2\.0 MB/)).not.toBeNull()
        expect(document.querySelector('[data-icon="circle"][data-animation="fade"]')).not.toBeNull()
        expect(document.querySelector('[data-icon="circle"]').className).toContain('paused')
        fireEvent.click(screen.getByRole('button', {name: 'Continue HQ creation'}))

        expect(resumeExport).toHaveBeenCalledTimes(1)
    })
})
