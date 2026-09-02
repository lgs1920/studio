/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetGroupUtils.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-02
 * Last modified: 2026-09-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

export const WIDGET_GROUP_PREFIX = 'widget-group'

/**
 * Create a new persistent widget group identifier.
 *
 * @returns {string} A unique widget group identifier.
 */
export const createWidgetGroupId = () => {
    const randomId = globalThis.crypto?.randomUUID?.()
        ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
    return `${WIDGET_GROUP_PREFIX}#${randomId}`
}

/**
 * Resolve the widget identifier carried by a timeline clip.
 *
 * @param {Object} clip - Public timeline clip.
 * @returns {string|null} Widget instance identifier.
 */
export const resolveWidgetIdFromClip = clip => clip?.metadata?.widgetId ?? clip?.widgetId ?? null

/**
 * Group ordered widget entries while preserving the first entry order.
 *
 * The input order is preserved inside each group. This lets callers provide
 * either bottom-to-top or top-to-bottom entries without changing the stack
 * semantics they already own.
 *
 * @param {Array} entries - Ordered widget entries.
 * @returns {Array} Ordered standalone and grouped entries.
 */
export const groupWidgetEntries = entries => {
    const grouped = new Map()
    const result = []

    for (const entry of entries ?? []) {
        const groupId = entry?.widgetGroup
        if (!groupId) {
            result.push(entry)
            continue
        }

        let group = grouped.get(groupId)
        if (!group) {
            group = {
                id: groupId,
                isGroup: true,
                label: entry?.id === groupId ? entry?.label ?? null : null,
                members: [],
                widgetGroup: groupId,
            }
            grouped.set(groupId, group)
            result.push(group)
        }
        group.members.push(entry)
        if (entry?.id === groupId && entry?.label) {
            group.label = entry.label
        }
    }

    return result
}

/**
 * Flatten standalone and grouped entries into widget instance identifiers.
 *
 * @param {Array} entries - Standalone and grouped entries.
 * @returns {Array<string>} Widget instance identifiers.
 */
export const flattenWidgetEntries = entries => (entries ?? []).flatMap(entry => {
    if (typeof entry === 'string') {
        return [entry]
    }
    return entry?.isGroup
        ? entry.members.map(member => member.id)
        : entry?.id ? [entry.id] : []
})

/**
 * Resolve group membership changes from the current public timeline tracks.
 *
 * A group is created solely when one timeline track contains more than one
 * widget clip. The number of distinct widget instances is intentionally not
 * considered, so several clips of one widget also create a group.
 *
 * @param {Array} tracks - Public timeline tracks.
 * @param {Map|Object} widgetList - Current widget entries keyed by instance ID.
 * @param {Function} [createGroupId] - Group identifier factory.
 * @returns {Map<string, string|null>} Widget group updates.
 */
export const resolveWidgetGroupUpdatesFromTracks = (
    tracks,
    widgetList = new Map(),
    createGroupId = createWidgetGroupId,
) => {
    const updates = new Map()
    const getWidgetEntry = widgetId => widgetList?.get?.(widgetId) ?? widgetList?.[widgetId]

    for (const track of tracks ?? []) {
        const widgetIds = (track?.clips ?? [])
            .map(resolveWidgetIdFromClip)
            .filter(Boolean)

        if (widgetIds.length === 0) {
            continue
        }

        if (widgetIds.length === 1) {
            updates.set(widgetIds[0], null)
            continue
        }

        const existingGroupId = widgetIds.find(widgetId => widgetId === track?.id)
            ?? widgetIds.find(widgetId => widgetId === track?.widgetGroup)
            ?? widgetIds.map(widgetId => getWidgetEntry(widgetId)?.widgetGroup)
                .find(groupId => widgetIds.includes(groupId))
            ?? widgetIds[0]
            ?? createGroupId()

        for (const widgetId of widgetIds) {
            updates.set(widgetId, existingGroupId)
        }
    }

    return updates
}

/**
 * Expand a public timeline track order into widget instance order.
 *
 * @param {Array<string>} trackIds - Timeline track identifiers, top to bottom.
 * @param {Map|Object} widgetList - Current widget entries keyed by instance ID.
 * @returns {Array<string>} Widget instance identifiers, top to bottom.
 */
export const expandTimelineTrackOrder = (trackIds, widgetList = new Map()) => {
    const entries = Array.from(widgetList?.entries?.() ?? Object.entries(widgetList ?? {}))
    const result = []

    for (const trackId of trackIds ?? []) {
        const members = entries
            .filter(([id, entry]) => id === trackId || entry?.widgetGroup === trackId)
            .sort(([, left], [, right]) => Number(right?.zIndex ?? 0) - Number(left?.zIndex ?? 0))
            .map(([id]) => id)
        result.push(...members)
    }

    return [...new Set(result)]
}
