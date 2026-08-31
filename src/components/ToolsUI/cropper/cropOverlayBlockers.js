/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: cropOverlayBlockers.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-22
 * Last modified: 2026-08-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Builds the transparent hit-test regions surrounding a crop window.
 *
 * The returned regions must remain outside the element using the crop
 * `clip-path`; otherwise the browser clips the hit-test regions together with
 * the visual overlay.
 *
 * @param {Object} crop - Crop dimensions relative to the overlay container.
 * @returns {Array<{className: string, style: Object}>} Blocker descriptors.
 */
export const buildCropOverlayBlockers = crop => {
    const left = Number.isFinite(crop?.left) ? Math.max(0, Math.round(crop.left)) : 0
    const top = Number.isFinite(crop?.top) ? Math.max(0, Math.round(crop.top)) : 0
    const width = Number.isFinite(crop?.width) ? Math.max(0, Math.round(crop.width)) : 0
    const height = Number.isFinite(crop?.height) ? Math.max(0, Math.round(crop.height)) : 0

    if (width <= 0 || height <= 0) {
        return []
    }

    return [
        {
            className: 'crop-overlay-blocker crop-overlay-blocker-top',
            style: {
                left:   0,
                top:    0,
                right:  0,
                height: `${top}px`,
            },
        },
        {
            className: 'crop-overlay-blocker crop-overlay-blocker-left',
            style: {
                left:   0,
                top:    `${top}px`,
                width:  `${left}px`,
                height: `${height}px`,
            },
        },
        {
            className: 'crop-overlay-blocker crop-overlay-blocker-right',
            style: {
                left:   `${left + width}px`,
                top:    `${top}px`,
                right:  0,
                height: `${height}px`,
            },
        },
        {
            className: 'crop-overlay-blocker crop-overlay-blocker-bottom',
            style: {
                left:   0,
                top:    `${top + height}px`,
                right:  0,
                bottom: 0,
            },
        },
    ]
}
