import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

vi.mock('@Components/MainUI/widgets/Widget', () => ({
    Widget: ({children}) => <div data-testid="widget">{children}</div>,
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaCard: ({children, ...props}) => <div {...props}>{children}</div>,
    WaButton: ({children, ...props}) => <button type="button" {...props}>{children}</button>,
    WaIcon: ({name}) => <span data-icon={name}/>,
    WaTooltip: ({children}) => <>{children}</>,
}))

import { JourneyReplayControlsWidget } from '@Components/JourneyReplay/JourneyReplayControlsWidget'

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

    it('shows a stop button while HQ export is running', () => {
        const pauseExport = vi.fn()
        const resumeExport = vi.fn()
        const abortExport = vi.fn()
        globalThis.lgs.stores.replay.deferredExportPlan = {
            runtime: {
                status:                         'exporting',
                exportProgress:                 0.5,
                exportElapsedMillis:            5000,
                exportEstimatedRemainingMillis: 5000,
                exportPaused:                   false,
                pauseExport,
                resumeExport,
                abortExport,
            },
        }

        const view = render(<JourneyReplayControlsWidget/>)

        expect(screen.getByText('HQ Video creation')).not.toBeNull()
        expect(screen.getByText('00:05')).not.toBeNull()
        expect(screen.getByText('50%')).not.toBeNull()
        expect(screen.queryByText(/km/)).toBeNull()
        fireEvent.click(screen.getByRole('button', {name: 'Pause HQ creation'}))
        fireEvent.click(screen.getByRole('button', {name: 'Abort HQ creation'}))

        expect(pauseExport).toHaveBeenCalledTimes(1)
        expect(abortExport).toHaveBeenCalledTimes(1)

        view.unmount()
        globalThis.lgs.stores.replay.deferredExportPlan.runtime.exportPaused = true
        render(<JourneyReplayControlsWidget/>)
        fireEvent.click(screen.getByRole('button', {name: 'Continue HQ creation'}))

        expect(resumeExport).toHaveBeenCalledTimes(1)
    })
})
