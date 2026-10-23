/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TrackEndCapUtils.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-23
 * Last modified: 2026-10-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

const polylineEndCapImageCache = new Map()

/**
 * Convert a Cesium or CSS color to a value supported by SVG fill attributes.
 *
 * @param {object|string} color - Color to serialize for the generated SVG.
 * @returns {string} SVG-compatible CSS color.
 */
const colorToSvg = color => {
    if (typeof color === 'string') {
        return color
    }

    return typeof color?.toCssColorString === 'function' ? color.toCssColorString() : 'transparent'
}

/**
 * Build a transparent semicircular end-cap image with a colored border and fill.
 *
 * @param {object} options - Line widths and colors used by the end cap.
 * @param {number} options.fillWidth - Width of the inner line in screen pixels.
 * @param {number} options.borderWidth - Width of the outer line in screen pixels.
 * @param {object|string} options.fillColor - Cesium or CSS fill color.
 * @param {object|string} options.borderColor - Cesium or CSS border color.
 * @returns {string} SVG data URL for a right-facing semicircle whose flat edge meets the line endpoint.
 */
export const createPolylineEndCapImage = ({fillWidth, borderWidth, fillColor, borderColor}) => {
    const fillColorCss = colorToSvg(fillColor)
    const borderColorCss = colorToSvg(borderColor)
    const fillRatio = Number.isFinite(fillWidth) && Number.isFinite(borderWidth) && borderWidth > 0
        ? Math.min(1, Math.max(0, fillWidth / borderWidth))
        : 0
    const cacheKey = `${borderColorCss}|${fillColorCss}|${fillRatio.toFixed(4)}`
    const cachedImage = polylineEndCapImageCache.get(cacheKey)
    if (cachedImage) {
        return cachedImage
    }

    const innerRadius = 64 * fillRatio
    const innerPath = innerRadius > 0
        ? `<path d="M 0 ${64 - innerRadius} A ${innerRadius} ${innerRadius} 0 0 1 0 ${64 + innerRadius} Z" fill="${fillColorCss}"/>`
        : ''
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="128" viewBox="0 0 64 128"><path d="M 0 0 A 64 64 0 0 1 0 128 Z" fill="${borderColorCss}"/>${innerPath}</svg>`
    const image = `data:image/svg+xml,${encodeURIComponent(svg)}`

    if (polylineEndCapImageCache.size >= 128) {
        polylineEndCapImageCache.clear()
    }
    polylineEndCapImageCache.set(cacheKey, image)
    return image
}

/**
 * Compute the screen-space rotation that points an endpoint cap away from its line.
 *
 * @param {object} scene - Cesium scene used to project the line onto the canvas.
 * @param {Array<Cartesian3>} positions - Positions that form the rendered line.
 * @param {'start'|'end'} end - Endpoint whose outward tangent is being resolved.
 * @returns {number} Cesium billboard rotation in radians, or zero when projection is unavailable.
 */
export const getPolylineEndCapRotation = (scene, positions, end) => {
    if (!Array.isArray(positions) || positions.length < 2 || typeof scene?.cartesianToCanvasCoordinates !== 'function') {
        return 0
    }

    const endpointIndex = end === 'start' ? 0 : positions.length - 1
    const neighborIndex = end === 'start' ? 1 : positions.length - 2
    const endpoint = scene.cartesianToCanvasCoordinates(positions[endpointIndex])
    const neighbor = scene.cartesianToCanvasCoordinates(positions[neighborIndex])
    if (!endpoint || !neighbor) {
        return 0
    }

    const deltaX = endpoint.x - neighbor.x
    const deltaY = endpoint.y - neighbor.y
    if (deltaX === 0 && deltaY === 0) {
        return 0
    }

    return Math.atan2(-deltaY, deltaX)
}
