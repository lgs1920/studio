/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: widgetAvailability.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-02
 * Last modified on: 2026-07-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { SCENE_WIDGETS_BOARD, VIDEO_WIDGETS_BOARD } from '@Core/constants'

const WIDGET_AVAILABILITY_RESOLVERS = {
    flythroughRecordingSync: () => globalThis.lgs?.stores?.flythrough?.recordingSync === true,
    hasJourney: () => Boolean(globalThis.lgs?.theJourney),
}

const normalizeBoard = (board) => {
    if (!board) {
        return null
    }

    if (board === VIDEO_WIDGETS_BOARD || board === 'video') {
        return 'video'
    }

    if (board === SCENE_WIDGETS_BOARD || board === 'scene') {
        return 'scene'
    }

    return board
}

export const isWidgetAvailable = (widgetDef, {widgetsBoard = null} = {}) => {
    if (!widgetDef) {
        return false
    }

    const availability = widgetDef.availability ?? null
    if (!availability) {
        return true
    }

    const allowedBoards = Array.isArray(availability.boards) ? availability.boards : null
    if (allowedBoards) {
        const normalizedCurrentBoard = normalizeBoard(widgetsBoard)
        const normalizedAllowedBoards = new Set(allowedBoards.map(normalizeBoard).filter(Boolean))
        if (!normalizedCurrentBoard || !normalizedAllowedBoards.has(normalizedCurrentBoard)) {
            return false
        }
    }

    const requiredFlags = Array.isArray(availability.requires) ? availability.requires : []
    for (const flag of requiredFlags) {
        const resolver = WIDGET_AVAILABILITY_RESOLVERS[flag]
        if (!resolver) {
            continue
        }

        if (!resolver({widgetsBoard})) {
            return false
        }
    }

    return true
}
