import {afterEach, describe, expect, it} from 'vitest'

import {
    clearReplayRenderTarget,
    replayCanvasFor,
    replayRenderTargetFor,
    replaySceneFor,
    replayViewerFor,
    setReplayRenderTarget,
} from '@Core/ui/replay/ReplayRenderTarget'

describe('ReplayRenderTarget', () => {
    const previousLgs = globalThis.lgs

    afterEach(() => {
        globalThis.lgs = previousLgs
    })

    it('routes one owner to an isolated target without changing Studio globals', () => {
        const owner = {}
        const interactive = {
            viewer: {id: 'interactive-viewer'},
            scene: {id: 'interactive-scene'},
            canvas: {id: 'interactive-canvas'},
        }
        const isolated = {
            viewer: {id: 'isolated-viewer'},
            scene: {id: 'isolated-scene'},
            canvas: {id: 'isolated-canvas'},
        }
        globalThis.lgs = interactive

        setReplayRenderTarget(owner, isolated)

        expect(replayRenderTargetFor(owner)).toBe(isolated)
        expect(replayViewerFor(owner)).toBe(isolated.viewer)
        expect(replaySceneFor(owner)).toBe(isolated.scene)
        expect(replayCanvasFor(owner)).toBe(isolated.canvas)
        expect(globalThis.lgs).toBe(interactive)
    })

    it('does not clear a newer target through a stale identity', () => {
        const owner = {}
        const staleTarget = {viewer: {id: 'stale'}}
        const activeTarget = {viewer: {id: 'active'}}
        setReplayRenderTarget(owner, staleTarget)
        setReplayRenderTarget(owner, activeTarget)

        expect(clearReplayRenderTarget(owner, staleTarget)).toBe(false)
        expect(replayRenderTargetFor(owner)).toBe(activeTarget)
        expect(clearReplayRenderTarget(owner, activeTarget)).toBe(true)
        expect(replayRenderTargetFor(owner)).toBeNull()
    })
})
