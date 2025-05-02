/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: cesiumEvents.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-05-02
 * Last modified: 2025-05-02
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

export const CESIUM_EVENTS = {
    // Standard mouse events
    LEFT_CLICK:        'LEFT_CLICK',
    LEFT_DOUBLE_CLICK: 'LEFT_DOUBLE_CLICK',
    RIGHT_DOWN:        'RIGHT_DOWN',
    RIGHT_UP:          'RIGHT_UP',
    RIGHT_CLICK:       'RIGHT_CLICK',
    MIDDLE_DOWN:       'MIDDLE_DOWN',
    MIDDLE_UP:         'MIDDLE_UP',
    MIDDLE_CLICK:      'MIDDLE_CLICK',
    MOUSE_MOVE:        'MOUSE_MOVE',
    WHEEL:             'WHEEL',

    // Touch events
    TAP:        'TAP',
    DOUBLE_TAP: 'DOUBLE_TAP',
    LONG_TAP:   'LONG_TAP',

    // Mobile specific
    PINCH_START: 'PINCH_START',
    PINCH_MOVE:  'PINCH_MOVE',
    PINCH_END: 'PINCH_END',

    // Modifiers
    CTRL:  'CTRL',
    ALT:   'ALT',
    SHIFT: 'SHIFT',

    // Note: Keyboard letter events with modifiers are generated dynamically
    // Examples: CTRL_R, SHIFT_A, CTRL_ALT_W, etc.
    // These events will be triggered with the last picked entity
}

export const EVENT_SEPARATOR = '_'