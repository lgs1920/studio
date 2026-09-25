/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-video-widget-policy.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-25
 * Last modified: 2026-09-25
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    filterReplayVideoWidgetKeys,
    getReplayVideoWidgetKeys,
    isReplayVideoWidgetAllowed,
    REPLAY_VIDEO_WIDGET_TYPES,
} from '@Core/ui/replay/ReplayVideoWidgetPolicy'
import {afterEach, describe, expect, it} from 'vitest'

describe('Replay video widget policy', () => {
    afterEach(() => {
        globalThis.__ = undefined
    })

    it('keeps only Compass, Credits, and Logo widget instances', () => {
        expect(REPLAY_VIDEO_WIDGET_TYPES).toEqual([
            'compass-widget',
            'credits-widget',
            'logo-widget',
        ])
        expect(filterReplayVideoWidgetKeys([
            'journey-stats-widget#1',
            'compass-widget#1',
            'logo-widget',
            'compass-widget#1',
        ])).toEqual(['compass-widget#1', 'logo-widget'])
        expect(isReplayVideoWidgetAllowed('credits-widget#video')).toBe(true)
        expect(isReplayVideoWidgetAllowed('replay-timeline-widget')).toBe(false)
    })

    it('filters the cache before composing the video widget stack', () => {
        globalThis.__ = {
            ui: {
                widgetCache: {
                    getAll: () => new Map([
                        ['journey-stats-widget', {zIndex: 6000}],
                        ['logo-widget', {zIndex: 10001}],
                        ['compass-widget#1', {zIndex: 5000}],
                    ]),
                },
            },
        }

        expect(getReplayVideoWidgetKeys()).toEqual([
            'compass-widget#1',
            'logo-widget',
        ])
    })
})
