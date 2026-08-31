/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: drawerResize.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { END, START } from '@Core/constants'

export const DRAWER_RESIZE_DEFAULT_WIDTH = 448
export const DRAWER_RESIZE_MIN_WIDTH = DRAWER_RESIZE_DEFAULT_WIDTH
export const DRAWER_RESIZE_MAX_WIDTH = 720
export const DRAWER_RESIZE_MAX_VIEWPORT_RATIO = 0.7
export const DRAWER_RESIZE_HANDLE_WIDTH = 5
export const DRAWER_RESIZE_FAST_DISTANCE = 80
export const DRAWER_RESIZE_FAST_DURATION = 220
export const DRAWER_RESIZE_FAST_SPEED = 0.5
export const DRAWER_RESIZE_KEYBOARD_STEP = 16
export const DRAWER_RESIZE_KEYBOARD_LARGE_STEP = 64

/**
 * Returns the viewport width used to calculate drawer bounds.
 *
 * @returns {number} Current viewport width or a desktop fallback.
 */
const getViewportWidth = () => typeof window !== 'undefined' && Number.isFinite(window.innerWidth)
    ? window.innerWidth
    : 1280

/**
 * Returns the viewport height used to resolve CSS-like maximum dimensions.
 *
 * @returns {number} Current viewport height or a desktop fallback.
 */
const getViewportHeight = () => typeof window !== 'undefined' && Number.isFinite(window.innerHeight)
    ? window.innerHeight
    : 720

/**
 * Resolves a numeric pixel value or a supported viewport dimension.
 *
 * @param {number|string} value - Maximum width value.
 * @param {number} viewportWidth - Current viewport width.
 * @returns {number|null} Resolved pixel value.
 */
const resolveMaximumWidth = (value, viewportWidth) => {
    if (Number.isFinite(value) && value > 0) {
        return value
    }

    if (typeof value !== 'string') {
        return null
    }

    const match = value.trim().match(/^([0-9]+(?:\.[0-9]+)?)(px|vw|vh)$/i)
    if (!match) {
        return null
    }

    const amount = Number(match[1])
    const unit = match[2].toLowerCase()
    const reference = unit === 'vw' ? viewportWidth : unit === 'vh' ? getViewportHeight() : 1
    const pixels = unit === 'px' ? amount : reference * amount / 100

    return Number.isFinite(pixels) && pixels > 0 ? pixels : null
}

/**
 * Checks whether a drawer placement can be resized horizontally.
 *
 * @param {string} placement - Web Awesome drawer placement.
 * @returns {boolean} Whether the placement is a side placement.
 */
export const isResizableDrawerPlacement = placement => placement === START || placement === END

/**
 * Calculates the minimum and maximum width allowed for a side drawer.
 *
 * @param {number} [viewportWidth] - Width of the current viewport in pixels.
 * @param {number|string} [maximumWidth] - Optional drawer-specific maximum in pixels or `px`, `vw`, or `vh`.
 * @returns {{min: number, max: number}} Width bounds in pixels.
 */
export const getDrawerResizeBounds = (viewportWidth = getViewportWidth(), maximumWidth) => {
    const safeViewportWidth = Number.isFinite(viewportWidth) && viewportWidth > 0
        ? viewportWidth
        : getViewportWidth()
    const safeMaximumWidth = resolveMaximumWidth(maximumWidth, safeViewportWidth) ?? DRAWER_RESIZE_MAX_WIDTH
    const viewportMaximum = maximumWidth === undefined
        ? safeViewportWidth * DRAWER_RESIZE_MAX_VIEWPORT_RATIO
        : safeViewportWidth
    const maximum = Math.floor(Math.min(
        viewportMaximum,
        safeMaximumWidth,
    ))

    return {
        min: DRAWER_RESIZE_MIN_WIDTH,
        max: Math.max(DRAWER_RESIZE_MIN_WIDTH, maximum),
    }
}

/**
 * Clamps a requested drawer width to the supplied bounds.
 *
 * @param {number} width - Requested width in pixels.
 * @param {{min: number, max: number}} [bounds] - Width bounds.
 * @returns {number} Safe integer width in pixels.
 */
export const clampDrawerWidth = (width, bounds = getDrawerResizeBounds()) => {
    const safeWidth = Number.isFinite(width) ? width : DRAWER_RESIZE_DEFAULT_WIDTH
    const minimum = Math.min(bounds.min, bounds.max)
    const maximum = Math.max(bounds.min, bounds.max)

    return Math.round(Math.min(maximum, Math.max(minimum, safeWidth)))
}

/**
 * Calculates the width delta produced by a horizontal pointer movement.
 *
 * @param {string} placement - Web Awesome drawer placement.
 * @param {number} startX - Pointer position when resizing started.
 * @param {number} currentX - Current pointer position.
 * @returns {number} Width delta in pixels.
 */
export const getDrawerResizeDelta = (placement, startX, currentX) => placement === START
    ? currentX - startX
    : startX - currentX

/**
 * Calculates the outward distance for a fast side-drawer gesture.
 *
 * @param {string} placement - Web Awesome drawer placement.
 * @param {number} startX - Pointer position when resizing started.
 * @param {number} currentX - Current pointer position.
 * @returns {number} Outward movement in pixels.
 */
export const getDrawerOutwardDistance = (placement, startX, currentX) => Math.max(
    0,
    getDrawerResizeDelta(placement, startX, currentX),
)

/**
 * Determines whether a pointer gesture qualifies for fast expansion.
 *
 * @param {Object} gesture - Gesture measurements.
 * @param {number} gesture.distance - Outward distance in pixels.
 * @param {number} gesture.duration - Gesture duration in milliseconds.
 * @returns {boolean} Whether the gesture should expand to the maximum width.
 */
export const qualifiesForFastDrawerExpansion = ({distance, duration} = {}) => {
    if (!Number.isFinite(distance) || !Number.isFinite(duration) || duration <= 0) {
        return false
    }

    return distance >= DRAWER_RESIZE_FAST_DISTANCE
        && duration <= DRAWER_RESIZE_FAST_DURATION
        && distance / duration >= DRAWER_RESIZE_FAST_SPEED
}
