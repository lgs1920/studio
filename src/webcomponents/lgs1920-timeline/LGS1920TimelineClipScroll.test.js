/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LGS1920TimelineClipScroll.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-06
 * Last modified: 2026-09-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, describe, expect, it, vi} from 'vitest'
import {createTimelineClipScroll, resolveEdgeVelocity} from './LGS1920TimelineClipScroll'

afterEach(() => vi.unstubAllGlobals())

/** Create bounded browser-like scroll surfaces and a manually driven animation queue. */
const setup = ({allowExtension = true} = {}) => {
    const queue = new Map()
    let identifier = 0
    vi.stubGlobal('requestAnimationFrame', callback => {
        identifier += 1
        queue.set(identifier, callback)
        return identifier
    })
    vi.stubGlobal('cancelAnimationFrame', key => queue.delete(key))
    let scrollLeft = 0
    let maximumLeft = 100
    let scrollTop = 0
    const surface = {
        get scrollLeft() { return scrollLeft },
        set scrollLeft(value) { scrollLeft = Math.max(0, Math.min(maximumLeft, value)) },
        getBoundingClientRect: () => ({left: 0, right: 200}),
    }
    const tracks = {
        get scrollTop() { return scrollTop },
        set scrollTop(value) { scrollTop = Math.max(0, Math.min(500, value)) },
        getBoundingClientRect: () => ({top: 40, bottom: 160}),
    }
    const preview = vi.fn()
    const extendWorkspace = vi.fn(pixels => {
        if (allowExtension) maximumLeft = Math.max(maximumLeft, scrollLeft + pixels)
    })
    const controller = createTimelineClipScroll({
        getSurface: () => surface,
        getTracksViewport: () => tracks,
        extendWorkspace,
        preview,
    })
    /** Advance exactly one scheduled animation frame. */
    const advance = time => {
        const entry = queue.entries().next().value
        if (!entry) return
        queue.delete(entry[0])
        entry[1](time)
    }
    return {surface, tracks, controller, preview, extendWorkspace, advance, queue}
}

describe('clip edge scrolling', () => {
    it('uses a bounded speed that increases toward the viewport edge', () => {
        expect(resolveEdgeVelocity(100, 0, 200)).toBe(0)
        expect(resolveEdgeVelocity(184, 0, 200)).toBe(300)
        expect(resolveEdgeVelocity(200, 0, 200)).toBe(600)
        expect(resolveEdgeVelocity(-100, 0, 200)).toBe(-600)
        expect(resolveEdgeVelocity(0, 0, 0)).toBe(0)
    })

    it('extends a bounded horizontal surface and reaches vertically hidden tracks', () => {
        const {controller, advance, surface, tracks, preview, extendWorkspace} = setup()
        controller.update({clientX: 200, clientY: 160})
        Array.from({length: 20}, (_, index) => advance(index * 16))
        expect(surface.scrollLeft).toBeGreaterThan(100)
        expect(tracks.scrollTop).toBeGreaterThan(100)
        expect(preview).toHaveBeenCalledTimes(20)
        expect(extendWorkspace).toHaveBeenCalled()
        controller.stop()
    })

    it('maintains one frame loop when preview updates the retained pointer', () => {
        const {controller, advance, preview, queue} = setup()
        preview.mockImplementation(event => controller.update(event))
        controller.update({clientX: 200, clientY: 100})
        advance(0)
        expect(queue.size).toBe(1)
        advance(16)
        expect(queue.size).toBe(1)
        controller.stop()
        expect(queue.size).toBe(0)
    })

    it('limits a delayed frame and stops when the pointer returns to the center', () => {
        const {controller, advance, surface, queue} = setup()
        controller.update({clientX: 200, clientY: 100})
        advance(0)
        const previous = surface.scrollLeft
        advance(10_000)
        expect(surface.scrollLeft - previous).toBeLessThanOrEqual(30)
        controller.update({clientX: 100, clientY: 100})
        advance(10_016)
        expect(queue.size).toBe(0)
    })

    it('stops at a viewport boundary instead of spinning an idle animation', () => {
        const {controller, advance, surface, queue} = setup({allowExtension: false})
        surface.scrollLeft = 100
        controller.update({clientX: 200, clientY: 100})
        advance(0)
        expect(queue.size).toBe(0)
    })
})
