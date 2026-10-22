/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: widget-catalog-group.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-22
 * Last modified: 2026-10-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {readFileSync} from 'node:fs'
import YAML from 'yaml'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {resolveWidgetCatalogGroup} from '@Core/ui/widget-manager/resolveWidgetCatalogGroup'

describe('widget catalogue group resolution', () => {
    beforeEach(() => {
        const catalog = YAML.parse(readFileSync(new URL('../../../../public/widgets.yaml', import.meta.url), 'utf8'))
        const groups = new Map(Object.keys(catalog['widget-groups']).map(id => [id, {widgets: new Map()}]))
        for (const [id, definition] of Object.entries(catalog.widgets)) {
            for (const group of definition.groups ?? []) {
                groups.get(group)?.widgets.set(id, definition)
            }
        }
        vi.stubGlobal('__', {widgets: groups})
        vi.stubGlobal('lgs', {stores: {ui: {widget: {list: new Map()}}}})
    })

    afterEach(() => vi.unstubAllGlobals())

    it.each(['text-widget#title', 'profile-widget#chart', 'journey-stats-widget#stats', 'dynamic-stats-widget#live'])(
        'restores %s through its Journey catalogue group on the video board', widgetId => {
            expect(resolveWidgetCatalogGroup(widgetId, {widgetsBoard: 'video-crop-zone'})).toBe('journey-widgets')
        },
    )

    it('keeps scene and video registrations separate for repeatable widget types', () => {
        expect(resolveWidgetCatalogGroup('text-widget#scene', {widgetsBoard: 'scene'})).toBe('scene-widgets')
        expect(resolveWidgetCatalogGroup('text-widget#video', {widgetsBoard: 'video-crop-zone'})).toBe('journey-widgets')
    })

    it('repairs an invalid saved group and preserves a valid explicit group', () => {
        lgs.stores.ui.widget.list.set('text-widget#title', {group: 'multi-purpose-widgets'})
        expect(resolveWidgetCatalogGroup('text-widget#title', {widgetsBoard: 'video-crop-zone'})).toBe('journey-widgets')
        expect(resolveWidgetCatalogGroup('text-widget#title', {group: 'scene-widgets'})).toBe('scene-widgets')
    })

    it.each(['logo-widget', 'credits-widget', 'compass-widget'])(
        'keeps %s in its shared catalogue group', widgetId => {
            expect(resolveWidgetCatalogGroup(widgetId, {widgetsBoard: 'video-crop-zone'})).toBe('multi-purpose-widgets')
        },
    )

    it('does not invent a group for an unknown widget', () => {
        expect(resolveWidgetCatalogGroup('unknown-widget')).toBeNull()
    })
})
