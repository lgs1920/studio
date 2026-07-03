import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

vi.mock('@Components/MainUI/widgets/Widget', () => ({
    Widget: ({children}) => <div data-testid="widget">{children}</div>,
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaCard: ({children, ...props}) => <div {...props}>{children}</div>,
}))

import { JourneyReplayControlsWidget } from '@Components/JourneyReplay/JourneyReplayControlsWidget'

describe('JourneyReplayControlsWidget', () => {
    beforeEach(() => {
        globalThis.lgs = {
            settings: {
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
})
