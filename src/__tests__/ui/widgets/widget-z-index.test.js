/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: widget-z-index.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-21
 * Last modified: 2026-08-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { describe, expect, it } from 'vitest'
import { resolveActiveWidgetZIndex } from '@Components/MainUI/widgets/widgetZIndex'

describe('resolveActiveWidgetZIndex', () => {
    it('keeps Credits and Logo above ordinary widgets even with persisted lower layers', () => {
        const widgets = new Map([
            ['credits-widget', {zIndex: 4000}],
            ['logo-widget', {zIndex: 4001}],
            ['text-widget#1', {zIndex: 12000}],
        ])

        expect(resolveActiveWidgetZIndex({
            widgetId:         'credits-widget',
            widgetListSnapshot: widgets,
            config:            {zIndex: 4000},
            widgetDefinition:  {alwaysOnTop: true},
        })).toBe(12001)

        expect(resolveActiveWidgetZIndex({
            widgetId:         'logo-widget',
            widgetListSnapshot: widgets,
            config:            {zIndex: 4001},
            widgetDefinition:  {alwaysOnTop: true},
        })).toBe(12001)
    })

    it('does not change ordinary widget layers', () => {
        const widgets = new Map([['text-widget#1', {zIndex: 4002}]])

        expect(resolveActiveWidgetZIndex({
            widgetId:         'text-widget#1',
            widgetListSnapshot: widgets,
            config:            {zIndex: 4002},
            widgetDefinition:  {},
        })).toBe(4002)
    })

    it('keeps the Replay Timeline above every other widget', () => {
        const widgets = new Map([
            ['credits-widget', {zIndex: 4000}],
            ['logo-widget', {zIndex: 4001}],
            ['text-widget#1', {zIndex: 12000}],
            ['replay-timeline-widget', {zIndex: 4002}],
        ])

        expect(resolveActiveWidgetZIndex({
            widgetId:         'replay-timeline-widget',
            widgetListSnapshot: widgets,
            config:            {zIndex: 4002},
            widgetDefinition:  {alwaysOnTop: true},
        })).toBe(12001)

        expect(resolveActiveWidgetZIndex({
            widgetId:         'logo-widget',
            widgetListSnapshot: widgets,
            config:            {zIndex: 4001},
            widgetDefinition:  {alwaysOnTop: true},
        })).toBe(12000)
    })
})
