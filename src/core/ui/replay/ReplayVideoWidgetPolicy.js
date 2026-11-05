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
 * Last modified: 2026-11-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    COMPASS_WIDGET,
    CREDITS_WIDGET,
    LOGO_WIDGET,
    PROFILE_WIDGET,
    REPLAY_RECORDING_MONITOR_WIDGET_ID,
    REPLAY_TIMELINE_WIDGET,
    VIDEO_CROP_ZONE,
    VIDEO_WIDGETS_BOARD,
} from '@Core/constants'
import {getBasicReplaySettings} from './ReplayModeSettings'
import {currentReplayJourney, isJourneyReplayBasicMode} from './ReplayUserModeConstants'

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
    PROFILE_WIDGET,
])

/** Stable instance ID for the profile widget automatically added to Basic Replay. */
export const BASIC_REPLAY_PROFILE_WIDGET_ID = `${PROFILE_WIDGET}#basic-replay`

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
 * Resolve the per-Journey visibility preferences for Basic Replay widgets.
 * @param {Object|null} [journey=currentReplayJourney()] - Journey supplying Replay settings.
 * @returns {{showCompass: boolean, showProfile: boolean}} Basic widget visibility.
 */
export const getBasicReplayWidgetVisibility = (journey = currentReplayJourney()) => {
    const basic = getBasicReplaySettings(journey?.replay)
    return {
        showCompass: basic?.showCompass !== false,
        showProfile: basic?.showProfile !== false,
    }
}

/**
 * Resolve the instance ID used when Replay automatically registers a widget type.
 *
 * @param {string} widgetType - Widget type requested by Replay.
 * @param {Object} options - Registration options.
 * @param {boolean} [options.basicReplay] - Whether Basic Replay is active.
 * @returns {string} Widget type or mode-specific instance ID.
 */
export const getReplayVideoWidgetRegistrationId = (widgetType, {basicReplay = isBasicReplayActive()} = {}) => (
    basicReplay && widgetType === PROFILE_WIDGET
        ? BASIC_REPLAY_PROFILE_WIDGET_ID
        : widgetType
)

/**
 * Return the widget types that Replay must register for the active mode.
 *
 * @param {Object} options - Replay widget policy options.
 * @param {boolean} [options.basicReplay] - Whether Basic Replay is active.
 * @param {{showCompass: boolean, showProfile: boolean}} [options.widgetVisibility] - Per-Journey widget visibility.
 * @returns {string[]} Required widget type identifiers.
 */
export const getReplayVideoWidgetTypes = ({
    basicReplay = isBasicReplayActive(),
    widgetVisibility = getBasicReplayWidgetVisibility(),
} = {}) => basicReplay
    ? REPLAY_VIDEO_BASIC_WIDGET_TYPES.filter(widgetType => (
        (widgetType !== COMPASS_WIDGET || widgetVisibility.showCompass)
        && (widgetType !== PROFILE_WIDGET || widgetVisibility.showProfile)
    ))
    : REPLAY_VIDEO_WIDGET_TYPES

/**
 * Determine whether a widget instance may appear in the current Replay composition.
 * @param {string} widgetId - Widget type or instance identifier.
 * @param {Object} options - Replay mode and widget visibility options.
 * @param {boolean} [options.basicReplay] - Whether Basic Replay restrictions apply.
 * @param {{showCompass: boolean, showProfile: boolean}} [options.widgetVisibility] - Per-Journey widget visibility.
 * @returns {boolean} Whether the widget is included in Replay.
 */
export const isReplayVideoWidgetAllowed = (widgetId, {
    basicReplay = isBasicReplayActive(),
    widgetVisibility = getBasicReplayWidgetVisibility(),
} = {}) => {
    const widgetType = getReplayVideoWidgetType(widgetId)
    if (!widgetType || REPLAY_VIDEO_NON_CONTENT_TYPES.has(widgetType)
        || (!basicReplay && widgetId === BASIC_REPLAY_PROFILE_WIDGET_ID)
        || (basicReplay && widgetType === COMPASS_WIDGET && !widgetVisibility.showCompass)
        || (basicReplay && widgetType === PROFILE_WIDGET && !widgetVisibility.showProfile)) {
        return false
    }

    return basicReplay
        ? REPLAY_VIDEO_BASIC_WIDGET_TYPE_SET.has(widgetType)
        : true
}

/**
 * Filter and de-duplicate registered widget IDs for Replay composition.
 * @param {string[]} widgetKeys - Registered widget identifiers.
 * @param {Object} options - Replay mode and widget visibility options.
 * @param {boolean} [options.basicReplay] - Whether Basic Replay restrictions apply.
 * @param {{showCompass: boolean, showProfile: boolean}} [options.widgetVisibility] - Per-Journey widget visibility.
 * @returns {string[]} Widget identifiers allowed for Replay.
 */
export const filterReplayVideoWidgetKeys = (widgetKeys, options = {}) => {
    const basicReplay = options.basicReplay ?? isBasicReplayActive()
    const widgetVisibility = options.widgetVisibility ?? getBasicReplayWidgetVisibility()
    const seenBasicCompass = new Set()
    const seenBasicProfile = new Set()
    return [...new Set(widgetKeys ?? [])].filter(widgetId => {
        if (!isReplayVideoWidgetAllowed(widgetId, {basicReplay, widgetVisibility})) {
            return false
        }

        if (basicReplay && getReplayVideoWidgetType(widgetId) === COMPASS_WIDGET) {
            if (seenBasicCompass.has(COMPASS_WIDGET)) {
                return false
            }
            seenBasicCompass.add(COMPASS_WIDGET)
        }

        if (basicReplay && getReplayVideoWidgetType(widgetId) === PROFILE_WIDGET) {
            if (seenBasicProfile.has(PROFILE_WIDGET)) {
                return false
            }
            seenBasicProfile.add(PROFILE_WIDGET)
        }

        return true
    })
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
    const widgetVisibility = getBasicReplayWidgetVisibility()
    if (Array.isArray(widgetKeys)) {
        return filterReplayVideoWidgetKeys(widgetKeys, {basicReplay, widgetVisibility})
    }

    const entries = new Map(
        globalThis.lgs?.stores?.ui?.widget?.list?.entries?.()
        ?? [],
    )
    for (const [widgetId, entry] of globalThis.__?.ui?.widgetCache?.getAll?.({widgetsBoard})?.entries?.() ?? []) {
        entries.set(widgetId, {...entries.get(widgetId), ...entry})
    }

    const orderedWidgetIds = [...entries.entries()]
        .filter(([widgetId, entry]) => entry?.widgetsBoard === widgetsBoard
            && isReplayVideoWidgetAllowed(widgetId, {basicReplay, widgetVisibility}))
        .sort(([, left], [, right]) => (left?.zIndex || 0) - (right?.zIndex || 0))
        .map(([widgetId]) => widgetId)
    return filterReplayVideoWidgetKeys(orderedWidgetIds, {basicReplay, widgetVisibility})
}
