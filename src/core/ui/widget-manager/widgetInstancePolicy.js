/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: widgetInstancePolicy.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-22
 * Last modified: 2026-10-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Resolve the maximum number of instances declared by a widget catalog entry.
 * @param {Object|null} widgetDefinition - Catalog definition for the widget.
 * @returns {number} Positive integer instance limit, defaulting to one.
 */
export const resolveWidgetInstanceLimit = widgetDefinition => {
    const limit = Number(widgetDefinition?.max)
    return Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 1
}

/**
 * Count concrete instances of one widget on the requested board.
 * @param {Object} options - Widget identity, catalog entry, runtime cache, and board.
 * @param {string} options.widgetId - Catalog widget ID or concrete instance ID.
 * @param {Object|null} options.widgetDefinition - Catalog definition for the widget.
 * @param {Map<string, Object>} options.widgetCache - Runtime widget registrations.
 * @param {string|undefined} [options.widgetsBoard] - Optional board filter.
 * @returns {{count: number, max: number, remaining: number, maxReached: boolean}} Instance statistics.
 */
export const getWidgetInstanceStats = ({
    widgetId,
    widgetDefinition,
    widgetCache,
    widgetsBoard,
}) => {
    const baseId = String(widgetId ?? '').split('#')[0]
    const max = resolveWidgetInstanceLimit(widgetDefinition)
    let count = 0

    for (const [id, entry] of widgetCache?.entries?.() ?? []) {
        if (!id || String(id).split('#')[0] !== baseId) {
            continue
        }
        if (widgetsBoard !== undefined && entry?.widgetsBoard !== widgetsBoard) {
            continue
        }
        count++
    }

    return {
        count,
        max,
        remaining:  Math.max(0, max - count),
        maxReached: count >= max,
    }
}
