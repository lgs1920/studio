/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

const ALWAYS_ON_TOP_WIDGET_TYPES = new Set(['credits-widget', 'logo-widget'])
const TOPMOST_WIDGET_TYPES = new Set(['replay-timeline-widget'])

export const resolveActiveWidgetZIndex = ({widgetId, widgetListSnapshot, config, widgetDefinition}) => {
    const widgetType = widgetId?.split('#')[0]
    const storedZIndex = widgetListSnapshot.get(widgetId)?.zIndex ?? config.zIndex
    const isTopmost = TOPMOST_WIDGET_TYPES.has(widgetType)
    const isAlwaysOnTop = widgetDefinition?.alwaysOnTop === true || ALWAYS_ON_TOP_WIDGET_TYPES.has(widgetType)
    if (!isAlwaysOnTop && !isTopmost) {
        return storedZIndex
    }

    const highestRegularZIndex = Array.from(widgetListSnapshot.entries()).reduce((highest, [id, entry]) => {
        const entryType = id.split('#')[0]
        if (ALWAYS_ON_TOP_WIDGET_TYPES.has(entryType) || TOPMOST_WIDGET_TYPES.has(entryType)) {
            return highest
        }

        const zIndex = Number(entry?.zIndex)
        return Number.isFinite(zIndex) ? Math.max(highest, zIndex) : highest
    }, 0)

    const currentZIndex = Number(storedZIndex)
    const regularTopZIndex = Math.max(Number.isFinite(currentZIndex) ? currentZIndex : 0, highestRegularZIndex + 1)

    if (isTopmost) {
        const highestOtherZIndex = Array.from(widgetListSnapshot.entries()).reduce((highest, [id, entry]) => {
            if (id === widgetId) {
                return highest
            }

            const zIndex = Number(entry?.zIndex)
            return Number.isFinite(zIndex) ? Math.max(highest, zIndex) : highest
        }, 0)

        return Math.max(Number.isFinite(currentZIndex) ? currentZIndex : 0, highestOtherZIndex + 1)
    }

    const hasTopmostWidget = Array.from(widgetListSnapshot.keys()).some(id => TOPMOST_WIDGET_TYPES.has(id.split('#')[0]))
    if (!hasTopmostWidget) {
        return regularTopZIndex
    }

    const topmostPersistedZIndex = Array.from(widgetListSnapshot.entries()).reduce((highest, [id, entry]) => {
        if (!TOPMOST_WIDGET_TYPES.has(id.split('#')[0])) {
            return highest
        }

        const zIndex = Number(entry?.zIndex)
        return Number.isFinite(zIndex) ? Math.max(highest, zIndex) : highest
    }, 0)
    const highestBelowTopmost = Array.from(widgetListSnapshot.entries()).reduce((highest, [id, entry]) => {
        if (TOPMOST_WIDGET_TYPES.has(id.split('#')[0])) {
            return highest
        }

        const zIndex = Number(entry?.zIndex)
        return Number.isFinite(zIndex) ? Math.max(highest, zIndex) : highest
    }, 0)
    const topmostZIndex = Math.max(topmostPersistedZIndex, highestBelowTopmost + 1)

    return Math.min(regularTopZIndex, topmostZIndex - 1)
}
