/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: textWidgetPosition.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-28
 * Last modified: 2026-08-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

const TEXT_WIDGET_POSITION_START = 20
const TEXT_WIDGET_POSITION_INCREMENT = 5
const TEXT_WIDGET_POSITION_CYCLE_LENGTH = 10
const TEXT_WIDGET_POSITION_RESET_DELAY = 2 * 60 * 1000

let textWidgetCreationCount = 0
let lastTextWidgetCreationAt = null

/**
 * Returns the next default position for a newly created text widget.
 * @param {number} [timestamp=Date.now()] - Creation timestamp in milliseconds
 * @returns {{left: string, top: string, attachTo: string}} Text widget placement
 */
export const getNextTextWidgetPosition = (timestamp = Date.now()) => {
    const creationAt = Number(timestamp)
    const now = Number.isFinite(creationAt) ? creationAt : Date.now()
    const elapsed = lastTextWidgetCreationAt === null ? Infinity : now - lastTextWidgetCreationAt
    if (elapsed >= TEXT_WIDGET_POSITION_RESET_DELAY || elapsed < 0) {
        textWidgetCreationCount = 0
    }

    const percentage = TEXT_WIDGET_POSITION_START + (
        textWidgetCreationCount * TEXT_WIDGET_POSITION_INCREMENT
    )
    textWidgetCreationCount = (textWidgetCreationCount + 1) % TEXT_WIDGET_POSITION_CYCLE_LENGTH
    lastTextWidgetCreationAt = now

    return {
        attachTo: 'top-left',
        left:     `${percentage}%`,
        top:      `${percentage}%`,
    }
}

/**
 * Resets the in-memory text widget placement sequence.
 * This is intended for isolated lifecycle tests and application reset flows.
 */
export const resetTextWidgetPositionSequence = () => {
    textWidgetCreationCount = 0
    lastTextWidgetCreationAt = null
}
