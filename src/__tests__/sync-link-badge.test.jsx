/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: sync-link-badge.test.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-03
 * Last modified on: 2026-07-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, onClick, variant, appearance, ...props}) => (
        <button
            type="button"
            onClick={onClick}
            data-variant={variant}
            data-appearance={appearance}
            {...props}
        >
            {children}
        </button>
    ),
    WaIcon: ({name}) => <span data-testid="icon" data-name={name}/>,
    WaTooltip: () => null,
}))

import { SyncLinkBadge } from '@Components/MainUI/SyncLinkBadge'

describe('SyncLinkBadge', () => {
    let arm
    let disarm
    let isArmed
    let armed

    beforeEach(() => {
        armed = false
        arm = vi.fn()
        disarm = vi.fn()
        isArmed = vi.fn(() => armed)
        globalThis.__ = {
            ui: {
                replayVideoSync: {
                    arm,
                    disarm,
                    isArmed,
                },
            },
        }
        globalThis.lgs = {
            stores: {
                ui: {
                    video: proxy({recording: false, preRecording: false, snapshot: false}),
                },
                replay: proxy({recordingSync: false}),
            },
            settings: {
                ui: {
                    replay: proxy({recordingSync: false}),
                },
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('renders as a permanent toggle and switches link state', () => {
        const parentClick = vi.fn()
        const {container, rerender} = render(
            <div onClick={parentClick}>
                <SyncLinkBadge visible className="sync-linked-actions-badge"/>
            </div>,
        )
        const button = container.querySelector('button')

        expect(button).toBeTruthy()
        expect(container.querySelector('[data-testid="icon"]').dataset.name).toBe('link-simple-slash')
        expect(button.dataset.variant).toBe('warning')
        expect(button.dataset.appearance).toBe('filled-outlined')

        fireEvent.click(button)
        expect(arm).toHaveBeenCalledTimes(1)
        expect(parentClick).not.toHaveBeenCalled()

        lgs.stores.replay.recordingSync = true
        lgs.settings.ui.replay.recordingSync = true
        rerender(
            <div onClick={parentClick}>
                <SyncLinkBadge visible className="sync-linked-actions-badge"/>
            </div>,
        )

        expect(container.querySelector('[data-testid="icon"]').dataset.name).toBe('link-simple')
        expect(container.querySelector('button').dataset.variant).toBe('brand')
        expect(container.querySelector('button').dataset.appearance).toBe('filled')

        fireEvent.click(container.querySelector('button'))
        expect(disarm).toHaveBeenCalledTimes(1)
        expect(parentClick).not.toHaveBeenCalled()
    })

    it('arms the bridge when persisted sync is already enabled at mount', async () => {
        lgs.stores.replay.recordingSync = true
        lgs.settings.ui.replay.recordingSync = true
        armed = false

        render(<SyncLinkBadge visible/>)

        await waitFor(() => {
            expect(arm).toHaveBeenCalledTimes(1)
        })
    })
})
