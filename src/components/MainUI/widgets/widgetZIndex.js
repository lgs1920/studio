/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

const ALWAYS_ON_TOP_WIDGET_TYPES = new Set(['credits-widget', 'logo-widget'])

export const resolveActiveWidgetZIndex = ({widgetId, widgetListSnapshot, config, widgetDefinition}) => {
    const storedZIndex = widgetListSnapshot.get(widgetId)?.zIndex ?? config.zIndex
    if (widgetDefinition?.alwaysOnTop !== true && !ALWAYS_ON_TOP_WIDGET_TYPES.has(widgetId?.split('#')[0])) {
        return storedZIndex
    }

    const highestRegularZIndex = Array.from(widgetListSnapshot.entries()).reduce((highest, [id, entry]) => {
        if (ALWAYS_ON_TOP_WIDGET_TYPES.has(id.split('#')[0])) {
            return highest
        }

        const zIndex = Number(entry?.zIndex)
        return Number.isFinite(zIndex) ? Math.max(highest, zIndex) : highest
    }, 0)

    const currentZIndex = Number(storedZIndex)
    return Math.max(Number.isFinite(currentZIndex) ? currentZIndex : 0, highestRegularZIndex + 1)
}
