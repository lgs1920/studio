/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: cesiumEvents.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-05-06
 * Last modified: 2025-05-06
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/
import { ScreenSpaceEventType } from 'cesium'

export const EVENT_SEPARATOR = '_'
export const MODIFIER_SEPARATOR = '#'

export const CESIUM_EVENTS = {
    // Standard mouse events
    LEFT_CLICK:        {type: 'LEFT_CLICK', event: ScreenSpaceEventType.LEFT_CLICK},
    CLICK:             {type: 'LEFT_CLICK', event: ScreenSpaceEventType.LEFT_CLICK},
    LEFT_DOUBLE_CLICK: {type: 'LEFT_DOUBLE_CLICK', event: ScreenSpaceEventType.LEFT_DOUBLE_CLICK},
    DOUBLE_CLICK:      {type: 'LEFT_DOUBLE_CLICK', event: ScreenSpaceEventType.LEFT_DOUBLE_CLICK},
    LEFT_DOWN:         {type: 'LEFT_DOWN', event: ScreenSpaceEventType.LEFT_DOWN},
    LEFT_UP:           {type: 'LEFT_UP', event: ScreenSpaceEventType.LEFT_UP},
    RIGHT_DOWN:        {type: 'RIGHT_DOWN', event: ScreenSpaceEventType.RIGHT_DOWN},
    RIGHT_UP:          {type: 'RIGHT_UP', event: ScreenSpaceEventType.RIGHT_UP},
    RIGHT_CLICK:       {type: 'RIGHT_CLICK', event: ScreenSpaceEventType.RIGHT_CLICK},
    MIDDLE_DOWN:       {type: 'MIDDLE_DOWN', event: ScreenSpaceEventType.MIDDLE_DOWN},
    MIDDLE_UP:         {type: 'MIDDLE_UP', event: ScreenSpaceEventType.MIDDLE_UP},
    MIDDLE_CLICK:      {type: 'MIDDLE_CLICK', event: ScreenSpaceEventType.MIDDLE_CLICK},
    MOUSE_MOVE:        {type: 'MOUSE_MOVE', event: ScreenSpaceEventType.MOUSE_MOVE},
    WHEEL:             {type: 'WHEEL', event: ScreenSpaceEventType.WHEEL},


    // Touch events
    TAP:         {type: 'TAP', event: 'TAP', touch: true},
    DOUBLE_TAP:  {type: 'DOUBLE_TAP', event: 'DOUBLE_TAP', touch: true},
    LONG_TAP:    {type: 'LONG_TAP', event: 'LONG_TAP', touch: true},
    TOUCH_START: {type: 'TOUCH_START', event: 'TOUCH_START', touch: true},
    TOUCH_END:   {type: 'TOUCH_END', event: 'TOUCH_END', touch: true},


    // Mobile specific
    PINCH_START: {type: 'PINCH_START', event: ScreenSpaceEventType.PINCH_START, touch: true},
    PINCH_MOVE:  {type: 'PINCH_MOVE', event: ScreenSpaceEventType.PINCH_MOVE, touch: true},
    PINCH_END:   {type: 'PINCH_END', event: ScreenSpaceEventType.PINCH_END, touch: true},

}
// Modifiers

export const MODIFIERS = {
    CTRL:  'CTRL',
    ALT:   'ALT',
    SHIFT: 'SHIFT',
}