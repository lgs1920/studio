/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-video-settings.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-01
 * Last modified: 2026-11-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, it} from 'vitest'
import {
    DEFAULT_REPLAY_VIDEO_QUALITY_INDEX,
    REPLAY_VIDEO_PRESETS,
    REPLAY_VIDEO_QUALITY,
    resolveReplayVideoQualityLevel,
} from '@Core/ui/replay/ReplayVideoSettings'

describe('Replay video quality settings', () => {
    it('keeps saved quality indices mapped to stable MediaBunny quality identifiers', () => {
        expect(REPLAY_VIDEO_QUALITY.map(({value}) => value)).toEqual([
            'medium',
            'high',
            'very-high',
        ])
        expect(REPLAY_VIDEO_QUALITY.every(({value}) => typeof value === 'string')).toBe(true)
        expect(DEFAULT_REPLAY_VIDEO_QUALITY_INDEX).toBe(0)
        expect([0, 1, 2].map(resolveReplayVideoQualityLevel)).toEqual([
            'medium',
            'high',
            'very-high',
        ])
    })

    it('preserves the quality indices used by saved video presets', () => {
        expect(['15-medium', 'medium', 'high', 'Ultra'].map(key => [
            key,
            REPLAY_VIDEO_PRESETS.get(key).quality,
        ])).toEqual([
            ['15-medium', 0],
            ['medium', 0],
            ['high', 1],
            ['Ultra', 2],
        ])
        expect(resolveReplayVideoQualityLevel(10)).toBe('medium')
    })
})
