/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: journeyStatsTextOrder.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-03
 * Last modified: 2026-05-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

export const JOURNEY_STATS_TEXT_ITEMS = [
    {id: 'date', label: 'Date-Time', icon: 'calendar-days', group: 'meta'},
    {id: 'location', label: 'Location', icon: 'location-dot', group: 'meta'},
    {id: 'distance', label: 'Distance', icon: 'route', group: 'summary'},
    {id: 'elevation', label: 'Elevation', icon: 'mountain', group: 'summary'},
    {id: 'duration', label: 'Duration', icon: 'clock', group: 'summary'},
    {id: 'altitude', label: 'Altitude', icon: 'mountain-sun', group: 'altitude'},
    {id: 'speed', label: 'Speed', icon: 'gauge-high', group: 'performance'},
    {id: 'pace', label: 'Pace', icon: 'stopwatch', group: 'performance'},
]

export const JOURNEY_STATS_SUMMARY_TEXT_IDS = ['distance', 'elevation', 'duration']

export const JOURNEY_STATS_SUMMARY_TEXT_ID_SET = new Set(JOURNEY_STATS_SUMMARY_TEXT_IDS)

export const DEFAULT_JOURNEY_STATS_DATE_TIME_STACK = true

export const DEFAULT_JOURNEY_STATS_TEXT_ORDER = JOURNEY_STATS_TEXT_ITEMS.map(item => item.id)

export const JOURNEY_STATS_TEXT_ITEM_MAP = new Map(
    JOURNEY_STATS_TEXT_ITEMS.map(item => [item.id, item]),
)

export const normalizeJourneyStatsTextOrder = (order) => {
    const seen = new Set()
    const source = Array.isArray(order) ? [...order, ...DEFAULT_JOURNEY_STATS_TEXT_ORDER] : DEFAULT_JOURNEY_STATS_TEXT_ORDER

    return source.filter(id => {
        if (!JOURNEY_STATS_TEXT_ITEM_MAP.has(id) || seen.has(id)) {
            return false
        }

        seen.add(id)
        return true
    })
}

export const orderedJourneyStatsTextItems = order =>
    normalizeJourneyStatsTextOrder(order).map(id => JOURNEY_STATS_TEXT_ITEM_MAP.get(id))

export const isJourneyStatsSummaryTextItem = id => JOURNEY_STATS_SUMMARY_TEXT_ID_SET.has(id)

export const isJourneyStatsTextItemEnabled = (element = {}, id, {hasJourneyDate = true} = {}) => {
    switch (id) {
        case 'date':
            return hasJourneyDate && element.date === true
        case 'location':
            return element.location === true
        case 'distance':
        case 'elevation':
        case 'duration':
            return element[id] !== false
        case 'altitude':
            return element.altitude === true
        case 'speed':
        case 'pace':
            return element.performance === true
        default:
            return true
    }
}

export const normalizeJourneyStatsSummaryBreaks = breaks => {
    const seen = new Set()
    const source = Array.isArray(breaks) ? breaks : []

    return source.filter(id => {
        if (!JOURNEY_STATS_SUMMARY_TEXT_ID_SET.has(id) || seen.has(id)) {
            return false
        }

        seen.add(id)
        return true
    })
}
