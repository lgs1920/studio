import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'

const widgetHarness = vi.hoisted(() => ({
    config: null,
    expandRequestKey: null,
}))

vi.mock('@Components/JourneyReplay/JourneyReplayProgressBar', () => ({
    JourneyReplayProgressBar: ({showSettings}) => (
        <div data-testid="replay-progress" data-show-settings={showSettings}/>
    ),
}))

const snapshotHarness = vi.hoisted(() => ({
    capture: vi.fn(),
}))

vi.mock('@Core/ui/ReplayCropSnapshot', () => ({
    captureReplayCropSnapshot: snapshotHarness.capture,
}))

vi.mock('@Components/MainUI/widgets/Widget', () => ({
    Widget: ({children, config, expandRequestKey}) => {
        widgetHarness.config = config
        widgetHarness.expandRequestKey = expandRequestKey
        return <div data-testid="widget">{children}</div>
    },
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({appearance, children, size: _size, variant: _variant, ...props}) => (
        <button type="button" data-appearance={appearance} {...props}>{children}</button>
    ),
    WaIcon: ({animation, className, label, name}) => <span className={className} data-animation={animation} data-icon={name} data-label={label}/>,
    WaDivider: ({className}) => <hr className={className}/>,
    WaProgressBar: ({children, label, value, ...props}) => (
        <div
            role="progressbar"
            aria-label={label}
            aria-valuenow={value}
            data-progress-value={value}
            {...props}
        >
            {children}
        </div>
    ),
    WaTooltip: ({children, for: _for, ...props}) => <span {...props}>{children}</span>,
}))

import {ReplayRecordingMonitorWidget} from '@Components/MainUI/video/ReplayRecordingMonitorWidget'
import {
    startReplayRecordingMonitor,
    stopReplayRecordingMonitor,
    updateReplayRecordingMonitor,
} from '@Core/ui/replay/ReplayRecordingMonitor'

