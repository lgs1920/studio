// @vitest-environment jsdom
/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: context-menu-renderer-video-state.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-22
 * Last modified: 2026-08-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

vi.mock('@Components/MainUI/context-menu/MapPointContextMenu', () => ({
    MapPointContextMenu: ({hideVideoActions}) => (
        <div data-testid="map-point-context-menu" data-hide-video-actions={String(hideVideoActions)}/>
    ),
}))

vi.mock('@Components/MainUI/MapPOI/MapPOIContextMenu', () => ({
    MapPOIContextMenu: () => <div data-testid="poi-context-menu"/>,
}))

vi.mock('@Components/MainUI/widgets/WidgetContextMenu', () => ({
    WidgetContextMenu: () => <div data-testid="widget-context-menu"/>,
}))

import { ContextMenuRenderer } from '@Components/MainUI/context-menu/ContextMenuRenderer'
import { REPLAY_RECORDING_MONITOR_WIDGET_ID } from '@Core/constants'

describe('ContextMenuRenderer video state', () => {
    let hideContextMenu

    beforeEach(() => {
        hideContextMenu = vi.fn()
        globalThis.__ = {
            ui: {
                contextMenu: {
                    hide: hideContextMenu,
                },
            },
        }
        globalThis.lgs = {
            stores: {
                replay: proxy({recordingSync: false}),
                ui: proxy({
                    contextMenu: proxy({
                        type:     'map-point',
                        visible:  true,
                        position: {x: 10, y: 20},
                        targetId: {},
                    }),
                    video: proxy({
                        editing:      false,
                        preRecording: false,
                        recording:    false,
                        recordingHQ:  false,
                        snapshot:     false,
                        finalizing:   false,
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

    it('hides map-point actions during video preparation', () => {
        globalThis.lgs.stores.ui.video.editing = true

        render(<ContextMenuRenderer/>)

        expect(screen.getByTestId('map-point-context-menu').dataset.hideVideoActions).toBe('true')
    })

    it('does not render a context menu during synchronized recording', () => {
        globalThis.lgs.stores.ui.video.recording = true
        globalThis.lgs.stores.replay.recordingSync = true

        render(<ContextMenuRenderer/>)

        expect(screen.queryByTestId('map-point-context-menu')).toBeNull()
        expect(hideContextMenu).toHaveBeenCalledOnce()
    })

    it('does not render a context menu during synchronized HQ recording', () => {
        globalThis.lgs.stores.ui.video.recordingHQ = true
        globalThis.lgs.stores.replay.recordingSync = true

        render(<ContextMenuRenderer/>)

        expect(screen.queryByTestId('map-point-context-menu')).toBeNull()
        expect(hideContextMenu).toHaveBeenCalledOnce()
    })

    it('keeps the full context menu available during non-synchronized recording', () => {
        globalThis.lgs.stores.ui.video.recording = true

        render(<ContextMenuRenderer/>)

        expect(screen.getByTestId('map-point-context-menu').dataset.hideVideoActions).toBe('false')
        expect(hideContextMenu).not.toHaveBeenCalled()
    })

    it('keeps the replay monitor context menu available during synchronized recording', () => {
        globalThis.lgs.stores.ui.video.recordingHQ = true
        globalThis.lgs.stores.replay.recordingSync = true
        globalThis.lgs.stores.ui.contextMenu.type = 'widget'
        globalThis.lgs.stores.ui.contextMenu.targetId = REPLAY_RECORDING_MONITOR_WIDGET_ID

        render(<ContextMenuRenderer/>)

        expect(screen.getByTestId('widget-context-menu')).not.toBeNull()
        expect(hideContextMenu).not.toHaveBeenCalled()
    })

    it('keeps the replay monitor context menu available when the Main UI is hidden', () => {
        globalThis.lgs.stores.replay.mainUiHidden = true
        globalThis.lgs.stores.ui.contextMenu.type = 'widget'
        globalThis.lgs.stores.ui.contextMenu.targetId = REPLAY_RECORDING_MONITOR_WIDGET_ID

        render(<ContextMenuRenderer/>)

        expect(screen.getByTestId('widget-context-menu')).not.toBeNull()
        expect(hideContextMenu).not.toHaveBeenCalled()
    })
})
