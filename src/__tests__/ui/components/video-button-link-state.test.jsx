import { cleanup, render } from '@testing-library/react'
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
    WaIcon: () => null,
    WaTooltip: () => null,
}))

import { VideoButton } from '@Components/MainUI/video/VideoButton'

describe('VideoButton replay link state', () => {
    beforeEach(() => {
        globalThis.lgs = {
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
        globalThis.lgs = undefined
    })

    it('switches from brand to warning when replay becomes linked', () => {
        const {container, rerender} = render(<VideoButton appearance="filled"/>)

        expect(container.querySelector('button').dataset.variant).toBe('brand')

        lgs.stores.replay.recordingSync = true
        rerender(<VideoButton appearance="filled"/>)

        expect(container.querySelector('button').dataset.variant).toBe('warning')
    })
})
