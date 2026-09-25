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
 * Last modified: 2026-09-25
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

describe('AppSurface', () => {
    afterEach(() => {
        cleanup()
        vi.useRealTimers()
        vi.restoreAllMocks()
        globalThis.lgs = undefined
        globalThis.__ = undefined
    })

    it('releases startup readiness when Cesium post-render never fires', async () => {
        vi.useFakeTimers()
        const onReady = vi.fn()
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
        globalThis.lgs = {
            scene: {
                canvas: {},
                postRender: {
                    addEventListener: vi.fn(() => vi.fn()),
                },
                requestRender: vi.fn(),
            },
        }

        render(<AppSurface onReady={onReady}/>)

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0)
            await vi.advanceTimersByTimeAsync(0)
            await vi.advanceTimersByTimeAsync(1500)
        })
        await flush()

        expect(onReady).toHaveBeenCalledOnce()
        expect(globalThis.lgs.scene.requestRender).toHaveBeenCalled()
        expect(animationFrame).toHaveBeenCalled()
    })
})
