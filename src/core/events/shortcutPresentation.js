/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: shortcutPresentation.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-03
 * Last modified: 2026-11-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/** Maps pointer and touch gesture names to the icons shown in shortcut help. */
export const SHORTCUT_MOUSE_TOKEN_ICONS = Object.freeze({
    'Double click':     'computer-mouse-button-left',
    'Double tap':       'hand-pointer',
    'Left click':       'computer-mouse-button-left',
    'Left drag':        'computer-mouse-button-left',
    'Long tap':         'hand-pointer',
    'Right click':      'computer-mouse-button-right',
    'Middle drag':      'computer-mouse-scrollwheel',
    Pinch:              'hand-pointer',
    'Right drag':       'computer-mouse-button-right',
    Tap:                'hand-pointer',
    'Trackpad scroll':  'computer-mouse-scrollwheel',
    Wheel:              'computer-mouse-scrollwheel',
})

/** Maps shortcut platform names to the label and icon lookup keys used by help. */
export const SHORTCUT_PLATFORMS = Object.freeze([
    {key: 'macos', pattern: /mac/i, label: 'macOS'},
    {key: 'windows', pattern: /windows/i, label: 'Windows'},
    {key: 'linux', pattern: /linux/i, label: 'Linux'},
])

/** Supplies compact screen-reader-friendly key labels and descriptive PDF labels. */
export const SHORTCUT_KEY_LABELS = Object.freeze({
    screen: Object.freeze({
        ArrowDown:  '↓',
        ArrowLeft:  '←',
        ArrowRight: '→',
        ArrowUp:    '↑',
        Minus:      '-',
        Plus:       '+',
    }),
    pdf: Object.freeze({
        ArrowDown:  'Down',
        ArrowLeft:  'Left',
        ArrowRight: 'Right',
        ArrowUp:    'Up',
        Minus:      '-',
        Plus:       '+',
    }),
})
