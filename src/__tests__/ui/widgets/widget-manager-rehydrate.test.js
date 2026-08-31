/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: widget-manager-rehydrate.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-25
 * Last modified: 2026-08-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VIDEO_WIDGETS_BOARD } from '@Core/constants'

vi.mock('@Utils/UIToast', () => ({
    UIToast: {
        error:   vi.fn(),
        warning: vi.fn(),
    },
}))

import { WidgetManager } from '@Core/ui/widget-manager/WidgetManager'

describe('WidgetManager video widget rehydration', () => {
    let manager
    let board
    let widget
    let config
    let widgetCache

    beforeEach(() => {
        board = document.createElement('div')
        board.getBoundingClientRect = vi.fn(() => ({
            left: 0,
            top: 0,
            width: 600,
            height: 400,
            right: 600,
            bottom: 400,
        }))
        document.body.appendChild(board)

        widget = document.createElement('div')
        widget.setAttribute('data-widget-id', 'credits-widget#video')
        document.body.appendChild(widget)

        config = {
            id:          'credits-widget#video',
            canHide:     true,
            dimensions:  {width: 200, height: 100},
            element:     null,
            isCropper:   false,
            position:    {left: 0, top: 0},
            scale:       {x: 1, y: 1},
            widgetsBoard: VIDEO_WIDGETS_BOARD,
        }

        globalThis.lgs = {
            gutter: {
                xs: 5,
            },
            stores: {
                ui: {
                    widget: {
                        list: new Map([[config.id, {widgetsBoard: VIDEO_WIDGETS_BOARD}]]),
                    },
                },
            },
        }
        widgetCache = {mount: vi.fn()}
        globalThis.__ = {ui: {widgetCache}}
        manager = new WidgetManager()
        manager.resolveWidgetsBoardReferenceContainer = vi.fn(() => board)
        manager.getWidgetConfig = vi.fn(() => config)
        manager.getElementById = vi.fn(() => widget)
        manager.getWidgetPosition = vi.fn(async () => ({
            leftRatio: 50,
            topRatio: 50,
            width:      200,
            height:     100,
            scale:      {x: 1.65, y: 1.65},
        }))
        manager.getMoveable = vi.fn(() => ({current: {updateRect: vi.fn()}}))
        manager.setScale = vi.fn()
        manager.repositionWidgetsForBoard = vi.fn()
    })

    it('restores the persisted scale instead of falling back to the initial dimensions', async () => {
        await manager.rehydrateWidgetsByBoard(VIDEO_WIDGETS_BOARD)

        expect(config.dimensions).toEqual({width: 200, height: 100})
        expect(config.scale).toEqual({x: 1.65, y: 1.65})
        expect(config.element).toBe(widget)
        expect(widget.style.width).toBe('200px')
        expect(widget.style.height).toBe('100px')
        expect(manager.setScale).toHaveBeenCalledWith(widget, 1.65, 1.65)
        expect(widgetCache.mount).toHaveBeenCalledWith(config.id)
    })

    it('persists a top-to-bottom video widget order as descending z-index values', async () => {
        const topWidget = 'dynamic-stats-widget'
        const bottomWidget = 'journey-stats-widget'
        lgs.stores.ui.widget.list = new Map([
            [topWidget, {widgetsBoard: VIDEO_WIDGETS_BOARD, zIndex: 4000}],
            [bottomWidget, {widgetsBoard: VIDEO_WIDGETS_BOARD, zIndex: 4001}],
        ])
        manager.getWidgetPosition = vi.fn(async () => ({left: 0, top: 0, width: 100, height: 50}))
        manager.saveWidgetPosition = vi.fn(async () => undefined)

        await manager.reorderWidgets([bottomWidget, topWidget])

        expect(lgs.stores.ui.widget.list.get(bottomWidget).zIndex).toBe(4001)
        expect(lgs.stores.ui.widget.list.get(topWidget).zIndex).toBe(4000)
        expect(manager.saveWidgetPosition).toHaveBeenCalledTimes(2)
    })

    it('toggles user visibility without changing video board isolation classes', () => {
        const widgetId = config.id

        expect(manager.toggleWidgetVisibility(widgetId)).toBe(false)
        expect(lgs.stores.ui.widget.list.get(widgetId).visible).toBe(false)
        expect(widget.classList.contains('lgs-widget-user-hidden')).toBe(true)
        expect(widget.classList.contains('lgs-widget-hidden')).toBe(false)

        expect(manager.toggleWidgetVisibility(widgetId)).toBe(true)
        expect(lgs.stores.ui.widget.list.get(widgetId).visible).toBe(true)
        expect(widget.classList.contains('lgs-widget-user-hidden')).toBe(false)
    })
})
