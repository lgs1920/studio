/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: widget-instance-policy.test.js
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
import {Profiler, getProfileChartRegistryKey, getRegisteredProfileCharts, registerProfileChart, unregisterProfileChart} from '@Core/ui/Profiler'
import {WidgetCoreRegistry} from '@Core/ui/widget-manager/WidgetCoreRegistry'
import {WidgetDynamicRenderer} from '@Core/ui/widget-manager/dynamic-render/WidgetDynamicRender'
import {getWidgetInstanceStats} from '@Core/ui/widget-manager/widgetInstancePolicy'
import YAML from 'yaml'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const catalog = YAML.parse(readFileSync(new URL('../../../../public/widgets.yaml', import.meta.url), 'utf8'))

const makeWidgetGroups = () => {
    const groups = new Map(Object.keys(catalog['widget-groups']).map(id => [id, {widgets: new Map()}]))
    for (const [id, definition] of Object.entries(catalog.widgets)) {
        for (const group of definition.groups ?? []) {
            groups.get(group)?.widgets.set(id, definition)
        }
    }
    return groups
}

describe('widget instance limits', () => {
    beforeEach(() => {
        vi.stubGlobal('__', {widgets: makeWidgetGroups(), ui: {profiler: {charts: new Map()}}})
        vi.stubGlobal('lgs', {stores: {ui: {widget: {cache: new Map()}}}})
    })

    afterEach(() => vi.unstubAllGlobals())

    it('allows twenty repeatable widgets, two hundred Text widgets, and keeps fixed widgets singleton', () => {
        expect(catalog.widgets['compass-widget'].max).toBe(20)
        expect(catalog.widgets['profile-widget'].max).toBe(20)
        expect(catalog.widgets['journey-stats-widget'].max).toBe(20)
        expect(catalog.widgets['dynamic-stats-widget'].max).toBe(20)
        expect(catalog.widgets['text-widget'].max).toBe(200)
        expect(catalog.widgets['logo-widget'].max).toBe(1)
        expect(catalog.widgets['credits-widget'].max).toBe(1)
        expect(catalog.widgets['replay-timeline-widget'].max).toBe(1)
    })

    it('counts concrete instances across catalogue groups and independently per board', () => {
        const widgetCache = new Map([
            ['profile-widget#scene', {widgetsBoard: 'scene'}],
            ['profile-widget#video-1', {widgetsBoard: 'video-crop-zone'}],
            ['profile-widget#video-2', {widgetsBoard: 'video-crop-zone'}],
        ])

        expect(getWidgetInstanceStats({
            widgetId: 'profile-widget#requested-instance',
            widgetDefinition: catalog.widgets['profile-widget'],
            widgetCache,
            widgetsBoard: 'video-crop-zone',
        })).toEqual({count: 2, max: 20, remaining: 18, maxReached: false})
    })

    it('enforces one shared limit when the widget is listed in multiple groups', () => {
        const widgetDefinition = {max: 20}
        __.widgets.get('scene-widgets').widgets.set('profile-widget', widgetDefinition)
        __.widgets.get('journey-widgets').widgets.set('profile-widget', widgetDefinition)
        for (let index = 0; index < 20; index++) {
            const board = index === 0 ? 'scene' : 'video-crop-zone'
            const group = index % 2 === 0 ? 'scene-widgets' : 'journey-widgets'
            lgs.stores.ui.widget.cache.set(`profile-widget#${index}`, {group, widgetsBoard: board})
        }

        const registry = new WidgetCoreRegistry()
        expect(registry.countWidgets('journey-widgets', 'profile-widget', 'video-crop-zone')).toBe(19)
        expect(registry.remainingWidgets('scene-widgets', 'profile-widget', 'video-crop-zone')).toBe(1)
        expect(registry.isMaxWidgetsReached('scene-widgets', 'profile-widget', 'video-crop-zone')).toBe(false)
        expect(registry.isMaxWidgetsReached('scene-widgets', 'profile-widget', 'scene')).toBe(false)

        lgs.stores.ui.widget.cache.set('profile-widget#20', {group: 'scene-widgets', widgetsBoard: 'video-crop-zone'})
        expect(registry.isMaxWidgetsReached('scene-widgets', 'profile-widget', 'video-crop-zone')).toBe(true)
        expect(registry.remainingWidgets('journey-widgets', 'profile-widget', 'video-crop-zone')).toBe(0)
    })

    it('reserves the final slot while a repeatable widget component is loading', async () => {
        const groupId = 'journey-widgets'
        const widgetId = 'repeatable-widget'
        const widgetDefinition = {component: 'RepeatableWidget', max: 20}
        __.widgets.get(groupId).widgets.set(widgetId, widgetDefinition)

        const runtimeCache = lgs.stores.ui.widget.cache
        for (let index = 0; index < 19; index++) {
            runtimeCache.set(`${widgetId}#existing-${index}`, {widgetsBoard: 'video-crop-zone'})
        }

        const widgetList = new Map()
        let nextWidgetId = `${widgetId}#last-slot`
        const widgetManager = {
            maxWidgets: () => widgetDefinition.max,
            isMaxWidgetsReached: () => runtimeCache.size >= widgetDefinition.max,
            remainingWidgets: () => widgetDefinition.max - runtimeCache.size,
            defineElementId: () => nextWidgetId,
        }
        const componentCache = {
            get: id => runtimeCache.get(id),
            set: (id, value) => runtimeCache.set(id, value),
        }
        __.ui = {widgetCache: componentCache, widgetManager}
        lgs.stores.ui.widget.list = widgetList

        let resolveComponent
        const componentLoad = new Promise(resolve => {
            resolveComponent = resolve
        })
        const renderer = WidgetDynamicRenderer.instance
        renderer.registry = {getLazyComponent: vi.fn(() => componentLoad)}

        const firstRender = renderer.renderWidget(groupId, widgetId, {widgetsBoard: 'video-crop-zone'})
        nextWidgetId = `${widgetId}#overflow`

        await expect(renderer.renderWidget(groupId, widgetId, {widgetsBoard: 'video-crop-zone'})).resolves.toBeNull()

        resolveComponent(() => null)
        await expect(firstRender).resolves.toBeTypeOf('function')
        expect(runtimeCache.size).toBe(20)
        expect(widgetList.has(`${widgetId}#last-slot`)).toBe(true)
    })
})

