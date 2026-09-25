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
 * Last modified: 2026-09-25
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    COMPASS_WIDGET,
    CREDITS_WIDGET,
    LOGO_WIDGET,
    VIDEO_WIDGETS_BOARD,
} from '@Core/constants'

/**
 * Widget types that may be present on a Replay video surface.
 *
 * Credits and Logo are composition infrastructure. Compass is the only
 * user-facing widget retained for Replay preparation and capture.
 */
export const REPLAY_VIDEO_WIDGET_TYPES = Object.freeze([
    COMPASS_WIDGET,
    CREDITS_WIDGET,
    LOGO_WIDGET,
])

const REPLAY_VIDEO_WIDGET_TYPE_SET = new Set(REPLAY_VIDEO_WIDGET_TYPES)

export const getReplayVideoWidgetType = widgetId => typeof widgetId === 'string'
    ? widgetId.split('#')[0]
    : ''

export const isReplayVideoWidgetAllowed = widgetId => REPLAY_VIDEO_WIDGET_TYPE_SET.has(
    getReplayVideoWidgetType(widgetId),
)

export const filterReplayVideoWidgetKeys = widgetKeys => [...new Set(widgetKeys ?? [])]
    .filter(isReplayVideoWidgetAllowed)

/**
 * Return the currently registered video widget instances allowed in Replay.
 *
 * @param {Object} options - Widget lookup options.
 * @param {string[]|null} [options.widgetKeys=null] - Optional explicit IDs.
 * @param {string} [options.widgetsBoard=VIDEO_WIDGETS_BOARD] - Widget board.
 * @returns {string[]} Allowed widget instance IDs.
 */
export const getReplayVideoWidgetKeys = ({
    widgetKeys = null,
    widgetsBoard = VIDEO_WIDGETS_BOARD,
} = {}) => {
    if (Array.isArray(widgetKeys)) {
        return filterReplayVideoWidgetKeys(widgetKeys)
    }

    return [...(globalThis.__?.ui?.widgetCache?.getAll?.({widgetsBoard})?.entries?.() ?? [])]
        .filter(([widgetId]) => isReplayVideoWidgetAllowed(widgetId))
        .sort(([, left], [, right]) => (left?.zIndex || 0) - (right?.zIndex || 0))
        .map(([widgetId]) => widgetId)
}
