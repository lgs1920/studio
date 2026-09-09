/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LGS1920TimelineInteraction.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-06
 * Last modified: 2026-09-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Native input events kept local to the timeline surface.
 */
export const TIMELINE_INPUT_EVENT_TYPES = Object.freeze([
    'auxclick',
    'click',
    'contextmenu',
    'dblclick',
    'drag',
    'dragenter',
    'dragend',
    'dragleave',
    'dragover',
    'dragstart',
    'drop',
    'gotpointercapture',
    'keydown',
    'lostpointercapture',
    'mousedown',
    'mouseenter',
    'mouseleave',
    'mousemove',
    'mouseout',
    'mouseover',
    'mouseup',
    'pointercancel',
    'pointerdown',
    'pointerenter',
    'pointerleave',
    'pointermove',
    'pointerout',
    'pointerover',
    'pointerrawupdate',
    'pointerup',
    'touchcancel',
    'touchend',
    'touchmove',
    'touchstart',
    'wheel',
])

export const HOST_DRAG_START_EVENT_TYPES = Object.freeze(['mousedown', 'pointerdown', 'touchstart'])
export const HOST_DRAG_CONTINUATION_EVENT_TYPES = Object.freeze([
    'mousemove', 'mouseup', 'pointermove', 'pointerup', 'touchmove', 'touchend',
])

export const TIMELINE_ARROW_KEYS = Object.freeze(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
export const TIMELINE_HORIZONTAL_ARROW_KEYS = Object.freeze(['ArrowLeft', 'ArrowRight'])
export const TIMELINE_KEYBOARD_KEYS = Object.freeze([
    ...TIMELINE_ARROW_KEYS,
    'Backspace',
    'Delete',
    'c',
    'C',
    'End',
    'Home',
    'm',
    'M',
    'Spacebar',
    ' ',
    'd',
    'D',
    'v',
    'V',
])
export const TIMELINE_KEYBOARD_EDITABLE_SELECTOR = 'input, textarea, select, wa-input, wa-textarea, wa-select, [contenteditable=""], [contenteditable="true"], [role="textbox"]'

export const EXTERNAL_INTERACTION_CONTINUATION_EVENT_TYPES = Object.freeze([
    'mousemove',
    'mouseup',
    'pointercancel',
    'pointermove',
    'pointerup',
    'touchcancel',
    'touchend',
    'touchmove',
])

/**
 * Determine whether the embedding application wants timeline input to remain
 * visible to its host interaction layer.
 *
 * @param {Object} timeline - Timeline configuration.
 * @returns {boolean} Whether host interaction is enabled.
 */
export const allowsHostInteraction = timeline => timeline?.hostInteraction === 'selectable'