describe('profile chart instances', () => {
    beforeEach(() => {
        vi.stubGlobal('__', {widgets: makeWidgetGroups(), ui: {profiler: {charts: new Map()}}})
    })

    afterEach(() => vi.unstubAllGlobals())

    it('registers, updates, and unregisters profile charts independently by widget ID', () => {
        const charts = __.ui.profiler.charts
        const firstChart = {dispatchAction: vi.fn()}
        const secondChart = {dispatchAction: vi.fn()}
        registerProfileChart(charts, 'profile-widget#one', firstChart)
        registerProfileChart(charts, 'profile-widget#two', secondChart)

        const profiler = new Profiler({})
        profiler.updateChartMarker(1, 4)

        expect(getRegisteredProfileCharts(charts)).toEqual([
            [getProfileChartRegistryKey('profile-widget#one'), firstChart],
            [getProfileChartRegistryKey('profile-widget#two'), secondChart],
        ])
        expect(firstChart.dispatchAction).toHaveBeenCalledWith({type: 'showTip', seriesIndex: 1, dataIndex: 4})
        expect(secondChart.dispatchAction).toHaveBeenCalledWith({type: 'showTip', seriesIndex: 1, dataIndex: 4})
        expect(unregisterProfileChart(charts, 'profile-widget#one', firstChart)).toBe(true)
        expect(getRegisteredProfileCharts(charts)).toEqual([
            [getProfileChartRegistryKey('profile-widget#two'), secondChart],
        ])
    })

    it('does not let stale cleanup remove a replacement chart for the same widget', () => {
        const charts = __.ui.profiler.charts
        const staleChart = {}
        const currentChart = {}
        registerProfileChart(charts, 'profile-widget#one', staleChart)
        registerProfileChart(charts, 'profile-widget#one', currentChart)

        expect(unregisterProfileChart(charts, 'profile-widget#one', staleChart)).toBe(false)
        expect(charts.get(getProfileChartRegistryKey('profile-widget#one'))).toBe(currentChart)
    })
})
