/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: journey-toolbar-fix-path-visibility.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-19
 * Last modified: 2026-10-19
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { JourneyToolbarWidget } from '@Editor/JourneyToolbarWidget'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

vi.mock('@Components/MainUI/widgets/Widget', () => ({
    Widget: ({isVisible, children}) => (
        <div data-testid="journey-toolbar-widget" data-visible={String(isVisible)}>{children}</div>
    ),
}))

vi.mock('@Editor/JourneyToolbar', () => ({
    JourneyToolbar: () => <div data-testid="journey-toolbar-content"/>,
}))

vi.mock('@Core/ui/replay/JourneyReplayMode', () => ({
    REPLAY_JOURNEY_TOOLBAR_VISIBILITY_EVENT: 'replay-journey-toolbar-visibility',
}))

describe('JourneyToolbarWidget Fix Path visibility', () => {
    let replayToolbarHidden

    beforeEach(() => {
        replayToolbarHidden = false
        globalThis.__ = {
            ui: {
                replay: {
                    isJourneyToolbarTemporarilyHidden: vi.fn(() => replayToolbarHidden),
                },
            },
        }
        globalThis.lgs = {
            stores: {
                journeyEditor: proxy({fixPathEditorOpen: false}),
                main: {
                    components: {
                        journeyEditor: proxy({list: ['journey-1']}),
                    },
                },
                ui: {
                    video: proxy({
                        preRecording: false,
                        exporting: false,
                        recording: false,
                        snapshot: false,
                        finalizing: false,
                    }),
                },
            },
            settings: {
                ui: {
                    journeyToolbar: proxy({show: true}),
                    toolbars: {opacity: 1},
                },
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('hides the toolbar for the entire Fix Path session without changing its saved setting', async () => {
        const {getByTestId} = render(<JourneyToolbarWidget id="journey-toolbar-widget"/>)
        const toolbar = getByTestId('journey-toolbar-widget')

        expect(toolbar.getAttribute('data-visible')).toBe('true')
        expect(lgs.settings.ui.journeyToolbar.show).toBe(true)

        lgs.stores.journeyEditor.fixPathEditorOpen = true
        await waitFor(() => expect(toolbar.getAttribute('data-visible')).toBe('false'))
        expect(lgs.settings.ui.journeyToolbar.show).toBe(true)

        act(() => {
            replayToolbarHidden = true
            globalThis.window.dispatchEvent(new CustomEvent('replay-journey-toolbar-visibility', {
                detail: {hidden: true},
            }))
        })
        act(() => {
            replayToolbarHidden = false
            globalThis.window.dispatchEvent(new CustomEvent('replay-journey-toolbar-visibility', {
                detail: {hidden: false},
            }))
        })
        expect(toolbar.getAttribute('data-visible')).toBe('false')

        lgs.stores.journeyEditor.fixPathEditorOpen = false
        await waitFor(() => expect(toolbar.getAttribute('data-visible')).toBe('true'))
    })
})
