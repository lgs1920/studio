/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: widget-group-utils.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-02
 * Last modified: 2026-09-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    expandTimelineTrackOrder,
    groupWidgetEntries,
    resolveWidgetGroupLabelsFromTracks,
    resolveWidgetGroupUpdatesFromTracks,
} from '@Core/ui/widget-manager/WidgetGroupUtils'
import {describe, expect, it} from 'vitest'

describe('WidgetGroupUtils', () => {
    it('groups entries by widgetGroup while preserving their input order', () => {
        const entries = [
            {id: 'text-widget#top', label: 'First', widgetGroup: 'text-widget#top'},
            {id: 'compass-widget', widgetGroup: null},
            {id: 'text-widget#bottom', label: 'Second', widgetGroup: 'text-widget#top'},
        ]

        expect(groupWidgetEntries(entries)).toEqual([
            {
                id: 'text-widget#top',
                isGroup: true,
                label: 'First',
                widgetGroup: 'text-widget#top',
                members: [entries[0], entries[2]],
            },
            entries[1],
        ])
    })

    it('creates a group from multiple clips even when every clip belongs to one widget', () => {
        const updates = resolveWidgetGroupUpdatesFromTracks([
            {
                id: 'text-widget#one',
                clips: [
                    {metadata: {widgetId: 'text-widget#one'}},
                    {metadata: {widgetId: 'text-widget#one'}},
                ],
            },
        ], new Map(), () => 'group#created')

        expect(updates).toEqual(new Map([['text-widget#one', 'text-widget#one']]))
    })

    it('removes membership when a track contains one widget clip', () => {
        const updates = resolveWidgetGroupUpdatesFromTracks([
            {
                id: 'group#one',
                widgetGroup: 'group#one',
                clips: [{metadata: {widgetId: 'text-widget#one'}}],
            },
        ], new Map([['text-widget#one', {widgetGroup: 'group#one'}]]))

        expect(updates).toEqual(new Map([['text-widget#one', null]]))
    })

    it('keeps the timeline track name for a grouped track', () => {
        const updates = resolveWidgetGroupUpdatesFromTracks([
            {
                id: 'text-widget#one',
                label: 'Timeline title',
                clips: [
                    {metadata: {widgetId: 'text-widget#one'}},
                    {metadata: {widgetId: 'text-widget#two'}},
                ],
            },
        ])

        expect(resolveWidgetGroupLabelsFromTracks([
            {
                id: 'text-widget#one',
                label: 'Timeline title',
                clips: [
                    {metadata: {widgetId: 'text-widget#one'}},
                    {metadata: {widgetId: 'text-widget#two'}},
                ],
            },
        ], updates)).toEqual(new Map([['text-widget#one', 'Timeline title']]))
    })

    it('expands grouped timeline tracks into widget layer order', () => {
        const widgetList = new Map([
            ['text-widget#one', {widgetGroup: 'group#one', zIndex: 4000}],
            ['compass-widget', {zIndex: 4002}],
            ['text-widget#two', {widgetGroup: 'group#one', zIndex: 4001}],
        ])

        expect(expandTimelineTrackOrder(['compass-widget', 'group#one'], widgetList)).toEqual([
            'compass-widget',
            'text-widget#two',
            'text-widget#one',
        ])
    })
})
