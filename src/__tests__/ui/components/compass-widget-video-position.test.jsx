// @vitest-environment jsdom
/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: compass-widget-video-position.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-27
 * Last modified: 2026-09-27
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {proxy} from 'valtio'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {render, screen, cleanup} from '@testing-library/react'

vi.mock('@Components/MainUI/compass/Compass', () => ({
    Compass: () => <div data-testid="compass"/>,
}))

vi.mock('@Components/MainUI/widgets/Widget', () => ({
    Widget: ({children, config}) => (
        <div
            data-attach-to={config.attachTo}
            data-can-position={String(config.contextMenu.canPosition)}
            data-testid="widget"
        >
            {children}
        </div>
    ),
}))

vi.mock('@Utils/ValtioUtils', () => ({
    useOptionalSnapshot: value => value ?? {widgetEditor: false, widgetsBoard: ''},
}))

import {CompassWidget} from '@Components/Compass/CompassWidget'

describe('CompassWidget video placement', () => {
    beforeEach(() => {
        globalThis.lgs = {
            stores: {
                ui: {
                    video: proxy({
                        editing:      true,
                        finalizing:   false,
                        preRecording: false,
                        recording:    false,
                        recordingHQ:  false,
                        snapshot:     false,
                    }),
                },
            },
            gutter: {xs: 5},
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

    it('locks the compass to the top-right of the video crop board', () => {
        render(
            <CompassWidget
                context={{widgetEditor: true, widgetsBoard: 'video-crop-zone'}}
                id="compass-widget"
            />,
        )

        const widget = screen.getByTestId('widget')
        expect(widget.getAttribute('data-attach-to')).toBe('top-right')
        expect(widget.getAttribute('data-can-position')).toBe('false')
    })
})
