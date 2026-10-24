// @vitest-environment jsdom
/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: map-point-context-menu-trigger.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-22
 * Last modified: 2026-10-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'
import { Cartesian3, Event as CesiumEvent } from 'cesium'

vi.mock('@Core/constants', () => ({
    CURRENT_MAP_POINT: 'CURRENT_MAP_POINT',
}))

import { MapPointContextMenuTrigger } from '@Components/MainUI/context-menu/MapPointContextMenuTrigger'

/** Supply terrain responses in a deterministic order. */
const deferredTerrain = () => {
    let resolve
    const promise = new Promise(done => { resolve = done })
    return {promise, resolve}
}

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
        vi.stubGlobal('__', {
            canvasEvents,
            ui: {
                contextMenu: {hide: hideContextMenu},
                sceneManager: {noRelief: () => false},
                poiManager: {getHeightFromTerrain: vi.fn(async () => 1200)},
            },
        })
        vi.stubGlobal('lgs', {
            camera: {
                getPickRay: position => position,
                moveStart: new CesiumEvent(),
            },
            scene: {
                pick: vi.fn(() => null),
                globe: {pick: vi.fn(position => Cartesian3.fromDegrees(position.x, position.y, 1100))},
            },
            stores: {
                main: {components: {pois: {list: new Map()}}},
                ui: {
                    contextMenu: proxy({type: null, targetId: null, position: null, visible: false}),
                    video:       proxy({
                        editing:     false,
                        preRecording: false,
                        recording:   false,
                        snapshot:    false,
                        finalizing:  false,
                    }),
                },
            },
        })
    })

    afterEach(() => {
        cleanup()
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
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

    it('opens the menu at the picked coordinates with the sampled terrain altitude', async () => {
        render(<MapPointContextMenuTrigger/>)
        await canvasEvents.onRightClick.mock.calls[0][0]({position: {x: 5.735, y: 45.325}})

        const $menu = lgs.stores.ui.contextMenu
        expect($menu.type).toBe('map-point')
        expect($menu.targetId.longitude).toBeCloseTo(5.735, 8)
        expect($menu.targetId.latitude).toBeCloseTo(45.325, 8)
        expect($menu.targetId.simulatedHeight).toBe(1200)
        expect($menu.visible).toBe(true)
    })

    it('keeps the latest click when terrain requests finish in reverse order', async () => {
        const firstTerrain = deferredTerrain()
        const secondTerrain = deferredTerrain()
        __.ui.poiManager.getHeightFromTerrain
            .mockReturnValueOnce(firstTerrain.promise)
            .mockReturnValueOnce(secondTerrain.promise)
        render(<MapPointContextMenuTrigger/>)
        const open = canvasEvents.onRightClick.mock.calls[0][0]
        const firstRequest = open({position: {x: 2.3522, y: 48.8566}})
        const secondRequest = open({position: {x: 5.735, y: 45.325}})

        secondTerrain.resolve(1200)
        await secondRequest
        const $latestTarget = lgs.stores.ui.contextMenu.targetId
        firstTerrain.resolve(40)
        await firstRequest

        expect(lgs.stores.ui.contextMenu.targetId).toBe($latestTarget)
        expect($latestTarget.longitude).toBeCloseTo(5.735, 8)
        expect($latestTarget.latitude).toBeCloseTo(45.325, 8)
        expect($latestTarget.simulatedHeight).toBe(1200)
    })

    it('preserves a newer POI menu when an old map pick completes', async () => {
        const terrain = deferredTerrain()
        __.ui.poiManager.getHeightFromTerrain.mockReturnValueOnce(terrain.promise)
        lgs.stores.main.components.pois.list.set('existing-poi', {id: 'existing-poi'})
        render(<MapPointContextMenuTrigger/>)
        const open = canvasEvents.onRightClick.mock.calls[0][0]
        const pending = open({position: {x: 2.3522, y: 48.8566}})

        lgs.scene.pick.mockReturnValue({id: 'existing-poi'})
        await open({position: {x: 5.735, y: 45.325}})
        terrain.resolve(40)
        await pending

        expect(lgs.stores.ui.contextMenu.type).toBe('poi')
        expect(lgs.stores.ui.contextMenu.targetId.id).toBe('existing-poi')
    })

    it('preserves a newer menu opened by an entity handler that bypasses the map callback', async () => {
        const terrain = deferredTerrain()
        __.ui.poiManager.getHeightFromTerrain.mockReturnValueOnce(terrain.promise)
        render(<MapPointContextMenuTrigger/>)
        const pending = canvasEvents.onRightClick.mock.calls[0][0]({position: {x: 2.3522, y: 48.8566}})
        Object.assign(lgs.stores.ui.contextMenu, {
            type: 'widget', targetId: 'widget-1', position: {x: 100, y: 200}, visible: true,
        })
        terrain.resolve(40)
        await pending

        expect(lgs.stores.ui.contextMenu.type).toBe('widget')
        expect(lgs.stores.ui.contextMenu.targetId).toBe('widget-1')
    })

    it('does not cancel a valid pick when metadata on the previous POI changes', async () => {
        const terrain = deferredTerrain()
        __.ui.poiManager.getHeightFromTerrain.mockReturnValueOnce(terrain.promise)
        lgs.stores.ui.contextMenu.targetId = {id: 'previous-poi', location: ''}
        render(<MapPointContextMenuTrigger/>)
        const pending = canvasEvents.onRightClick.mock.calls[0][0]({position: {x: 5.735, y: 45.325}})
        lgs.stores.ui.contextMenu.targetId.location = 'Resolved location'
        terrain.resolve(1200)
        await pending

        expect(lgs.stores.ui.contextMenu.type).toBe('map-point')
        expect(lgs.stores.ui.contextMenu.targetId.longitude).toBeCloseTo(5.735, 8)
    })

    it.each(['pointerdown', 'wheel', 'Escape', 'camera movement'])('cancels a pending pick after %s', async action => {
        const terrain = deferredTerrain()
        __.ui.poiManager.getHeightFromTerrain.mockReturnValueOnce(terrain.promise)
        render(<MapPointContextMenuTrigger/>)
        const pending = canvasEvents.onRightClick.mock.calls[0][0]({position: {x: 2.3522, y: 48.8566}})

        if (action === 'camera movement') {
            lgs.camera.moveStart.raiseEvent()
        }
        else if (action === 'Escape') {
            fireEvent.keyDown(document, {key: 'Escape'})
        }
        else {
            fireEvent(document, new window.Event(action, {bubbles: true}))
        }
        terrain.resolve(40)
        await pending

        expect(lgs.stores.ui.contextMenu.visible).toBe(false)
        expect(lgs.stores.ui.contextMenu.targetId).toBeNull()
    })

    it('invalidates the previous request even when the newest click misses the globe', async () => {
        const terrain = deferredTerrain()
        __.ui.poiManager.getHeightFromTerrain.mockReturnValueOnce(terrain.promise)
        render(<MapPointContextMenuTrigger/>)
        const open = canvasEvents.onRightClick.mock.calls[0][0]
        const pending = open({position: {x: 2.3522, y: 48.8566}})
        lgs.scene.globe.pick.mockReturnValueOnce(null)
        await open({position: {x: 5.735, y: 45.325}})
        terrain.resolve(40)
        await pending

        expect(lgs.stores.ui.contextMenu.visible).toBe(false)
    })

    it('retains the clicked screen position when Cesium reuses its event coordinates', async () => {
        const terrain = deferredTerrain()
        __.ui.poiManager.getHeightFromTerrain.mockReturnValueOnce(terrain.promise)
        render(<MapPointContextMenuTrigger/>)
        const position = {x: 5.735, y: 45.325}
        const pending = canvasEvents.onLongTap.mock.calls[0][0]({endPosition: position})
        position.x = 2.3522
        position.y = 48.8566
        terrain.resolve(1200)
        await pending

        expect(lgs.stores.ui.contextMenu.position).toEqual({x: 5.735, y: 45.325})
        expect(lgs.stores.ui.contextMenu.targetId.longitude).toBeCloseTo(5.735, 8)
    })

    it('uses the picked altitude if terrain sampling fails', async () => {
        __.ui.poiManager.getHeightFromTerrain.mockRejectedValueOnce(new Error('Terrain unavailable'))
        render(<MapPointContextMenuTrigger/>)
        await canvasEvents.onRightClick.mock.calls[0][0]({position: {x: 5.735, y: 45.325}})

        expect(lgs.stores.ui.contextMenu.targetId.simulatedHeight).toBeCloseTo(1100, 5)
        expect(lgs.stores.ui.contextMenu.targetId.longitude).toBeCloseTo(5.735, 8)
    })

    it('cancels pending work and releases handlers when unmounted', async () => {
        const terrain = deferredTerrain()
        __.ui.poiManager.getHeightFromTerrain.mockReturnValueOnce(terrain.promise)
        const view = render(<MapPointContextMenuTrigger/>)
        const pending = canvasEvents.onRightClick.mock.calls[0][0]({position: {x: 2.3522, y: 48.8566}})
        expect(lgs.camera.moveStart.numberOfListeners).toBe(1)
        view.unmount()
        terrain.resolve(40)
        await pending

        expect(lgs.stores.ui.contextMenu.visible).toBe(false)
        expect(canvasEvents.offRightClick).toHaveBeenCalledWith(canvasEvents.onRightClick.mock.calls[0][0])
        expect(canvasEvents.offLongTap).toHaveBeenCalledWith(canvasEvents.onLongTap.mock.calls[0][0])
        expect(lgs.camera.moveStart.numberOfListeners).toBe(0)
    })
})
