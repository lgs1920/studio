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
 * Last modified: 2026-10-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    filterReplayVideoWidgetKeys,
    getReplayVideoWidgetTypes,
    getReplayVideoWidgetKeys,
    isReplayVideoWidgetAllowed,
    REPLAY_VIDEO_WIDGET_TYPES,
    REPLAY_VIDEO_BASIC_WIDGET_TYPES,
} from '@Core/ui/replay/ReplayVideoWidgetPolicy'
import {afterEach, describe, expect, it} from 'vitest'

describe('Replay video widget policy', () => {
    afterEach(() => {
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('requires Compass in Basic Replay and leaves it optional in Expert Replay', () => {
        expect(REPLAY_VIDEO_WIDGET_TYPES).toEqual([
            'credits-widget',
            'logo-widget',
        ])
        expect(REPLAY_VIDEO_BASIC_WIDGET_TYPES).toEqual([
            'compass-widget',
            'credits-widget',
            'logo-widget',
        ])
        expect(getReplayVideoWidgetTypes({basicReplay: false})).toBe(REPLAY_VIDEO_WIDGET_TYPES)
        expect(getReplayVideoWidgetTypes({basicReplay: true})).toBe(REPLAY_VIDEO_BASIC_WIDGET_TYPES)
    })

    it('keeps only one Compass instance visible in Basic Replay', () => {
        expect(filterReplayVideoWidgetKeys([
            'compass-widget#top',
            'journey-stats-widget#expert',
            'compass-widget#bottom',
            'credits-widget#video',
        ], {basicReplay: true})).toEqual([
            'compass-widget#top',
            'credits-widget#video',
        ])
    })

    it('selects the same lowest-layer Compass instance used for Replay capture', () => {
        globalThis.lgs = {
            settings: {ui: {replay: {userMode: 'basic'}}},
            stores: {
                replay: {userMode: 'basic', basicPreparationActive: false},
                ui: {
                    widget: {
                        list: new Map([
                            ['compass-widget#top', {widgetsBoard: 'video-crop-zone', zIndex: 6000}],
                            ['compass-widget#bottom', {widgetsBoard: 'video-crop-zone', zIndex: 5000}],
                            ['credits-widget#video', {widgetsBoard: 'video-crop-zone', zIndex: 10000}],
                        ]),
                    },
                },
            },
        }

        expect(getReplayVideoWidgetKeys({basicReplay: true})).toEqual([
            'compass-widget#bottom',
            'credits-widget#video',
        ])
    })

    it('allows every content widget and excludes capture infrastructure', () => {
        globalThis.lgs = {
            settings: {ui: {replay: {userMode: 'expert'}}},
            stores: {replay: {userMode: 'expert', basicPreparationActive: false}},
        }
        expect(filterReplayVideoWidgetKeys([
            'journey-stats-widget#1',
            'compass-widget#1',
            'credits-widget#video',
            'logo-widget',
            'text-widget#title',
            'video-crop-zone',
            'replay-timeline-widget',
            'compass-widget#1',
        ])).toEqual([
            'journey-stats-widget#1',
            'compass-widget#1',
            'credits-widget#video',
            'logo-widget',
            'text-widget#title',
        ])
        expect(isReplayVideoWidgetAllowed('credits-widget#video')).toBe(true)
        expect(isReplayVideoWidgetAllowed('compass-widget#1')).toBe(true)
        expect(isReplayVideoWidgetAllowed('logo-widget')).toBe(true)
        expect(isReplayVideoWidgetAllowed('journey-stats-widget#1')).toBe(true)
        expect(isReplayVideoWidgetAllowed('text-widget#title')).toBe(true)
        expect(filterReplayVideoWidgetKeys([
            'journey-stats-widget#1',
            'compass-widget#1',
            'credits-widget#video',
            'logo-widget',
            'text-widget#title',
        ], {basicReplay: true})).toEqual([
            'compass-widget#1',
            'credits-widget#video',
            'logo-widget',
        ])
        expect(isReplayVideoWidgetAllowed('journey-stats-widget#1', {basicReplay: true})).toBe(false)
        expect(isReplayVideoWidgetAllowed('text-widget#title', {basicReplay: true})).toBe(false)
        expect(isReplayVideoWidgetAllowed('video-crop-zone')).toBe(false)
        expect(isReplayVideoWidgetAllowed('replay-timeline-widget')).toBe(false)
    })

    it('collects every content widget registered on the video board', () => {
        globalThis.__ = {
            ui: {
                widgetCache: {
                    getAll: () => new Map([
                        ['journey-stats-widget', {widgetsBoard: 'video-crop-zone', zIndex: 6000}],
                        ['logo-widget', {widgetsBoard: 'video-crop-zone', zIndex: 10001}],
                        ['compass-widget#1', {widgetsBoard: 'video-crop-zone', zIndex: 5000}],
                        ['video-crop-zone', {widgetsBoard: 'video-crop-zone', zIndex: 1}],
                    ]),
                },
            },
        }
        globalThis.lgs = {
            settings: {ui: {replay: {userMode: 'expert'}}},
            stores: {
                replay: {userMode: 'basic', basicPreparationActive: false},
                ui: {
                    widget: {
                        list: new Map([
                            ['journey-stats-widget', {widgetsBoard: 'video-crop-zone', zIndex: 6000}],
                            ['text-widget#title', {widgetsBoard: 'video-crop-zone', zIndex: 4000}],
                        ]),
                    },
                },
            },
        }

        expect(getReplayVideoWidgetKeys({basicReplay: false})).toEqual([
            'text-widget#title',
            'compass-widget#1',
            'journey-stats-widget',
            'logo-widget',
        ])
    })
})
