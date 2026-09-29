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
 * Last modified: 2026-09-29
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
            data-can-edit={String(config.contextMenu.canEdit)}
            data-can-hide={String(config.canHide)}
            data-can-lock={String(config.canLock)}
            data-can-position={String(config.contextMenu.canPosition)}
            data-can-remove={String(config.contextMenu.canRemove)}
            data-can-reset={String(config.contextMenu.canReset)}
            data-draggable={String(config.draggable)}
            data-margin={config.margin}
            data-position-key={config.positionKey}
            data-resizable={String(config.resizable)}
            data-scalable={String(config.scalable)}
            data-snappable={String(config.snappable)}
            data-show-control-box={String(config.showControlBox)}
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
                replay: proxy({simplePreparationActive: true}),
                ui: {
                    video: proxy({
                        editing:      false,
                        finalizing:   false,
                        preRecording: false,
                        recording:    false,
                        recordingHQ:  false,
                        snapshot:     false,
                    }),
                },
            },
            gutter: {s: 8, xs: 5},
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

    it('renders the mandatory Replay compass when editor and capture flags are inactive', () => {
        render(
            <CompassWidget
                context={{widgetEditor: false, widgetsBoard: 'video-crop-zone'}}
                id="compass-widget"
            />,
        )

        const widget = screen.getByTestId('widget')
        expect(widget.getAttribute('data-attach-to')).toBe('top-left')
        expect(widget.getAttribute('data-can-edit')).toBe('true')
        expect(widget.getAttribute('data-can-hide')).toBe('false')
        expect(widget.getAttribute('data-can-lock')).toBe('false')
        expect(widget.getAttribute('data-can-position')).toBe('false')
        expect(widget.getAttribute('data-can-remove')).toBe('false')
        expect(widget.getAttribute('data-can-reset')).toBe('false')
        expect(widget.getAttribute('data-draggable')).toBe('false')
        expect(widget.getAttribute('data-margin')).toBe('8')
        expect(widget.getAttribute('data-position-key')).toBe('video-crop-top-left-v2')
        expect(widget.getAttribute('data-resizable')).toBe('false')
        expect(widget.getAttribute('data-scalable')).toBe('false')
        expect(widget.getAttribute('data-snappable')).toBe('false')
        expect(widget.getAttribute('data-show-control-box')).toBe('false')
    })

    it('disables Compass interactions on the scene board during Simple Replay', () => {
        render(
            <CompassWidget
                context={{widgetEditor: true, widgetsBoard: 'scene-widgets'}}
                id="compass-widget"
            />,
        )

        const widget = screen.getByTestId('widget')
        expect(widget.getAttribute('data-can-edit')).toBe('true')
        expect(widget.getAttribute('data-can-hide')).toBe('false')
        expect(widget.getAttribute('data-can-lock')).toBe('false')
        expect(widget.getAttribute('data-can-position')).toBe('false')
        expect(widget.getAttribute('data-can-remove')).toBe('false')
        expect(widget.getAttribute('data-can-reset')).toBe('false')
        expect(widget.getAttribute('data-draggable')).toBe('false')
        expect(widget.getAttribute('data-resizable')).toBe('false')
        expect(widget.getAttribute('data-scalable')).toBe('false')
        expect(widget.getAttribute('data-snappable')).toBe('false')
    })

    it('allows removing the optional Compass in Expert Replay', () => {
        globalThis.lgs.stores.replay.simplePreparationActive = false

        render(
            <CompassWidget
                context={{widgetEditor: false, widgetsBoard: 'video-crop-zone'}}
                id="compass-widget#video"
            />,
        )

        const widget = screen.getByTestId('widget')
        expect(widget.getAttribute('data-can-remove')).toBe('true')
        expect(widget.getAttribute('data-can-edit')).toBe('true')
        expect(widget.getAttribute('data-can-hide')).toBe('true')
        expect(widget.getAttribute('data-can-lock')).toBe('true')
        expect(widget.getAttribute('data-can-reset')).toBe('true')
    })
})
