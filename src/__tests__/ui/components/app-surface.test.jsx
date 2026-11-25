/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: app-surface.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-22
 * Last modified: 2026-11-25
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {act, cleanup, render} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

vi.mock('@Components/cesium/Base3DLayer', () => ({
    Base3DLayer: () => null,
}))

vi.mock('@Components/cesium/Base3DLoadingOverlay', () => ({
    Base3DLoadingOverlay: () => null,
}))

vi.mock('@Components/cesium/MapLayer', () => ({
    MapLayer: () => null,
}))

vi.mock('@Components/cesium/Tiles3DLayer', () => ({
    Tiles3DLayer: () => null,
}))

vi.mock('@Components/cesium/Viewer', () => ({
    Viewer: () => null,
}))

vi.mock('@Components/MainUI/MainUI.jsx', () => ({
    MainUI: ({initialMapTilesReady}) => <div data-testid="main-ui-map-readiness" data-ready={String(initialMapTilesReady)}/>,
}))

vi.mock('@Components/MainUI/ResponsiveDevice', () => ({
    default: () => null,
}))

vi.mock('@Components/MainUI/SelectionIndicator', () => ({
    SelectionIndicator: () => null,
}))

vi.mock('@Components/MainUI/ToolsUI', () => ({
    ToolsUI: () => null,
}))

vi.mock('@Components/Toast', () => ({
    Toast: () => null,
}))

import {AppSurface} from '@Components/AppSurface'
import {watchInitialMapTiles} from '@Core/ui/startup/initialMapTiles'

/**
 * Creates a controllable Cesium post-render event for readiness tests.
 *
 * @returns {{event: {addEventListener: (listener: () => void) => () => void}, raise: () => void, remove: ReturnType<typeof vi.fn>}} Event harness.
 */
const createPostRenderEvent = () => {
    let listener
    const remove = vi.fn()

    return {
        event: {
            addEventListener: vi.fn(callback => {
                listener = callback
                return remove
            }),
        },
        raise: () => listener?.(),
        remove,
    }
}

