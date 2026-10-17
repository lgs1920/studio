/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayVideoWidgetPolicy.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-25
 * Last modified: 2026-10-17
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    COMPASS_WIDGET,
    CREDITS_WIDGET,
    LOGO_WIDGET,
    REPLAY_RECORDING_MONITOR_WIDGET_ID,
    REPLAY_TIMELINE_WIDGET,
    VIDEO_CROP_ZONE,
    VIDEO_WIDGETS_BOARD,
} from '@Core/constants'
import {isJourneyReplayBasicMode} from './ReplayUserModeConstants'

/**
 * Widget types that must be registered automatically on every Replay video
 * surface. Expert Replay accepts other content widgets already registered on
 * the video board and does not force the compass into the composition.
 *
 * These structural widgets belong to the capture/editor infrastructure and
 * must never be projected into the recorded image.
 */
export const REPLAY_VIDEO_WIDGET_TYPES = Object.freeze([
    CREDITS_WIDGET,
    LOGO_WIDGET,
])

/**
 * Widget types required by Basic Replay video composition.
 */
export const REPLAY_VIDEO_BASIC_WIDGET_TYPES = Object.freeze([
    COMPASS_WIDGET,
    CREDITS_WIDGET,
    LOGO_WIDGET,
])

const REPLAY_VIDEO_BASIC_WIDGET_TYPE_SET = new Set(REPLAY_VIDEO_BASIC_WIDGET_TYPES)

const REPLAY_VIDEO_NON_CONTENT_TYPES = new Set([
    VIDEO_CROP_ZONE,
    REPLAY_RECORDING_MONITOR_WIDGET_ID,
    REPLAY_TIMELINE_WIDGET,
])

export const getReplayVideoWidgetType = widgetId => typeof widgetId === 'string'
    ? widgetId.split('#')[0]
    : ''

const isBasicReplayActive = () => isJourneyReplayBasicMode()

/**
 * Return the widget types that Replay must register for the active mode.
 *
 * @param {Object} options - Replay widget policy options.
 * @param {boolean} [options.basicReplay] - Whether Basic Replay is active.
 * @returns {string[]} Required widget type identifiers.
 */
export const getReplayVideoWidgetTypes = ({basicReplay = isBasicReplayActive()} = {}) => (
    basicReplay ? REPLAY_VIDEO_BASIC_WIDGET_TYPES : REPLAY_VIDEO_WIDGET_TYPES
)

export const isReplayVideoWidgetAllowed = (widgetId, {basicReplay = isBasicReplayActive()} = {}) => {
    const widgetType = getReplayVideoWidgetType(widgetId)
    if (!widgetType || REPLAY_VIDEO_NON_CONTENT_TYPES.has(widgetType)) {
        return false
    }

    return basicReplay
        ? REPLAY_VIDEO_BASIC_WIDGET_TYPE_SET.has(widgetType)
        : true
}

export const filterReplayVideoWidgetKeys = (widgetKeys, options = {}) => {
    const basicReplay = options.basicReplay ?? isBasicReplayActive()
    return [...new Set(widgetKeys ?? [])]
        .filter(widgetId => isReplayVideoWidgetAllowed(widgetId, {basicReplay}))
}

/**
 * Return the currently registered video widget instances allowed in Replay.
 *
 * @param {Object} options - Widget lookup options.
 * @param {string[]|null} [options.widgetKeys=null] - Optional explicit IDs.
 * @param {string} [options.widgetsBoard=VIDEO_WIDGETS_BOARD] - Widget board.
 * @param {boolean|undefined} [options.basicReplay] - Restrict to Basic Replay widgets.
 * @returns {string[]} Allowed widget instance IDs.
 */
export const getReplayVideoWidgetKeys = ({
    widgetKeys = null,
    widgetsBoard = VIDEO_WIDGETS_BOARD,
    basicReplay = isBasicReplayActive(),
} = {}) => {
    if (Array.isArray(widgetKeys)) {
        return filterReplayVideoWidgetKeys(widgetKeys, {basicReplay})
    }

    const entries = new Map(
        globalThis.lgs?.stores?.ui?.widget?.list?.entries?.()
        ?? [],
    )
    for (const [widgetId, entry] of globalThis.__?.ui?.widgetCache?.getAll?.({widgetsBoard})?.entries?.() ?? []) {
        entries.set(widgetId, {...entries.get(widgetId), ...entry})
    }

    return [...entries.entries()]
        .filter(([widgetId, entry]) => entry?.widgetsBoard === widgetsBoard
            && isReplayVideoWidgetAllowed(widgetId, {basicReplay}))
        .sort(([, left], [, right]) => (left?.zIndex || 0) - (right?.zIndex || 0))
        .map(([widgetId]) => widgetId)
}
