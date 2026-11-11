/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-export-gpu-budget.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-11
 * Last modified: 2026-11-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, it, vi} from 'vitest'
import {acquireVisibleViewerExportGpuBudget} from '@Core/ui/replay/ReplayExportGpuBudget'

describe('visible viewer GPU budget during Native HQ export', () => {
    it('reduces render buffers temporarily and restores them idempotently', () => {
        const scene = {msaaSamples: 4, requestRender: vi.fn()}
        const viewer = {resolutionScale: 2, scene, resize: vi.fn(), isDestroyed: vi.fn(() => false)}

        const restore = acquireVisibleViewerExportGpuBudget(viewer)

        expect(viewer.resolutionScale).toBe(1)
        expect(scene.msaaSamples).toBe(1)
        expect(viewer.resize).toHaveBeenCalledOnce()
        expect(scene.requestRender).toHaveBeenCalledOnce()

        restore()
        restore()

        expect(viewer.resolutionScale).toBe(2)
        expect(scene.msaaSamples).toBe(4)
        expect(viewer.resize).toHaveBeenCalledTimes(2)
        expect(scene.requestRender).toHaveBeenCalledTimes(2)
    })

    it('does not change an already economical viewer', () => {
        const scene = {msaaSamples: 1, requestRender: vi.fn()}
        const viewer = {resolutionScale: 1, scene, resize: vi.fn()}

        expect(acquireVisibleViewerExportGpuBudget(viewer)).toBeNull()
        expect(viewer.resize).not.toHaveBeenCalled()
    })
})
