/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayVideoSettings.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-27
 * Last modified: 2026-09-27
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {QUALITY_HIGH, QUALITY_MEDIUM, QUALITY_VERY_HIGH} from 'mediabunny'

/** Replay export bitrate choices, in bits per second. */
export const REPLAY_VIDEO_QUALITY = [
    {value: QUALITY_MEDIUM, name: 'Medium Quality', short: 'M'},
    {value: QUALITY_HIGH, name: 'High Quality', short: 'H'},
    {value: QUALITY_VERY_HIGH, name: 'Ultra High Quality', short: 'U'},
]

/** Supported Replay export frame rates. */
export const REPLAY_VIDEO_FPS = [30, 45, 60, 15]

/** Replay export presets. */
export const REPLAY_VIDEO_PRESETS = new Map([
    ['15-medium', {quality: 0, fps: 3, name: 'Low', description: '15 FPS / Medium quality'}],
    ['medium', {quality: 0, fps: 0, name: 'Med', description: 'Medium quality'}],
    ['high', {quality: 1, fps: 1, name: 'High', description: 'Very High quality'}],
    ['Ultra', {quality: 2, fps: 2, name: 'Ultra', description: 'Ultra High quality'}],
    ['custom', {quality: 10, fps: 10, name: 'Flex', description: 'Define yours', submenu: true}],
])

export const DEFAULT_REPLAY_VIDEO_FPS_INDEX = 0
export const DEFAULT_REPLAY_VIDEO_QUALITY_INDEX = 0
