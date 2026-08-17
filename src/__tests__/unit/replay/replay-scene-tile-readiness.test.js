/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-scene-tile-readiness.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    areReplaySceneTilesReady,
    prepareReplaySceneTilesForCapture,
    waitForReplaySceneTilesReady,
} from '@Core/ui/replay/ReplaySceneTileReadiness'
import { describe, expect, it, vi } from 'vitest'

/**
 * Create a small Cesium Event-compatible test double.
 *
 * @returns {object} Event test double.
 */
const createEvent = () => {
    const listeners = new Set()
    return {
        addEventListener: listener => {
            listeners.add(listener)
            return () => listeners.delete(listener)
        },
        emit: (...args) => listeners.forEach(listener => listener(...args)),
    }
}

/**
 * Create a collection compatible with Cesium's get/length API.
 *
 * @param {Array<object>} values - Collection values.
 * @returns {object} Collection test double.
 */
const createCollection = values => ({
    length: values.length,
    get: index => values[index],
})

describe('ReplaySceneTileReadiness', () => {
    it('prepares the current view without changing the camera', async () => {
        const postRender = createEvent()
        const tileset = {
            cullRequestsWhileMoving:  true,
            foveatedScreenSpaceError: true,
            foveatedTimeDelay:        0.2,
            show:                     true,
            tilesLoaded:              true,
        }
        let warmupSettings = null
        const scene = {
            globe: {
                tilesLoaded: true,
            },
            postRender,
            primitives: createCollection([tileset]),
            requestRender: vi.fn(() => {
                warmupSettings = {
                    cullRequestsWhileMoving:  tileset.cullRequestsWhileMoving,
                    foveatedScreenSpaceError: tileset.foveatedScreenSpaceError,
                    foveatedTimeDelay:        tileset.foveatedTimeDelay,
                }
                postRender.emit(scene)
            }),
        }

        await expect(prepareReplaySceneTilesForCapture({
            scene,
            maxMillis: 200,
        })).resolves.toBe(true)

        expect(warmupSettings).toEqual({
            cullRequestsWhileMoving:  false,
            foveatedScreenSpaceError: false,
            foveatedTimeDelay:        0,
        })
        expect(tileset.cullRequestsWhileMoving).toBe(true)
        expect(tileset.foveatedScreenSpaceError).toBe(true)
        expect(tileset.foveatedTimeDelay).toBe(0.2)
        expect(scene.requestRender).toHaveBeenCalled()
    })

    it('waits for 2D imagery readiness and a rendered frame', async () => {
        const tileLoadProgressEvent = createEvent()
        const postRender = createEvent()
        const scene = {
            globe: {
                tilesLoaded: false,
                tileLoadProgressEvent,
            },
            postRender,
            requestRender: vi.fn(),
            primitives: createCollection([]),
        }

        const readiness = waitForReplaySceneTilesReady({scene, maxMillis: 200})
        await Promise.resolve()

        scene.globe.tilesLoaded = true
        tileLoadProgressEvent.emit(0)
        postRender.emit(scene)

        await expect(readiness).resolves.toBe(true)
        expect(scene.requestRender).toHaveBeenCalled()
    })

    it('waits for visible 3D tilesets before completing', async () => {
        const allTilesLoaded = createEvent()
        const postRender = createEvent()
        const tileset = {
            show: true,
            tilesLoaded: false,
            allTilesLoaded,
            loadProgress: createEvent(),
            tileFailed: createEvent(),
        }
        const scene = {
            globe: {tilesLoaded: true},
            postRender,
            requestRender: vi.fn(),
            primitives: createCollection([tileset]),
        }

        expect(areReplaySceneTilesReady(scene)).toBe(false)
        const readiness = waitForReplaySceneTilesReady({scene, maxMillis: 200})
        await Promise.resolve()

        tileset.tilesLoaded = true
        allTilesLoaded.emit(tileset)
        postRender.emit(scene)

        await expect(readiness).resolves.toBe(true)
    })

    it('ignores hidden 3D tilesets', async () => {
        const scene = {
            globe: {tilesLoaded: true},
            primitives: createCollection([{show: false, tilesLoaded: false}]),
        }

        await expect(waitForReplaySceneTilesReady({scene, maxMillis: 50})).resolves.toBe(true)
    })

    it('ignores the globe load queue when the globe is hidden behind a 3D base', async () => {
        const scene = {
            globe: {show: false, tilesLoaded: false},
            primitives: createCollection([]),
        }

        await expect(waitForReplaySceneTilesReady({scene, maxMillis: 50})).resolves.toBe(true)
    })

    it('fails fast when a 3D tile reports a loading error', async () => {
        const tileFailed = createEvent()
        const tileset = {
            show: true,
            tilesLoaded: false,
            allTilesLoaded: createEvent(),
            loadProgress: createEvent(),
            tileFailed,
        }
        const scene = {
            globe: {tilesLoaded: true},
            postRender: createEvent(),
            requestRender: vi.fn(),
            primitives: createCollection([tileset]),
        }

        const readiness = waitForReplaySceneTilesReady({scene, maxMillis: 200})
        await Promise.resolve()
        tileFailed.emit({url: 'https://example.test/tile.b3dm', message: 'Network error'})

        await expect(readiness).rejects.toThrow('3D tiles')
    })

    it('returns false on timeout so the export can continue with the current frame', async () => {
        const scene = {
            globe: {tilesLoaded: false},
            tileLoadProgressEvent: createEvent(),
            postRender: createEvent(),
            requestRender: vi.fn(),
            primitives: createCollection([]),
        }

        await expect(waitForReplaySceneTilesReady({scene, maxMillis: 10})).resolves.toBe(false)
    })
})
