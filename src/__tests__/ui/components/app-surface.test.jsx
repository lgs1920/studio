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
 * Last modified: 2026-09-28
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
    MainUI: () => null,
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

/**
 * Flushes pending React and promise work.
 *
 * @returns {Promise<void>} Promise resolved after queued microtasks.
 */
const flush = () => act(async () => {})

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

    it('reports a startup error when Cesium never completes its first render', async () => {
        vi.useFakeTimers()
        const onReady = vi.fn()
        const onError = vi.fn()
        const animationFrame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
            window.setTimeout(() => callback(performance.now()), 0)
            return 1
        })
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

        await act(async () => {
            await vi.runAllTimersAsync()
        })
        await flush()

        expect(onReady).not.toHaveBeenCalled()
        expect(onError).toHaveBeenCalledOnce()
        expect(onError.mock.calls[0][0].message).toContain('did not complete its first render')
        expect(globalThis.lgs.scene.requestRender).toHaveBeenCalled()
        expect(animationFrame).toHaveBeenCalled()
        expect(postRender.remove).toHaveBeenCalledOnce()
    })

    it('releases startup readiness only after a successful Cesium post-render', async () => {
        vi.useFakeTimers()
        const onReady = vi.fn()
        const onError = vi.fn()
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
            window.setTimeout(() => callback(performance.now()), 0)
            return 1
        })
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
                requestRender: vi.fn(() => postRender.raise()),
            },
        }

        render(<AppSurface onReady={onReady} onError={onError}/>)

        await act(async () => {
            await vi.runAllTimersAsync()
        })
        await flush()

        expect(onReady).toHaveBeenCalledOnce()
        expect(onError).not.toHaveBeenCalled()
        expect(postRender.remove).toHaveBeenCalledOnce()
    })
})
