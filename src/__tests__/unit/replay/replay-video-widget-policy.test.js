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
 * Last modified: 2026-10-08
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
    REPLAY_VIDEO_SIMPLE_WIDGET_TYPES,
} from '@Core/ui/replay/ReplayVideoWidgetPolicy'
import {afterEach, describe, expect, it} from 'vitest'

describe('Replay video widget policy', () => {
    afterEach(() => {
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('requires Compass in Simple Replay and leaves it optional in Expert Replay', () => {
        expect(REPLAY_VIDEO_WIDGET_TYPES).toEqual([
            'credits-widget',
            'logo-widget',
        ])
        expect(REPLAY_VIDEO_SIMPLE_WIDGET_TYPES).toEqual([
            'compass-widget',
            'credits-widget',
            'logo-widget',
        ])
        expect(getReplayVideoWidgetTypes({simpleReplay: false})).toBe(REPLAY_VIDEO_WIDGET_TYPES)
        expect(getReplayVideoWidgetTypes({simpleReplay: true})).toBe(REPLAY_VIDEO_SIMPLE_WIDGET_TYPES)
    })

    it('allows every content widget and excludes capture infrastructure', () => {
        globalThis.lgs = {
            settings: {ui: {replay: {userMode: 'expert'}}},
            stores: {replay: {userMode: 'expert', simplePreparationActive: false}},
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
        ], {simpleReplay: true})).toEqual([
            'compass-widget#1',
            'credits-widget#video',
            'logo-widget',
        ])
        expect(isReplayVideoWidgetAllowed('journey-stats-widget#1', {simpleReplay: true})).toBe(false)
        expect(isReplayVideoWidgetAllowed('text-widget#title', {simpleReplay: true})).toBe(false)
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
                replay: {userMode: 'basic', simplePreparationActive: false},
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

        expect(getReplayVideoWidgetKeys({simpleReplay: false})).toEqual([
            'text-widget#title',
            'compass-widget#1',
            'journey-stats-widget',
            'logo-widget',
        ])
    })
})
