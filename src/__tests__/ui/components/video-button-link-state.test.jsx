/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: video-button-link-state.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-21
 * Last modified: 2026-08-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, variant, appearance, ...props}) => (
        <button
            type="button"
            data-variant={variant}
            data-appearance={appearance}
            {...props}
        >
            {children}
        </button>
    ),
    WaIcon: ({name}) => <span data-icon={name}/>,
    WaTooltip: () => null,
}))

import { VideoButton } from '@Components/MainUI/video/VideoButton'

describe('VideoButton standard video entry point', () => {
    beforeEach(() => {
        globalThis.__ = {
            ui: {
                replayVideoSync: {
                    disarm: vi.fn(),
                },
                replay: {
                    prepareReplayCamera: vi.fn(async () => true),
                },
            },
        }
        globalThis.lgs = {
            theJourney: {slug: 'journey-a'},
            stores: {
                ui: {
                    video: proxy({
                        editing: false,
                        recording: false,
                        preRecording: false,
                        snapshot: false,
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

    it('keeps the standard video entry point on the brand variant', () => {
        const {container, rerender} = render(<VideoButton appearance="filled"/>)

        expect(container.querySelector('button').dataset.variant).toBe('brand')

        lgs.stores.replay.recordingSync = true
        rerender(<VideoButton appearance="filled"/>)

        expect(container.querySelector('button').dataset.variant).toBe('brand')
    })

    it('does not prepare or link Replay when opening standard video preparation', async () => {
        const {container} = render(<VideoButton appearance="filled"/>)

        fireEvent.click(container.querySelector('button'))

        await waitFor(() => expect(globalThis.lgs.stores.ui.video.editing).toBe(true))
        expect(globalThis.__.ui.replay.prepareReplayCamera).not.toHaveBeenCalled()
        expect(globalThis.__.ui.replayVideoSync.disarm).toHaveBeenCalledTimes(1)
        expect(globalThis.lgs.stores.ui.video.editing).toBe(true)
    })

    it('uses the video icon for the standard entry point', () => {
        const {container} = render(<VideoButton appearance="filled"/>)

        expect(container.querySelector('[data-icon="video"]')).not.toBeNull()
    })
})
