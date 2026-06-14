import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, ...props}) => <button type="button" {...props}>{children}</button>,
    WaIcon: ({name}) => <span data-icon={name}/>,
    WaTooltip: ({children}) => <span>{children}</span>,
}))

import { FlythroughProgressBar } from '@Components/Flythrough/FlythroughProgressBar'

describe('FlythroughProgressBar', () => {
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
                flythrough: proxy({
                    active: false,
                    playing: false,
                    paused: false,
                    mainUiHidden: false,
                    progress: 0,
                    sample: null,
                    totalDistance: 0,
                    direction: 1,
                    elapsedMillis: null,
                    durationMillis: null,
                }),
                ui: proxy({
                    drawers: proxy({
                        open: null,
                    }),
                }),
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('shows the settings button when the flythrough is idle', () => {
        render(<FlythroughProgressBar showSettings/>)

        expect(screen.getByRole('button', {name: 'Flythrough settings'})).not.toBeNull()
    })

    it('hides the settings button while the main UI is hidden for flythrough clips', () => {
        globalThis.lgs.stores.flythrough.mainUiHidden = true

        render(<FlythroughProgressBar showSettings/>)

        expect(screen.queryByRole('button', {name: 'Flythrough settings'})).toBeNull()
    })
})
