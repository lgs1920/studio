/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: resolveWidgetCatalogGroup.js
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

import {JOURNEY_WIDGETS, SCENE_WIDGETS, SCENE_WIDGETS_BOARD} from '@Core/constants'

/**
 * Resolve a widget's owning catalogue group for its target board.
 * Persisted registrations may be absent or stale when a timeline restores an instance.
 *
 * @param {string} widgetId - Concrete widget instance or base type.
 * @param {Object} options - Registration options.
 * @param {string|null} [options.widgetsBoard=null] - Target widget board.
 * @param {string|null} [options.group=null] - Preferred existing registration group.
 * @returns {string|null} A catalogue group that actually contains the widget type.
 */
export const resolveWidgetCatalogGroup = (widgetId, {widgetsBoard = null, group = null} = {}) => {
    const type = String(widgetId ?? '').split('#')[0]
    const catalog = globalThis.__?.widgets
    const groups = Array.from(catalog?.entries?.() ?? [])
        .filter(([, entry]) => entry?.widgets?.has(type))
        .map(([groupId]) => groupId)
    const preferred = [
        group,
        globalThis.lgs?.stores?.ui?.widget?.list?.get?.(widgetId)?.group,
        globalThis.__?.ui?.widgetCache?.get?.(widgetId)?.group,
        widgetsBoard === SCENE_WIDGETS_BOARD ? SCENE_WIDGETS : JOURNEY_WIDGETS,
    ]

    return preferred.find(groupId => groups.includes(groupId)) ?? groups[0] ?? null
}