describe('AppSurface', () => {
    afterEach(() => {
        cleanup()
        vi.useRealTimers()
        vi.restoreAllMocks()
        globalThis.lgs = undefined
        globalThis.__ = undefined
    })

    it('reports a startup error when Cesium never completes its first render', () => {
        vi.useFakeTimers()
        const onReady = vi.fn()
        const onError = vi.fn()
        globalThis.__ = {
            ui: {
                replay: {
                    restoreJourneyToolbarVisibility: vi.fn(),
                    stop: vi.fn(),
                },
            },
        }
        const postRender = createPostRenderEvent()
        globalThis.lgs = {
            scene: {
                canvas: {},
                postRender: postRender.event,
                requestRender: vi.fn(),
            },
        }

        render(<AppSurface onReady={onReady} onError={onError}/>)

        act(() => {
            vi.runAllTimers()
        })

        expect(onReady).not.toHaveBeenCalled()
        expect(onError).toHaveBeenCalledOnce()
        expect(onError.mock.calls[0][0].message).toContain('did not complete its first render')
        expect(globalThis.lgs.scene.requestRender).toHaveBeenCalled()
        expect(postRender.remove).toHaveBeenCalledOnce()
    })

    it('passes initial map readiness to the POI-bearing main UI', () => {
        const postRender = createPostRenderEvent()
        globalThis.__ = {ui: {replay: {restoreJourneyToolbarVisibility: vi.fn(), stop: vi.fn()}}}
        globalThis.lgs = {
            scene: {canvas: {}, postRender: postRender.event, requestRender: vi.fn()},
        }

        const {getByTestId} = render(<AppSurface initialMapTilesReady={false}/>)

        expect(getByTestId('main-ui-map-readiness').dataset.ready).toBe('false')
    })

    it('requests a render immediately and releases startup on the first completed frame', () => {
        const onReady = vi.fn()
        const onError = vi.fn()
        globalThis.__ = {
            ui: {
                replay: {
                    restoreJourneyToolbarVisibility: vi.fn(),
                    stop: vi.fn(),
                },
            },
        }
        const postRender = createPostRenderEvent()
        globalThis.lgs = {
            scene: {
                canvas: {},
                postRender: postRender.event,
                requestRender: vi.fn(),
            },
        }

        render(<AppSurface onReady={onReady} onError={onError}/>)

        expect(lgs.scene.requestRender).toHaveBeenCalledOnce()
        expect(onReady).not.toHaveBeenCalled()
        act(() => postRender.raise())

        expect(onReady).toHaveBeenCalledOnce()
        expect(onError).not.toHaveBeenCalled()
        expect(postRender.remove).toHaveBeenCalledOnce()
    })

    it('removes the render listener and timeout on unmount before the first frame', () => {
        vi.useFakeTimers()
        const onReady = vi.fn()
        const onError = vi.fn()
        const postRender = createPostRenderEvent()
        globalThis.__ = {ui: {}}
        globalThis.lgs = {
            scene: {canvas: {}, postRender: postRender.event, requestRender: vi.fn()},
        }

        const {unmount} = render(<AppSurface onReady={onReady} onError={onError}/>)
        unmount()

        act(() => {
            postRender.raise()
            vi.runAllTimers()
        })
        expect(postRender.remove).toHaveBeenCalledOnce()
        expect(onReady).not.toHaveBeenCalled()
        expect(onError).not.toHaveBeenCalled()
    })

    it('waits for the imagery layer and visible globe tiles before allowing entry', () => {
        const postRender = createPostRenderEvent()
        const globe = {show: true, tilesLoaded: true}
        const context = {
            scene: {globe, postRender: postRender.event, requestRender: vi.fn()},
            settings: {layers: {base: 'imagery'}},
        }
        const onResult = vi.fn()
        const stop = watchInitialMapTiles(context, onResult)

        postRender.raise()
        expect(onResult).not.toHaveBeenCalled()
        context.theLayer = {ready: true}
        globe.tilesLoaded = false
        postRender.raise()
        expect(onResult).not.toHaveBeenCalled()
        globe.tilesLoaded = true
        postRender.raise()

        expect(onResult).toHaveBeenCalledExactlyOnceWith('ready')
        stop()
        expect(postRender.remove).toHaveBeenCalledOnce()
    })

    it('allows entry on ready 2D fallback imagery while visible 3D detail continues loading', () => {
        const postRender = createPostRenderEvent()
        const onResult = vi.fn()
        const context = {
            scene: {
                globe: {show: true, tilesLoaded: true},
                postRender: postRender.event,
                requestRender: vi.fn(),
            },
            settings: {layers: {base: 'imagery', base3d: '3d'}},
            base3dTileset: {tilesLoaded: false},
            theLayer: {ready: false},
        }
        watchInitialMapTiles(context, onResult)

        postRender.raise()
        expect(onResult).not.toHaveBeenCalled()

        context.theLayer.ready = true
        postRender.raise()
        expect(onResult).toHaveBeenCalledExactlyOnceWith('ready')
        expect(postRender.remove).toHaveBeenCalledOnce()
    })

    it('reports the deadline and keeps waiting until the selected tiles render', () => {
        vi.useFakeTimers()
        const postRender = createPostRenderEvent()
        const onResult = vi.fn()
        const context = {
            scene: {globe: {show: false}, postRender: postRender.event, requestRender: vi.fn()},
            settings: {layers: {base3d: '3d'}},
        }
        watchInitialMapTiles(context, onResult)

        postRender.raise()
        expect(onResult).not.toHaveBeenCalled()
        vi.advanceTimersByTime(5000)
        postRender.raise()
        expect(onResult).toHaveBeenCalledExactlyOnceWith('timeout')
        expect(postRender.remove).not.toHaveBeenCalled()
        context.base3dTileset = {tilesLoaded: true}
        postRender.raise()
        expect(onResult.mock.calls).toEqual([['timeout'], ['ready']])
        expect(postRender.remove).toHaveBeenCalledOnce()
    })

    it('allows entry on the loaded 2D base after the deadline while tile requests continue', () => {
        vi.useFakeTimers()
        const postRender = createPostRenderEvent()
        const onResult = vi.fn()
        const context = {
            scene: {
                globe: {show: true, tilesLoaded: false},
                postRender: postRender.event,
                requestRender: vi.fn(),
            },
            settings: {layers: {base: 'imagery', base3d: '3d'}},
            theLayer: {ready: true},
        }

        watchInitialMapTiles(context, onResult)
        vi.advanceTimersByTime(5000)

        expect(onResult).toHaveBeenCalledExactlyOnceWith('fallback')
        expect(postRender.remove).not.toHaveBeenCalled()

        context.scene.globe.tilesLoaded = true
        postRender.raise()

        expect(onResult.mock.calls).toEqual([['fallback'], ['ready']])
        expect(postRender.remove).toHaveBeenCalledOnce()
    })
})
