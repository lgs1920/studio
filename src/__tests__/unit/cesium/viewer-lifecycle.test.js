/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: viewer-lifecycle.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-25
 * Last modified: 2026-09-25
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const {FakeViewer, fakeCanvasEventManager} = vi.hoisted(() => {
    const createEvent = () => {
        const listeners = new Set()
        return {
            addEventListener: vi.fn(listener => {
                listeners.add(listener)
                return () => listeners.delete(listener)
            }),
            raise: (...args) => listeners.forEach(listener => listener(...args)),
        }
    }

    class FakeViewer {
        static instances = []

        constructor(container) {
            this.container = container
            this.destroyed = false
            this.camera = {changed: createEvent()}
            this.scene = {
                camera:                      this.camera,
                canvas:                      document.createElement('canvas'),
                globe:                       {},
                postRender:                  createEvent(),
                renderError:                 createEvent(),
                screenSpaceCameraController: {},
                requestRender:               vi.fn(),
            }
            this.screenSpaceEventHandler = {removeInputAction: vi.fn()}
            this.forceResize = vi.fn()
            FakeViewer.instances.push(this)
        }

        isDestroyed() {
            return this.destroyed
        }
    }

    return {
        FakeViewer,
        fakeCanvasEventManager: vi.fn(),
    }
})

vi.mock('cesium', async importOriginal => {
    const actual = await importOriginal()
    return {
        ...actual,
        Viewer: FakeViewer,
    }
})

vi.mock('@Core/events/CanvasEventManager', () => ({
    CanvasEventManager: fakeCanvasEventManager,
}))

vi.mock('@Core/ui/replay/ReplayCesiumCameraAdapter', () => ({
    constrainReplayCesiumCameraAboveTerrain: vi.fn(),
}))

vi.mock('@Utils/cesium/SceneUtils', () => ({
    SceneUtils: {
        modeFromLGSToGIS: vi.fn(() => 3),
    },
}))

import {ensureViewer, ensureViewerBase, ensureViewerBaseWithRetry} from '@Components/cesium/Viewer'

const createContext = () => {
    const context = {
        viewer: null,
        settings: {scene: {mode: '3d'}},
        stores: {ui: {mainUI: {panorama: {active: false}}}},
    }
    Object.defineProperties(context, {
        scene: {get: () => context.viewer?.scene},
        camera: {get: () => context.viewer?.camera},
    })
    return context
}

describe('Cesium viewer lifecycle', () => {
    let container

    beforeEach(() => {
        container = {
            id:              'cesium-viewer',
            isConnected:     true,
            clientWidth:     1920,
            clientHeight:    1080,
        }
        globalThis.document = {
            getElementById: vi.fn(() => container),
            createElement:  vi.fn(() => ({addEventListener: vi.fn()})),
        }

        globalThis.lgs = createContext()
        globalThis.__ = {
            ui: {cameraManager: {raiseUpdateEvent: vi.fn()}},
        }
        FakeViewer.instances.length = 0
        fakeCanvasEventManager.mockClear()
    })

    afterEach(() => {
        globalThis.lgs = undefined
        globalThis.__ = undefined
        globalThis.document = undefined
        vi.restoreAllMocks()
    })

    it('fails explicitly when the Cesium container is missing', () => {
        document.getElementById.mockReturnValue(null)

        expect(() => ensureViewer()).toThrow('[LGS1920][Cesium] The #cesium-viewer container is missing.')
        expect(FakeViewer.instances).toHaveLength(0)
    })

    it('initializes a live viewer once and requests an initial render', () => {
        const viewer = ensureViewer()

        expect(viewer).toBe(globalThis.lgs.viewer)
        expect(FakeViewer.instances).toHaveLength(1)
        expect(viewer.forceResize).toHaveBeenCalledOnce()
        expect(viewer.scene.requestRender).toHaveBeenCalledTimes(2)
        expect(fakeCanvasEventManager).toHaveBeenCalledOnce()

        ensureViewer()

        expect(FakeViewer.instances).toHaveLength(1)
        expect(fakeCanvasEventManager).toHaveBeenCalledOnce()
        expect(viewer.scene.renderError.addEventListener).toHaveBeenCalledOnce()
    })

    it('can mount before application settings and managers are ready', () => {
        globalThis.lgs.settings = undefined

        const viewer = ensureViewerBase()

        expect(viewer).toBe(globalThis.lgs.viewer)
        expect(viewer.forceResize).toHaveBeenCalledOnce()
        expect(viewer.scene.requestRender).toHaveBeenCalledOnce()
    })

    it('retries a temporarily missing container', async () => {
        document.getElementById
            .mockReturnValueOnce(null)
            .mockReturnValue(container)

        const viewer = await ensureViewerBaseWithRetry({attempts: 2, delayMs: 0})

        expect(viewer).toBe(globalThis.lgs.viewer)
        expect(FakeViewer.instances).toHaveLength(1)
    })

    it('recreates a destroyed viewer and reattaches lifecycle handlers', () => {
        const previousViewer = ensureViewer()
        previousViewer.destroyed = true

        const nextViewer = ensureViewer()

        expect(nextViewer).not.toBe(previousViewer)
        expect(globalThis.lgs.viewer).toBe(nextViewer)
        expect(FakeViewer.instances).toHaveLength(2)
        expect(fakeCanvasEventManager).toHaveBeenCalledTimes(2)
    })
})
