// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

vi.mock('@Core/constants', () => ({
    CURRENT_MAP_POINT: 'CURRENT_MAP_POINT',
}))

import { MapPointContextMenuTrigger } from '@Components/MainUI/context-menu/MapPointContextMenuTrigger'

describe('MapPointContextMenuTrigger', () => {
    let canvasEvents
    let hideContextMenu

    beforeEach(() => {
        canvasEvents = {
            onLongTap:      vi.fn(),
            onRightClick:   vi.fn(),
            offLongTap:     vi.fn(),
            offRightClick:  vi.fn(),
        }
        hideContextMenu = vi.fn()
        globalThis.__ = {
            canvasEvents,
            ui: {
                contextMenu: {hide: hideContextMenu},
            },
        }
        globalThis.lgs = {
            stores: {
                ui: {
                    contextMenu: proxy({type: null, visible: false}),
                    video:       proxy({
                        editing:     false,
                        preRecording: false,
                        recording:   false,
                        snapshot:    false,
                        finalizing:  false,
                    }),
                },
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('registers the Cesium context actions outside video preparation', () => {
        render(<MapPointContextMenuTrigger/>)

        expect(canvasEvents.onRightClick).toHaveBeenCalledOnce()
        expect(canvasEvents.onLongTap).toHaveBeenCalledOnce()
    })

    it('keeps Cesium context actions available during video preparation', () => {
        globalThis.lgs.stores.ui.video.editing = true

        render(<MapPointContextMenuTrigger/>)

        expect(canvasEvents.onRightClick).toHaveBeenCalledOnce()
        expect(canvasEvents.onLongTap).toHaveBeenCalledOnce()
        expect(hideContextMenu).not.toHaveBeenCalled()
    })
})
