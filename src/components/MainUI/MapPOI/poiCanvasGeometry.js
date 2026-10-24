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
 * Last modified: 2026-10-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Center the visible POI card on its geographic billboard anchor after canvas capture.
 *
 * @param {HTMLElement} element - The DOM element captured into the billboard canvas.
 * @param {number} canvasWidth - The captured canvas width in CSS pixels.
 * @returns {{x: number, y: number}} Billboard pixel offset that centers the visible card.
 */
export const calculatePOIContentPixelOffset = (element, canvasWidth) => {
    const card = element.querySelector('.poi-card-inner')
    const elementBounds = element.getBoundingClientRect()
    const cardBounds = card?.getBoundingClientRect()

    if (!cardBounds || !elementBounds.width || !Number.isFinite(canvasWidth) || canvasWidth <= 0) {
        return {x: 0, y: 0}
    }

    const cardCenterRatio = (
        (cardBounds.left + cardBounds.right) / 2 - elementBounds.left
    ) / elementBounds.width

    return {
        x: canvasWidth * (0.5 - cardCenterRatio),
        y: 0,
    }
}
