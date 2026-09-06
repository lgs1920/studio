/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LGS1920TimelineClipScroll.js
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

/**
 * Resolve a bounded scrolling speed from pointer proximity to a viewport edge.
 *
 * @param {number} coordinate - Pointer coordinate in CSS pixels.
 * @param {number} start - Viewport start coordinate.
 * @param {number} end - Viewport end coordinate.
 * @returns {number} Signed scrolling speed in pixels per second.
 */
export const resolveEdgeVelocity = (coordinate, start, end) => {
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0
    const threshold = Math.min(32, (end - start) / 3)
    if (coordinate < start + threshold) return -600 * Math.min(1, (start + threshold - coordinate) / threshold)
    if (coordinate > end - threshold) return 600 * Math.min(1, (coordinate - end + threshold) / threshold)
    return 0
}

/**
 * Scroll clip gestures at a zoom-independent, frame-rate-independent speed.
 *
 * @param {Object} dependencies - Viewport access, workspace extension and preview callbacks.
 * @returns {Object} Pointer update and cleanup operations.
 */
export const createTimelineClipScroll = ({getSurface, getTracksViewport, extendWorkspace, preview, canScrollHorizontal = () => true}) => {
    let frame = null
    let pointer = null
    let previousTime = null

    /** Stop the animation and release the retained pointer event. */
    const stop = () => {
        if (frame !== null) cancelAnimationFrame(frame)
        frame = null
        pointer = null
        previousTime = null
    }

    /**
     * Scroll both axes and refresh the edit with the stationary pointer.
     * @param {number} time - Animation timestamp in milliseconds.
     */
    const tick = time => {
        frame = -1
        const surface = getSurface()
        const tracksViewport = getTracksViewport()
        if (!pointer || !surface || !tracksViewport) return stop()
        const rect = surface.getBoundingClientRect()
        const tracksRect = tracksViewport.getBoundingClientRect()
        const horizontal = canScrollHorizontal() ? resolveEdgeVelocity(pointer.clientX, rect.left, rect.right) : 0
        const vertical = resolveEdgeVelocity(pointer.clientY, tracksRect.top, tracksRect.bottom)
        const elapsed = Math.min(50, Math.max(0, previousTime === null ? 16 : time - previousTime)) / 1000
        previousTime = time
        const horizontalStep = horizontal * elapsed
        const verticalStep = vertical * elapsed
        const previousLeft = surface.scrollLeft
        const previousTop = tracksViewport.scrollTop
        if (horizontalStep > 0) extendWorkspace(horizontalStep)
        surface.scrollLeft = Math.max(0, previousLeft + horizontalStep)
        tracksViewport.scrollTop = Math.max(0, previousTop + verticalStep)
        const movedHorizontally = surface.scrollLeft !== previousLeft
        const movedVertically = tracksViewport.scrollTop !== previousTop
        if (movedHorizontally || movedVertically) preview(pointer)
        if (pointer && ((horizontal !== 0 && movedHorizontally) || (vertical !== 0 && movedVertically))) {
            frame = requestAnimationFrame(tick)
        }
        else {
            frame = null
            previousTime = null
        }
    }

    /**
     * Retain the latest pointer coordinates and schedule edge scrolling.
     * @param {PointerEvent} event - Latest pointer event.
     */
    const update = event => {
        pointer = event
        if (frame === null) frame = requestAnimationFrame(tick)
    }

    return {update, stop}
}
