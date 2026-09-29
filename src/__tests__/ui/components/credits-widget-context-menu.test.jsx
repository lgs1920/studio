// @vitest-environment jsdom
/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: credits-widget-context-menu.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-29
 * Last modified: 2026-09-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {cleanup, render, screen} from '@testing-library/react'
import {VIDEO_WIDGETS_BOARD} from '@Core/constants'
import {proxy} from 'valtio'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('@Components/MainUI/credits/CreditsBar', () => ({
    CreditsBar: () => null,
}))

vi.mock('@Components/MainUI/widgets/Widget', () => ({
    Widget: ({children, config}) => (
        <div data-context-menu-enabled={String(config.contextMenuEnabled)} data-testid="credits-widget">
            {children}
        </div>
    ),
}))

import {CreditsWidget} from '@Components/MainUI/widgets/list/CreditsWidget'

describe('CreditsWidget context menu', () => {
    beforeEach(() => {
        globalThis.lgs = {
            gutter: {xs: 5},
            stores: {
                replay: proxy({simplePreparationActive: true}),
                ui: {
                    video: proxy({
                        editing:      true,
                        finalizing:   false,
                        preRecording: false,
                        recordingHQ:  false,
                        snapshot:     false,
                    }),
                },
            },
        }
        globalThis.__ = {
            ui: {
                widgetManager: {
                    resolveWidgetsBoardContainer: vi.fn(() => document.createElement('div')),
                },
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('disables the menu during Simple Replay', () => {
        render(
            <CreditsWidget
                context={proxy({widgetEditor: false, widgetsBoard: VIDEO_WIDGETS_BOARD})}
                id="credits-widget#video"
            />,
        )

        expect(screen.getByTestId('credits-widget').dataset.contextMenuEnabled).toBe('false')
    })

    it('keeps the menu enabled in Expert Replay', () => {
        lgs.stores.replay.simplePreparationActive = false

        render(
            <CreditsWidget
                context={proxy({widgetEditor: false, widgetsBoard: VIDEO_WIDGETS_BOARD})}
                id="credits-widget#video"
            />,
        )

        expect(screen.getByTestId('credits-widget').dataset.contextMenuEnabled).toBe('true')
    })
})
