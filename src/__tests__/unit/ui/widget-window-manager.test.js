// @vitest-environment jsdom
/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: widget-window-manager.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-10
 * Last modified: 2026-09-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'
import { WidgetWindowManager } from '@Core/ui/widget-manager/WidgetWindowManager'

vi.mock('@Utils/UIToast', () => ({
    UIToast: {
        warning: vi.fn(),
    },
}))

describe('WidgetWindowManager', () => {
    const widgetId = 'replay-timeline-widget#1'
    let externalWindow
    let externalListeners
    let manager
    let config

    beforeEach(() => {
        globalThis.documentPictureInPicture = undefined
        externalListeners = new Map()
        externalWindow = {
            closed:         false,
            document:       document.implementation.createHTMLDocument('Widget window'),
            addEventListener: vi.fn((event, handler) => externalListeners.set(event, handler)),
            removeEventListener: vi.fn(event => externalListeners.delete(event)),
            close:           vi.fn(() => {
                externalWindow.closed = true
            }),
        }
        window.open = vi.fn(() => externalWindow)
        globalThis.lgs = {
            stores: {
                ui: {
                    widget: proxy({
                        list:     new Map(),
                        current:  {id: null},
                        undocked: {id: null, mode: null},
                        reattachSelection: {id: null, request: 0},
                    }),
                },
            },
        }
        config = {
            contextMenu: {canDetach: true},
            dimensions:  {width: 400, height: 200},
            height:      200,
            persist:     true,
            position:    {left: 42, top: 84},
            rotate:      12,
            scale:       {x: 1.2, y: 1.2},
            width:       400,
            widgetsBoard: 'scene',
        }
        globalThis.__ = {
            ui: {
                widgetManager: {
                    getWidgetConfig: vi.fn(() => config),
                    getElementById: vi.fn(() => ({
                        getBoundingClientRect: () => ({width: 620, height: 280}),
                    })),
                    setConfig:       vi.fn(),
                },
                widgetCache: {
                    get: vi.fn(() => ({group: 'scene-widgets'})),
                },
            },
        }
        manager = new WidgetWindowManager()
    })

    afterEach(() => {
        vi.restoreAllMocks()
        globalThis.documentPictureInPicture = undefined
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('opens one fallback window and restores the runtime layout on reattach', async () => {
        expect(await manager.detachWidget(widgetId)).toBe(true)
        expect(lgs.stores.ui.widget.undocked).toEqual({id: widgetId, mode: 'window'})
        const container = externalWindow.document.querySelector(`[data-widget-window="${widgetId}"]`)
        expect(container).not.toBeNull()
        expect(container.className).toBe('lgs-detached-window-container')
        expect(window.open).toHaveBeenCalledWith(
            '',
            'lgs1920-detached-widget',
            expect.stringContaining('width=620,height=280'),
        )
        expect(manager.canDetachWidget('other-widget#2')).toBe(false)

        config.width = 980
        config.height = 700
        config.dimensions = {width: 980, height: 700}
        lgs.stores.ui.widget.current = {id: 'profile-widget#1'}
        await manager.reattachWidget()
        await new Promise(resolve => window.requestAnimationFrame(resolve))
        await new Promise(resolve => window.requestAnimationFrame(resolve))

        expect(lgs.stores.ui.widget.undocked).toEqual({id: null, mode: null})
        expect(__.ui.widgetManager.getWidgetConfig(widgetId).position).toEqual({left: 42, top: 84})
        expect(__.ui.widgetManager.getWidgetConfig(widgetId).width).toBe(400)
        expect(__.ui.widgetManager.getWidgetConfig(widgetId).height).toBe(200)
        expect(__.ui.widgetManager.getWidgetConfig(widgetId).dimensions).toEqual({width: 400, height: 200})
        expect(lgs.stores.ui.widget.current).toMatchObject({id: widgetId, rotate: 12})
        expect(lgs.stores.ui.widget.reattachSelection).toMatchObject({id: widgetId, request: 1})
        expect(externalWindow.close).toHaveBeenCalled()
    })

    it('uses the widget dimensions when detaching from the dock', async () => {
        expect(await manager.detachWidget(widgetId, {useConfigDimensions: true})).toBe(true)

        expect(window.open).toHaveBeenCalledWith(
            '',
            'lgs1920-detached-widget',
            expect.stringContaining('width=480,height=240'),
        )

        await manager.reattachWidget()
    })

    it('uses dimensions captured before the widget entered the dock', async () => {
        expect(await manager.detachWidget(widgetId, {
            dimensions:          {width: 510, height: 270},
            useConfigDimensions: true,
        })).toBe(true)

        expect(window.open).toHaveBeenCalledWith(
            '',
            'lgs1920-detached-widget',
            expect.stringContaining('width=510,height=270'),
        )

        await manager.reattachWidget()
    })

    it('attaches the detached widget to the bottom drawer', async () => {
        config.contextMenu.canDockable = true

        expect(await manager.detachWidget(widgetId)).toBe(true)
        expect(await manager.attachWidgetToDrawer()).toBe(true)

        expect(lgs.stores.ui.widget.undocked).toEqual({id: null, mode: null})
        expect(lgs.stores.ui.widget.docked).toMatchObject({id: widgetId, size: 320})
        expect(externalWindow.close).toHaveBeenCalled()
    })

    it('does not detach widgets without the capability or mandatory widgets', () => {
        __.ui.widgetManager.getWidgetConfig.mockReturnValue({mandatory: true, contextMenu: {canDetach: true}})

        expect(manager.canDetachWidget(widgetId)).toBe(false)
        expect(window.open).not.toHaveBeenCalled()
    })

    it('reattaches automatically when the external window closes', async () => {
        expect(await manager.detachWidget(widgetId)).toBe(true)

        externalListeners.get('pagehide')()
        await Promise.resolve()

        expect(lgs.stores.ui.widget.undocked).toEqual({id: null, mode: null})
        expect(__.ui.widgetManager.getWidgetConfig(widgetId).position).toEqual({left: 42, top: 84})
    })

    it('prefers the Document Picture-in-Picture window when available', async () => {
        globalThis.documentPictureInPicture = {
            requestWindow: vi.fn(() => Promise.resolve(externalWindow)),
        }

        expect(await manager.detachWidget(widgetId)).toBe(true)
        expect(globalThis.documentPictureInPicture.requestWindow).toHaveBeenCalledWith({height: 280, width: 620})
        expect(lgs.stores.ui.widget.undocked.mode).toBe('pip')

        await manager.reattachWidget()
    })
})
