/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: cesiumEvents.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-05-23
 * Last modified: 2025-05-23
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/
import { KeyboardEventModifier, ScreenSpaceEventType } from 'cesium'

export const MODIFIER_SEPARATOR = '#'
export const EVENT_LOWEST = -1000 // Lowest priority for event handlers
export const CESIUM_EVENTS = {
    // Standard mouse events
    CLICK:        {event: ScreenSpaceEventType.LEFT_CLICK},
    DOUBLE_CLICK: {event: ScreenSpaceEventType.LEFT_DOUBLE_CLICK},
    DOWN:         {event: ScreenSpaceEventType.LEFT_DOWN},
    UP:           {event: ScreenSpaceEventType.LEFT_UP},
    RIGHT_DOWN:   {event: ScreenSpaceEventType.RIGHT_DOWN},
    RIGHT_UP:     {event: ScreenSpaceEventType.RIGHT_UP},
    RIGHT_CLICK:  {event: ScreenSpaceEventType.RIGHT_CLICK},
    MIDDLE_DOWN:  {event: ScreenSpaceEventType.MIDDLE_DOWN},
    MIDDLE_UP:    {event: ScreenSpaceEventType.MIDDLE_UP},
    MIDDLE_CLICK: {event: ScreenSpaceEventType.MIDDLE_CLICK},
    MOUSE_MOVE:   {event: ScreenSpaceEventType.MOUSE_MOVE},
    WHEEL:        {event: ScreenSpaceEventType.WHEEL},
    MOUSE_ENTER: {event: ScreenSpaceEventType.MOUSE_MOVE},
    MOUSE_LEAVE: {event: ScreenSpaceEventType.MOUSE_MOVE},

    // Touch events
    TAP:        {event: ScreenSpaceEventType.LEFT_DOWN, touch: true},
    DOUBLE_TAP: {event: ScreenSpaceEventType.LEFT_DOWN, touch: true},
    LONG_TAP:   {event: null, touch: true},


    // Mobile specific
    PINCH_START: {event: ScreenSpaceEventType.PINCH_START, touch: true},
    PINCH_MOVE:  {event: ScreenSpaceEventType.PINCH_MOVE, touch: true},
    PINCH_END:   {event: ScreenSpaceEventType.PINCH_END, touch: true},

}

export const EVENTS = Object.keys(CESIUM_EVENTS).reduce((acc, key) => {
    acc[key] = key
    return acc
}, {})

// Modifiers
export const MODIFIERS = {
    CTRL:  KeyboardEventModifier.CTRL,
    ALT:   KeyboardEventModifier.ALT,
    SHIFT: KeyboardEventModifier.SHIFT,
}