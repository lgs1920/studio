/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: widget-dock-manager.test.js
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

import {
    canDockWidget,
    dockWidget,
    getDockedWidgetDimensions,
    getDockedWidgetMaxSize,
    hydrateDockedWidget,
    normalizeDockSize,
    setDockSize,
    undockWidget,
} from '@Core/ui/widget-manager/WidgetDockManager'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'

describe('WidgetDockManager', () => {
    const timelineId = 'replay-timeline-widget#1'

    beforeEach(() => {
        Object.defineProperty(window, 'innerHeight', {configurable: true, value: 800})
        globalThis.lgs = {
            settings: proxy({ui: {widgets: {dock: {id: null, size: 320}}}}),
            stores: {
                ui: {
                    widget: proxy({
                        current: {id: timelineId},
                        docked:  {id: null, size: 320},
                    }),
                },
            },
        }
        globalThis.__ = {
            ui: {
                widgetManager: {
                    getWidgetConfig: vi.fn(() => ({
                        contextMenu: {canDockable: true},
                        dimensions: {width: 400, height: 200},
                        scale:      {x: 1.2, y: 1.1},
                        mandatory: false,
                    })),
                },
            },
        }
    })

    it('limits the capability to the Replay Timeline and clamps the drawer size', () => {
        expect(canDockWidget(timelineId)).toBe(true)
        expect(canDockWidget('text-widget#1')).toBe(false)
        expect(normalizeDockSize(100)).toBe(180)
        expect(normalizeDockSize(900)).toBe(720)
    })

    it('limits the drawer to 90 percent of the viewport height', () => {
        Object.defineProperty(window, 'innerHeight', {configurable: true, value: 1000})

        expect(getDockedWidgetMaxSize()).toBe(900)
        expect(normalizeDockSize(1000)).toBe(900)
    })

    it('enforces one docked widget and mirrors the state to settings', () => {
        expect(dockWidget(timelineId)).toBe(true)
        expect(lgs.stores.ui.widget.docked.id).toBe(timelineId)
        expect(lgs.settings.ui.widgets.dock.id).toBe(timelineId)
        expect(getDockedWidgetDimensions(timelineId)).toEqual({width: 480, height: 220})
        expect(setDockSize(500)).toBe(500)
        expect(lgs.stores.ui.widget.docked.size).toBe(500)
        expect(lgs.settings.ui.widgets.dock.size).toBe(500)
        expect(dockWidget('replay-timeline-widget#2')).toBe(false)

        expect(undockWidget(timelineId)).toBe(true)
        expect(lgs.stores.ui.widget.docked.id).toBeNull()
        expect(lgs.settings.ui.widgets.dock.id).toBeNull()
        expect(lgs.stores.ui.widget.current.id).toBe(timelineId)
    })

    it('restores only a supported docked widget from settings', () => {
        lgs.settings.ui.widgets.dock = {
            id:         timelineId,
            size:       999,
            dimensions: {width: 400, height: 200},
            scale:      {x: 1.2, y: 1.1},
        }
        expect(hydrateDockedWidget()).toBe(timelineId)
        expect(lgs.stores.ui.widget.docked.size).toBe(720)
        expect(getDockedWidgetDimensions(timelineId)).toEqual({width: 480, height: 220})

        lgs.settings.ui.widgets.dock = {id: 'text-widget#1', size: 320}
        expect(hydrateDockedWidget()).toBeNull()
        expect(lgs.stores.ui.widget.docked.id).toBeNull()
    })
})
