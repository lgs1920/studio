/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: cesiumEvents.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-05-05
 * Last modified: 2025-05-05
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

export const EVENT_SEPARATOR = '_'

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

    // Common modifier combinations for clicks
    CTRL_LEFT_CLICK:  'CTRL_LEFT_CLICK',
    SHIFT_LEFT_CLICK: 'SHIFT_LEFT_CLICK',
    ALT_LEFT_CLICK:   'ALT_LEFT_CLICK',

    CTRL_RIGHT_CLICK:  'CTRL_RIGHT_CLICK',
    SHIFT_RIGHT_CLICK: 'SHIFT_RIGHT_CLICK',
    ALT_RIGHT_CLICK:   'ALT_RIGHT_CLICK',

    CTRL_LEFT_DOUBLE_CLICK:  'CTRL_LEFT_DOUBLE_CLICK',
    SHIFT_LEFT_DOUBLE_CLICK: 'SHIFT_LEFT_DOUBLE_CLICK',
    ALT_LEFT_DOUBLE_CLICK:   'ALT_LEFT_DOUBLE_CLICK',

    // Multiple modifiers
    CTRL_SHIFT_LEFT_CLICK:     'CTRL_SHIFT_LEFT_CLICK',
    CTRL_ALT_LEFT_CLICK:       'CTRL_ALT_LEFT_CLICK',
    SHIFT_ALT_LEFT_CLICK:      'SHIFT_ALT_LEFT_CLICK',
    CTRL_SHIFT_ALT_LEFT_CLICK: 'CTRL_SHIFT_ALT_LEFT_CLICK',

    CTRL_SHIFT_RIGHT_CLICK: 'CTRL_SHIFT_RIGHT_CLICK',
    CTRL_ALT_RIGHT_CLICK:   'CTRL_ALT_RIGHT_CLICK',
    SHIFT_ALT_RIGHT_CLICK:  'SHIFT_ALT_RIGHT_CLICK',

    // Also added for double clicks with multiple modifiers
    CTRL_SHIFT_LEFT_DOUBLE_CLICK: 'CTRL_SHIFT_LEFT_DOUBLE_CLICK',
    CTRL_ALT_LEFT_DOUBLE_CLICK:   'CTRL_ALT_LEFT_DOUBLE_CLICK',
    SHIFT_ALT_LEFT_DOUBLE_CLICK:  'SHIFT_ALT_LEFT_DOUBLE_CLICK',
}