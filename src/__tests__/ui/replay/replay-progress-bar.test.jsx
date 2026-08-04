import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, ...props}) => <button type="button" {...props}>{children}</button>,
    WaIcon: ({name}) => <span data-icon={name}/>,
    WaTooltip: ({children}) => <span>{children}</span>,
}))

import { JourneyReplayProgressBar } from '@Components/JourneyReplay/JourneyReplayProgressBar'

describe('JourneyReplayProgressBar', () => {
    beforeEach(() => {
        globalThis.__ = {
            ui: {
                drawerManager: {
                    close: vi.fn(),
                    open: vi.fn(),
                },
            },
        }

        globalThis.lgs = {
            settings: {
                unitSystem: proxy({current: 0}),
            },
            stores: {
                replay: proxy({
                    active: false,
                    playing: false,
                    paused: false,
                    mainUiHidden: false,
                    clipSequenceActive: false,
                    progress: 0,
                    sample: null,
                    totalDistance: 0,
                    direction: 1,
                    elapsedMillis: null,
                    durationMillis: null,
                    recordingSync: false,
                }),
                ui: proxy({
                    drawers: proxy({
                        open: null,
                    }),
                    video: proxy({recording: false}),
                }),
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('shows the settings button when the replay is idle', () => {
        render(<JourneyReplayProgressBar showSettings/>)

        expect(screen.getByRole('button', {name: 'Journey Replay settings'})).not.toBeNull()
    })

    it('hides the settings button while the main UI is hidden for replay clips', () => {
        globalThis.lgs.stores.replay.mainUiHidden = true

        render(<JourneyReplayProgressBar showSettings/>)

        expect(screen.queryByRole('button', {name: 'Journey Replay settings'})).toBeNull()
    })

    it('keeps the pause action visible until the clip sequence fully ends', () => {
        globalThis.lgs.stores.replay.clipSequenceActive = true

        render(<JourneyReplayProgressBar/>)

        expect(screen.getByRole('button', {name: 'Pause Journey Replay'})).not.toBeNull()
        expect(screen.queryByRole('button', {name: 'Start Journey Replay'})).toBeNull()
    })

    it('disables the replay actions when requested', () => {
        globalThis.lgs.stores.replay.active = true
        globalThis.lgs.stores.replay.playing = true
        globalThis.lgs.stores.replay.sample = {
            progress: 0.4,
            distanceFromStart: 4,
            remainingDistance: 6,
        }

        render(<JourneyReplayProgressBar disabled showSettings/>)

        expect(screen.getByRole('button', {name: 'Pause Journey Replay'}).disabled).toBe(true)
        expect(screen.getByRole('button', {name: 'Stop Journey Replay'}).disabled).toBe(true)
        expect(screen.getByRole('button', {name: 'Journey Replay settings'}).disabled).toBe(true)
    })

    it('uses Draft frame progress instead of distance progress', () => {
        globalThis.lgs.stores.replay.recordingSync = true
        globalThis.lgs.stores.replay.active = true
        globalThis.lgs.stores.replay.playing = true
        globalThis.lgs.stores.replay.sample = {
            progress:          0.2,
            distanceFromStart: 20,
            remainingDistance: 80,
        }
        globalThis.lgs.stores.replay.totalDistance = 100
        globalThis.lgs.stores.replay.dynamicFrameState = {
            replayFrameIndex: 50,
            replayFrameCount: 101,
            elapsedMillis:    50000,
            durationMillis:   100000,
        }

        render(<JourneyReplayProgressBar/>)

        expect(screen.getByText('50%')).not.toBeNull()
        expect(screen.queryByText('20%')).toBeNull()
    })

    it('can show compact export progress without journey distance', () => {
        render(
            <JourneyReplayProgressBar
                showActions={false}
                showDistance={false}
                progressOverride={0.25}
                timeLabelOverride="00:42"
            />,
        )

        expect(screen.getByText('00:42')).not.toBeNull()
        expect(screen.getByText('25%')).not.toBeNull()
        expect(screen.queryByText(/km/)).toBeNull()
    })

    it('keeps the snapshot action visible when playback actions are hidden', () => {
        render(<JourneyReplayProgressBar showActions={false} showSnapshot/>)

        expect(screen.getByRole('button', {name: 'Take replay snapshot'})).not.toBeNull()
    })

})