describe('ReplayRecordingMonitorWidget', () => {
    beforeEach(() => {
        widgetHarness.config = null
        widgetHarness.expandRequestKey = null
        snapshotHarness.capture.mockReset()
        globalThis.__ = {
            recorder: {
                cancelVideo: vi.fn().mockResolvedValue(undefined),
                pauseVideo: vi.fn(),
                resumeVideo: vi.fn(),
            },
        }
        globalThis.lgs = {
            gutter: {s: 8},
            settings: {ui: {toolbars: {opacity: 1}}},
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
                    video: proxy({
                        editing: false,
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
        stopReplayRecordingMonitor()
        globalThis.__ = undefined
        globalThis.lgs = undefined
        delete document.pictureInPictureEnabled
        delete globalThis.HTMLVideoElement?.prototype?.requestPictureInPicture
        document.pictureInPictureElement = null
        document.exitPictureInPicture = undefined
    })

    /**
     * Install the browser capabilities required by the PiP integration test.
     *
     * @returns {void} Nothing.
     */
    const enablePictureInPicture = () => {
        Object.defineProperty(document, 'pictureInPictureEnabled', {
            configurable: true,
            value: true,
        })
        Object.defineProperty(globalThis.HTMLVideoElement.prototype, 'requestPictureInPicture', {
            configurable: true,
            value: vi.fn().mockResolvedValue(undefined),
        })
    }

    it('owns the normal replay transport when the toolbar is visible', () => {
        render(<ReplayRecordingMonitorWidget/>)

        expect(screen.getByText('Replay')).not.toBeNull()
        expect(screen.getByTestId('replay-progress').dataset.showSettings).toBe('true')
        expect(document.querySelector('.replay-recording-monitor.is-replay-controls')).not.toBeNull()
        expect(document.querySelector('[data-icon="clapperboard-play"]')).not.toBeNull()
        expect(screen.queryByLabelText('Close recording monitor')).toBeNull()
        expect(screen.queryByLabelText('Minimize recording monitor')).toBeNull()
    })

    it('hides normal replay transport while synchronized recording owns the surface', () => {
        globalThis.lgs.stores.replay.recordingSync = true

        const view = render(<ReplayRecordingMonitorWidget/>)

        expect(screen.queryByTestId('replay-progress')).toBeNull()

        globalThis.lgs.stores.replay.recordingSync = false
        globalThis.lgs.stores.ui.video.editing = true
        view.rerender(<ReplayRecordingMonitorWidget/>)

        expect(screen.queryByTestId('replay-progress')).toBeNull()
    })

    it('uses the Widget manager contract and routes icon-only recording actions', () => {
        const pauseExport = vi.fn()
        const abortExport = vi.fn()
        globalThis.lgs.stores.replay.deferredExportPlan = {
            runtime: {
                pauseExport,
                abortExport,
            },
        }
        startReplayRecordingMonitor({
            mode: 'hq',
            frameCount: 10,
            videoDurationMillis: 10000,
        })
        updateReplayRecordingMonitor({
            phase: 'encoding',
            progress: 0.4,
            processedFrames: 4,
            elapsedMillis: 3000,
            estimatedRemainingMillis: 7000,
            size: 1572864,
        })

        render(<ReplayRecordingMonitorWidget/>)

        expect(screen.getByText('Recording')).not.toBeNull()
        expect(screen.getByText('4/10')).not.toBeNull()
        expect(screen.getByText('00:07')).not.toBeNull()
        expect(screen.getByText('00:04 / 00:10')).not.toBeNull()
        expect(screen.getByText('1.5 MB')).not.toBeNull()
        expect(screen.getByText('40%')).not.toBeNull()
        expect(screen.getByRole('progressbar', {name: 'Recording progress: 40%'})
            .getAttribute('aria-valuenow')).toBe('40')
        expect(screen.queryByText('Remaining time')).toBeNull()
        expect(document.querySelector('[data-icon="clapperboard-play"]')).toBeNull()
        expect(document.querySelector('[data-icon="stopwatch"]')).not.toBeNull()
        expect(document.querySelector('[data-icon="images"]')).not.toBeNull()
        expect(document.querySelector('[data-icon="films"]')).not.toBeNull()
        expect(document.querySelector('[data-icon="hard-drive"]')).not.toBeNull()
        expect(widgetHarness.config.icon).toBe('clapperboard-play')
        expect(widgetHarness.config.canReduce).toBe(true)
        expect(widgetHarness.config.resizable).toBe(true)
        expect(widgetHarness.config.showControlBox).toBe(true)
        expect(widgetHarness.config.attachTo).toBe('bottom-right')
        expect(widgetHarness.config.min).toEqual({width: 360, height: 380})
        expect(widgetHarness.config.contextMenu.canRemove).toBe(false)
        expect(widgetHarness.config.preserveChildrenWhenCollapsed).toBe(true)
        expect(screen.queryByRole('button', {name: 'Open recording monitor in Picture-in-Picture'})).toBeNull()
        expect(screen.getByRole('button', {name: 'Take replay snapshot'})).not.toBeNull()
        expect(document.querySelector('.replay-recording-monitor.wa-theme-lgs1920-on-map')).not.toBeNull()
        expect(Array.from(document.querySelectorAll('.replay-recording-monitor button'))
            .every(button => button.dataset.appearance === 'plain')).toBe(true)

        const header = document.querySelector('.replay-recording-monitor-header')
        expect(header.children[0].className).toContain('video-recorder-indicator')
        expect(header.children[1].className).toContain('replay-recording-monitor-title')
        expect(header.querySelector('#replay-monitor-cancel')).not.toBeNull()
        expect(header.querySelector('[data-icon="clapperboard-play"]')).toBeNull()

        const metrics = document.querySelector('.replay-recording-monitor-metrics')
        expect(metrics.querySelector('.replay-recording-monitor-metric-size')).not.toBeNull()
        expect(metrics.querySelector('.replay-recording-monitor-metric-duration')).not.toBeNull()
        expect(metrics.querySelector('.replay-recording-monitor-metric-frames')).not.toBeNull()
        expect(document.querySelector('.replay-recording-monitor-divider')).not.toBeNull()

        const controlGroups = document.querySelectorAll('.replay-recording-monitor-control-group')
        expect(controlGroups).toHaveLength(3)
        expect(controlGroups[0].querySelector('#replay-monitor-snapshot')).not.toBeNull()
        expect(controlGroups[1].querySelector('#replay-monitor-pause')).not.toBeNull()
        expect(controlGroups[1].querySelector('#replay-monitor-stop')).not.toBeNull()
        expect(controlGroups[2].querySelector('#replay-monitor-pip')).toBeNull()

        const pauseButton = screen.getByRole('button', {name: 'Pause recording'})
        const cancelButton = screen.getByRole('button', {name: 'Cancel recording'})
        expect(pauseButton.textContent).toBe('')
        expect(cancelButton.textContent).toBe('')

        fireEvent.click(pauseButton)
        fireEvent.click(screen.getByRole('button', {name: 'Take replay snapshot'}))
        fireEvent.click(cancelButton)

        expect(pauseExport).toHaveBeenCalledTimes(1)
        expect(abortExport).toHaveBeenCalledTimes(1)
        expect(snapshotHarness.capture).toHaveBeenCalledTimes(1)
    })

    it('uses blinking warning states for preparation and finalization', async () => {
        startReplayRecordingMonitor({mode: 'hq'})
        render(<ReplayRecordingMonitorWidget/>)

        expect(screen.getByText('Preparing')).not.toBeNull()
        expect(screen.getByText('Preparing').className).toContain('blinking')
        expect(document.querySelector('.video-recorder-indicator.preparing')).not.toBeNull()
        expect(document.querySelector('.video-recorder-indicator')?.dataset.animation).toBe('beat-fade')

        updateReplayRecordingMonitor({phase: 'finalizing', progress: 1})

        await waitFor(() => {
            expect(screen.getByText('Finalizing')).not.toBeNull()
            expect(screen.getByText('Finalizing').className).toContain('blinking')
            expect(document.querySelector('.video-recorder-indicator.finalizing')).not.toBeNull()
            expect(document.querySelector('.video-recorder-indicator')?.dataset.animation).toBe('beat-fade')
        })
    })

    it('keeps HQ export in Recording while the video store is finalizing', () => {
        globalThis.lgs.stores.ui.video.finalizing = true
        startReplayRecordingMonitor({mode: 'hq'})
        updateReplayRecordingMonitor({phase: 'encoding', progress: 0.4})

        render(<ReplayRecordingMonitorWidget/>)

        expect(screen.getByText('Recording')).not.toBeNull()
        expect(screen.queryByText('Finalizing')).toBeNull()
        expect(document.querySelector('.video-recorder-indicator.recording')).not.toBeNull()
    })

    it('calculates Draft duration and progress from recorder elapsed time', () => {
        startReplayRecordingMonitor({
            mode: 'draft',
            videoDurationMillis: 10000,
        })
        updateReplayRecordingMonitor({
            progress: 0.9,
            elapsedMillis: 1250,
        })

        render(<ReplayRecordingMonitorWidget/>)

        expect(screen.getByText('00:01 / 00:10')).not.toBeNull()
        expect(screen.getByText('00:08')).not.toBeNull()
        expect(screen.getByRole('progressbar', {name: 'Recording progress: 13%'})
            .getAttribute('aria-valuenow')).toBe('13')
        expect(screen.queryByTitle('Processed frames')).toBeNull()
    })

    it('closes Picture-in-Picture on cancellation', async () => {
        const abortExport = vi.fn()
        const exitPictureInPicture = vi.fn().mockResolvedValue(undefined)
        globalThis.lgs.stores.replay.deferredExportPlan = {runtime: {abortExport}}
        document.exitPictureInPicture = exitPictureInPicture
        startReplayRecordingMonitor({mode: 'hq'})

        render(<ReplayRecordingMonitorWidget/>)
        const monitorVideo = document.querySelector('.replay-recording-monitor video')
        document.pictureInPictureElement = monitorVideo

        fireEvent.click(screen.getByRole('button', {name: 'Cancel recording'}))

        await waitFor(() => expect(exitPictureInPicture).toHaveBeenCalledTimes(1))
        expect(abortExport).toHaveBeenCalledTimes(1)
    })

    it('requests widget expansion when returning from Picture-in-Picture', async () => {
        enablePictureInPicture()
        startReplayRecordingMonitor({mode: 'hq'})
        render(<ReplayRecordingMonitorWidget/>)
        const monitorVideo = document.querySelector('.replay-recording-monitor video')
        Object.defineProperty(monitorVideo, 'requestPictureInPicture', {
            configurable: true,
            value: vi.fn().mockResolvedValue(undefined),
        })

        fireEvent.click(screen.getByRole('button', {name: 'Open recording monitor in Picture-in-Picture'}))
        document.pictureInPictureElement = monitorVideo
        fireEvent(window, new Event('focus'))

        await waitFor(() => expect(widgetHarness.expandRequestKey).toBe(1))
    })
})
