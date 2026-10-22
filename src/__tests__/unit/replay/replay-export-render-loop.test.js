/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-export-render-loop.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-22
 * Last modified: 2026-10-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, it, vi} from 'vitest'
import {acquireReplayExportRenderLoop} from '@Core/ui/replay/ReplayExportRenderLoop'

describe('Replay export render loop', () => {
    it('updates the viewer exactly when capture requests a frame and restores its normal loop', () => {
        const calls = []
        const scene = {requestRender: () => calls.push('request'), render: vi.fn()}
        const viewer = {
            scene,
            useDefaultRenderLoop: true,
            resize: () => calls.push('resize'),
            render: () => calls.push('viewer'),
        }
        const loop = acquireReplayExportRenderLoop({viewer, scene})
        expect(viewer.useDefaultRenderLoop).toBe(false)
        loop.render()
        loop.render()
        expect(calls).toEqual(['request', 'resize', 'viewer', 'request', 'resize', 'viewer'])
        expect(scene.render).not.toHaveBeenCalled()
        loop.release()
        expect(viewer.useDefaultRenderLoop).toBe(true)
        loop.release()
        loop.render()
        expect(calls).toHaveLength(6)
    })

    it('keeps the loop suspended until the last overlapping export releases it', () => {
        const viewer = {scene: {}, render: vi.fn(), useDefaultRenderLoop: true}
        const first = acquireReplayExportRenderLoop({viewer})
        const second = acquireReplayExportRenderLoop({viewer})
        first.release()
        expect(viewer.useDefaultRenderLoop).toBe(false)
        first.release()
        second.render()
        expect(viewer.render).toHaveBeenCalledOnce()
        second.release()
        expect(viewer.useDefaultRenderLoop).toBe(true)
    })

    it('preserves an already manual render target and tolerates its destruction', () => {
        let destroyed = false
        const viewer = {scene: {}, render: vi.fn(), useDefaultRenderLoop: false, isDestroyed: () => destroyed}
        const loop = acquireReplayExportRenderLoop({viewer})
        loop.render()
        destroyed = true
        loop.render()
        loop.release()
        expect(viewer.render).toHaveBeenCalledOnce()
        expect(viewer.useDefaultRenderLoop).toBe(false)
    })

    it('does not borrow a different viewer when only a scene is the active target', () => {
        const scene = {requestRender: vi.fn(), render: vi.fn()}
        const viewer = {scene: {}, render: vi.fn(), useDefaultRenderLoop: true}
        const loop = acquireReplayExportRenderLoop({viewer, scene})
        loop.render()
        loop.release()
        expect(scene.render).toHaveBeenCalledOnce()
        expect(viewer.render).not.toHaveBeenCalled()
        expect(viewer.useDefaultRenderLoop).toBe(true)
    })
})
