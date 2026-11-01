// @vitest-environment jsdom
/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: map-poi-monitor.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-01
 * Last modified: 2026-11-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {act, cleanup, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'
import {proxyMap} from 'valtio/utils'
import {poiCaptureSurfaceStore} from '@Components/MainUI/MapPOI/poiCaptureSurfaceStore'

vi.mock('@Components/MainUI/MapPOI/MapPOIContent', () => ({
    MapPOIContent: ({poi, managedCaptureSurface}) => (
        <div data-testid="poi-capture-surface" data-poi={poi} data-managed={managedCaptureSurface ? 'true' : 'false'}/>
    ),
}))
vi.mock('@Components/MainUI/MapPOI/MapPOICluster', () => ({MapPOICluster: () => null}))
vi.mock('@Components/MainUI/MapPOI/openPOIEditor', () => ({openPOIEditor: vi.fn()}))

import {MapPOIMonitor} from '@Components/MainUI/MapPOI/MapPOIMonitor'
import {openPOIEditor} from '@Components/MainUI/MapPOI/openPOIEditor'
import {clearPOIHoverTitlePreview, getPOIHoverTitle} from '@Components/MainUI/MapPOI/poiHoverPreviewStore'

/** Install the map event adapter and one visible POI. */
const setupMonitor = (pois = [
    {id: 'poi-1', title: 'River stop', visible: true, expanded: true, replay: {visible: true}},
]) => {
    const poi = pois[0]
    const listeners = []
    const record = name => vi.fn((callback, options) => listeners.push({name, callback, options}))
    const canvasEvents = {
        on: vi.fn((name, callback, options) => listeners.push({name, callback, options})),
        onClick: record('CLICK'),
        onTap: record('TAP'),
        onDoubleClick: record('DOUBLE_CLICK'),
        onDoubleTap: record('DOUBLE_TAP'),
        onRightClick: record('RIGHT_CLICK'),
        onLongTap: record('LONG_TAP'),
        offDoubleClick: vi.fn(),
        removeAllListenersByEntity: vi.fn(),
        offKeyUp: vi.fn(),
    }
    const updatePOI = vi.fn()
    const canvas = document.createElement('canvas')
    canvas.style.cursor = 'crosshair'

    globalThis.lgs = {
        stores: {
            main: proxy({
                components: {pois: {list: proxyMap(pois.map(currentPOI => [currentPOI.id, currentPOI]))}},
                startupVisualsMasked: false,
                startupPrimaryVisualsReady: false,
                theJourney: null,
            }),
            replay: proxy({active: false, playing: false, paused: false, nearbyPois: [], animatedPOIIds: []}),
        },
        settings: {
            unitSystem: proxy({current: 'metric'}),
            coordinateSystem: proxy({current: 'decimal'}),
        },
        viewer: {canvas, scene: {canvas}},
    }
    globalThis.__ = {
        canvasEvents,
        ui: {
            contextMenu: {hide: vi.fn()},
            poiManager: {updatePOI, ensurePOILocation: vi.fn()},
        },
    }

    const rendered = render(<MapPOIMonitor/>)
    return {canvas, canvasEvents, listeners, poi, rendered, updatePOI}
}

afterEach(() => {
    cleanup()
    clearPOIHoverTitlePreview()
    vi.restoreAllMocks()
    delete globalThis.lgs
    delete globalThis.__
})

describe('Map POI interaction monitor', () => {
    it('keeps ordinary POI expansion clicks in the map monitor', async () => {
        const {canvasEvents, listeners, poi, updatePOI} = setupMonitor()
        const click = listeners.find(listener => listener.name === 'CLICK')

        expect(click.options).toEqual({entity: poi.id, preventLowerPriority: true})
        expect(canvasEvents.on.mock.calls.some(([name]) => name === 'SHIFT#CLICK')).toBe(false)
        await act(async () => click.callback({shiftKey: true}, poi.id))

        expect(updatePOI).toHaveBeenCalledWith(poi.id, {expanded: false}, {skipLocationUpdate: true})
    })

    it('opens global POIs from the generic Cesium double-click handler', async () => {
        openPOIEditor.mockResolvedValue(true)
        const {listeners, poi} = setupMonitor([
            {id: 'global-poi', parent: '__global__', title: 'Global', visible: true, replay: {visible: true}},
        ])
        const doubleClick = listeners.find(listener => listener.name === 'DOUBLE_CLICK')

        expect(doubleClick.options.entity).toEqual([])
        await act(async () => doubleClick.callback({position: {x: 1, y: 1}}, poi.id))

        expect(openPOIEditor).toHaveBeenCalledWith(poi.id)
        expect(globalThis.__.ui.contextMenu.hide).toHaveBeenCalledOnce()
    })

    it('shows the POI title and pointer cursor on hover, then clears both on leave', async () => {
        const {canvas, listeners, poi} = setupMonitor()
        const enter = listeners.find(listener => listener.name === 'MOUSE_ENTER')
        const leave = listeners.find(listener => listener.name === 'MOUSE_LEAVE')

        await act(async () => enter.callback({}, poi.id))
        expect(getPOIHoverTitle(poi.id)).toBe(true)
        expect(canvas.style.cursor).toBe('pointer')

        await act(async () => leave.callback({}, poi.id))
        expect(getPOIHoverTitle(poi.id)).toBe(false)
        expect(canvas.style.cursor).toBe('crosshair')
    })

    it('releases Cesium listeners when the monitor unmounts', () => {
        const {canvasEvents, listeners, poi, rendered} = setupMonitor()
        const doubleClick = listeners.find(listener => listener.name === 'DOUBLE_CLICK')

        rendered.unmount()

        expect(canvasEvents.removeAllListenersByEntity).toHaveBeenCalledWith(poi.id)
        expect(canvasEvents.offDoubleClick).toHaveBeenCalledWith(doubleClick.callback)
    })

    it('mounts only one rich POI capture surface at a time', async () => {
        setupMonitor(Array.from({length: 5}, (_, index) => ({
            id: `poi-${index}`,
            title: `POI ${index}`,
            visible: true,
            expanded: index === 0,
            replay: {visible: true},
        })))

        await act(async () => {
            await Promise.resolve()
        })

        expect(screen.getAllByTestId('poi-capture-surface')).toHaveLength(1)
        expect(screen.getByTestId('poi-capture-surface').dataset.poi).toBe('poi-0')

        await act(async () => poiCaptureSurfaceStore.release('poi-0'))
        await act(async () => {
            await Promise.resolve()
        })

        expect(screen.getAllByTestId('poi-capture-surface')).toHaveLength(1)
        expect(screen.getByTestId('poi-capture-surface').dataset.poi).toBe('poi-1')
    })

    it('waits to mount a rich capture surface until a hidden POI becomes visible', async () => {
        setupMonitor([{
            id: 'poi-hidden',
            title: 'Hidden POI',
            visible: false,
            expanded: false,
            replay: {visible: true},
        }])
        const poi = globalThis.lgs.stores.main.components.pois.list.get('poi-hidden')

        await act(async () => {
            await Promise.resolve()
        })
        expect(screen.queryByTestId('poi-capture-surface')).toBeNull()

        await act(async () => {
            poi.visible = true
        })
        await act(async () => {
            await Promise.resolve()
        })

        expect(screen.getByTestId('poi-capture-surface').dataset.poi).toBe(poi.id)

        await act(async () => {
            poi.tooClose = true
        })
        expect(screen.queryByTestId('poi-capture-surface')).toBeNull()

        await act(async () => {
            poi.tooClose = false
        })
        await act(async () => {
            await Promise.resolve()
        })
        expect(screen.getByTestId('poi-capture-surface').dataset.poi).toBe(poi.id)
    })

    it('keeps the full POI capture tree mounted during Replay', async () => {
        setupMonitor(Array.from({length: 3}, (_, index) => ({
            id: `replay-poi-${index}`,
            title: `Replay POI ${index}`,
            visible: true,
            expanded: false,
            replay: {visible: true},
        })))

        await act(async () => {
            await Promise.resolve()
        })
        await act(async () => {
            globalThis.lgs.stores.replay.active = true
        })

        expect(screen.getAllByTestId('poi-capture-surface')).toHaveLength(3)
        expect(screen.getAllByTestId('poi-capture-surface').every(
            surface => surface.dataset.managed === 'false',
        )).toBe(true)
    })
})
