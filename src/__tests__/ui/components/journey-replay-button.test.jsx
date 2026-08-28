import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, ...props}) => <button type="button" {...props}>{children}</button>,
    WaIcon: ({name}) => <span data-icon={name}/>,
    WaTooltip: ({children}) => <span>{children}</span>,
}))

import {JourneyReplayButton} from '@Components/JourneyReplay/JourneyReplayButton'

describe('JourneyReplayButton synchronized video entry point', () => {
    beforeEach(() => {
        globalThis.__ = {
            ui: {
                drawerManager: {
                    isCurrent: vi.fn(() => false),
                    open: vi.fn(),
                },
                replayVideoSync: {
                    arm: vi.fn(),
                },
            },
        }
        globalThis.lgs = {
            theJourney: {slug: 'journey-a'},
            stores: {
                ui: {
                    video: proxy({
                        recording: false,
                        preRecording: false,
                        snapshot: false,
                        editing: false,
                    }),
                },
                replay: proxy({recordingSync: false}),
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('arms synchronization and opens video editing from a selected journey', () => {
        render(
            <JourneyReplayButton
                id="launch-the-replay-video"
                tooltipText="Record a synchronized Replay video"
                ariaLabel="Record a synchronized Replay video"
                onClick={() => {
                    __.ui.replayVideoSync.arm({autoStopRecording: true, resetToStart: true})
                    lgs.stores.ui.video.editing = true
                }}
            />,
        )

        fireEvent.click(screen.getByRole('button', {name: 'Record a synchronized Replay video'}))

        expect(globalThis.__.ui.replayVideoSync.arm).toHaveBeenCalledWith({
            autoStopRecording: true,
            resetToStart: true,
        })
        expect(globalThis.lgs.stores.ui.video.editing).toBe(true)
        expect(globalThis.__.ui.drawerManager.open).not.toHaveBeenCalled()
        expect(screen.getByRole('button').querySelector('[data-icon="drone"]')).not.toBeNull()
    })
})
