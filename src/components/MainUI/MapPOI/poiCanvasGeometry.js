/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poiCanvasGeometry.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-24
 * Last modified: 2026-10-25
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Align the geographic POI anchor with its Cesium billboard position after canvas capture.
 *
 * @param {HTMLElement} element - The DOM element captured into the billboard canvas.
 * @param {number} canvasWidth - The captured canvas width in CSS pixels.
 * @param {number} canvasHeight - The captured canvas height in CSS pixels.
 * @returns {{x: number, y: number}} Billboard pixel offset that aligns the geographic anchor. Cesium uses screen
 *     coordinates for pixel offsets, so positive y moves the image down.
 */
export const calculatePOIContentPixelOffset = (element, canvasWidth, canvasHeight) => {
    const card = element.querySelector('.poi-card-inner')
    const anchor = element.querySelector('.poi-geographic-anchor')
    const elementBounds = element.getBoundingClientRect()
    const cardBounds = card?.getBoundingClientRect()
    const anchorBounds = anchor?.getBoundingClientRect()
    const anchorX = anchorBounds
        ? anchorBounds.left
        : cardBounds
            ? (cardBounds.left + cardBounds.right) / 2
            : null
    const anchorY = anchorBounds ? anchorBounds.top : elementBounds.bottom

    if (anchorX === null
        || !elementBounds.width
        || !elementBounds.height
        || !Number.isFinite(canvasWidth)
        || canvasWidth <= 0
        || !Number.isFinite(canvasHeight)
        || canvasHeight <= 0) {
        return {x: 0, y: 0}
    }

    const anchorRatio = (anchorX - elementBounds.left) / elementBounds.width
    const anchorVerticalRatio = (anchorY - elementBounds.top) / elementBounds.height

    return {
        x: canvasWidth * (0.5 - anchorRatio),
        y: canvasHeight * (0.5 - anchorVerticalRatio),
    }
}
