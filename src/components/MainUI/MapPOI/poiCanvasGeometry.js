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
 * Last modified: 2026-10-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Resolve the POI geographic anchor from the same DOM bounds used by the Cesium billboard.
 *
 * @param {{left: number, top: number, right: number, bottom: number}} elementBounds - POI wrapper bounds.
 * @param {{left: number, right: number}|undefined} cardBounds - POI card bounds, when present.
 * @param {{left: number, top: number}|undefined} anchorBounds - Explicit expanded POI anchor, when present.
 * @returns {{x: number|null, y: number}} Geographic anchor in viewport pixels.
 */
export const calculatePOIContentAnchor = (elementBounds, cardBounds, anchorBounds) => ({
    x: anchorBounds
        ? anchorBounds.left
        : cardBounds
            ? (cardBounds.left + cardBounds.right) / 2
            : null,
    y: anchorBounds ? anchorBounds.top : elementBounds.bottom,
})

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
    const elementBounds = element.getBoundingClientRect()
    const cardBounds = element.querySelector('.poi-card-inner')?.getBoundingClientRect()
    const anchorBounds = element.querySelector('.poi-geographic-anchor')?.getBoundingClientRect()
    const {x: anchorX, y: anchorY} = calculatePOIContentAnchor(elementBounds, cardBounds, anchorBounds)

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
