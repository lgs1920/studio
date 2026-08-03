/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CompassWidgetBounds.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-08-03
 * Last modified: 2026-08-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Resolves the widget dimensions without replacing dimensions restored from persistence.
 *
 * @param {Object} options - Dimension resolution options.
 * @param {Object} options.config - Runtime widget configuration.
 * @param {boolean} options.forceResize - Whether the visual mode has changed.
 * @param {number} options.styledWidth - Width read from the rendered compass.
 * @param {number} options.styledHeight - Height read from the rendered compass.
 * @param {number} options.fallbackWidth - Fallback width when no styled width exists.
 * @param {number} options.fallbackHeight - Fallback height when no styled height exists.
 * @returns {{width: number, height: number}} Resolved logical widget dimensions.
 */
export const resolveCompassWidgetDimensions = ({
    config,
    forceResize,
    styledWidth,
    styledHeight,
    fallbackWidth,
    fallbackHeight,
}) => {
    const persistedWidth = Number(config?.dimensions?.width)
    const persistedHeight = Number(config?.dimensions?.height)
    const hasPersistedDimensions = Number.isFinite(persistedWidth) && persistedWidth > 0 &&
        Number.isFinite(persistedHeight) && persistedHeight > 0

    if (forceResize !== true && hasPersistedDimensions) {
        return {width: persistedWidth, height: persistedHeight}
    }

    return {
        width:  Number.isFinite(styledWidth) && styledWidth > 0 ? styledWidth : fallbackWidth,
        height: Number.isFinite(styledHeight) && styledHeight > 0 ? styledHeight : fallbackHeight,
    }
}
