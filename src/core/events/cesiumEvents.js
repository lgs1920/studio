/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: cesiumEvents.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-04-30
 * Last modified: 2025-04-30
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/
import { ScreenSpaceEventType } from 'cesium'

export const CESIUM_EVENTS = {
    // Mouse events
    LEFT_DOWN:         ScreenSpaceEventType.LEFT_DOWN,
    LEFT_UP:           ScreenSpaceEventType.LEFT_UP,
    LEFT_CLICK:        ScreenSpaceEventType.LEFT_CLICK,
    LEFT_DOUBLE_CLICK: ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
    RIGHT_DOWN:        ScreenSpaceEventType.RIGHT_DOWN,
    RIGHT_UP:          ScreenSpaceEventType.RIGHT_UP,
    RIGHT_CLICK:       ScreenSpaceEventType.RIGHT_CLICK,
    MIDDLE_DOWN:       ScreenSpaceEventType.MIDDLE_DOWN,
    MIDDLE_UP:         ScreenSpaceEventType.MIDDLE_UP,
    MIDDLE_CLICK:      ScreenSpaceEventType.MIDDLE_CLICK,
    MOUSE_MOVE:        ScreenSpaceEventType.MOUSE_MOVE,
    WHEEL:             ScreenSpaceEventType.WHEEL,

    // Touch events
    PINCH_START: ScreenSpaceEventType.PINCH_START,
    PINCH_MOVE:  ScreenSpaceEventType.PINCH_MOVE,
    PINCH_END:   ScreenSpaceEventType.PINCH_END,

    // Custom touch events
    TAP:        'tap',
    DOUBLE_TAP: 'doubletap',
    LONG_TAP:   'longtap',

    // Animation events
    ANIMATION_FRAME: 'animationframe',
}