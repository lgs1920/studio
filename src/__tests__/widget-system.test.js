/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: widget-system.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-30
 * Last modified: 2026-04-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    JOURNEY_STATS_WIDGET, JOURNEY_WIDGETS, PROFILE_WIDGET, SCENE_WIDGETS, SCENE_WIDGETS_BOARD, WIDGET_LAYER_START,
    WIDGETS_STORE,
}                                               from '../core/constants'
import { WidgetDynamicRenderer }                from '../core/ui/widget-manager/dynamic-render/WidgetDynamicRender'
import { WidgetCache }                          from '../core/ui/widget-manager/WidgetCache'

const widgetCacheStore = new Map()
const widgetListStore = new Map()
const records = new Map()
const DYNAMIC_TEST_WIDGET = 'dynamic-test-widget'

let putCalls = []

const widgetDefinition = component => ({component, max: 1})

const installGlobals = () => {
    widgetCacheStore.clear()
    widgetListStore.clear()
    records.clear()
    putCalls = []

    const widgets = new Map([
                                [
                                    SCENE_WIDGETS,
                                    {
                                        widgets: new Map([
                                                             [PROFILE_WIDGET, widgetDefinition('ProfileWidget')],
                                                             [JOURNEY_STATS_WIDGET, widgetDefinition('JourneyStatsWidget')],
                                                             [DYNAMIC_TEST_WIDGET, widgetDefinition('DynamicTestWidget')],
                                                         ]),
                                    },
                                ],
                                [
                                    JOURNEY_WIDGETS,
                                    {
                                        widgets: new Map([
                                                             [PROFILE_WIDGET, widgetDefinition('ProfileWidget')],
                                                             [JOURNEY_STATS_WIDGET, widgetDefinition('JourneyStatsWidget')],
                                                         ]),
                                    },
                                ],
                            ])

    globalThis.lgs = {
        stores: {
            ui: {
                widget: {
                    cache: widgetCacheStore,
                    list:  widgetListStore,
                },
            },
        },
        db:     {
            lgs1920: {
                keys:   vi.fn(async () => Array.from(records.keys())),
                get:    vi.fn(async (id, store, full = false) => {
                    const record = records.get(id) ?? null
                    return full ? record : record?.data ?? null
                }),
                put:    vi.fn(async (id, value, store) => {
                    putCalls.push({id, store, value})
                    records.set(id, {data: value, _ct_: 1, _mt_: 1})
                }),
                delete: vi.fn(async id => {
                    records.delete(id)
                    widgetCacheStore.delete(id)
                    widgetListStore.delete(id)
                }),
            },
        },
    }

    globalThis.__ = {
        widgets,
        ui: {
            widgetCache:   {
                get:    id => widgetCacheStore.get(id),
                set:    (id, options) => widgetCacheStore.set(id, {...options}),
                delete: id => widgetCacheStore.delete(id),
            },
            widgetManager: {
                defineElementId:     vi.fn((group, id) => `${id}#generated`),
                isMaxWidgetsReached: vi.fn(() => false),
                maxWidgets:          vi.fn((group, id) => widgets.get(group)?.widgets?.get(id.split('#')[0])?.max ?? 1),
            },
        },
    }
}

const addPersistedRecord = (id, data, modifiedAt = 1) => {
    records.set(id, {data, _ct_: modifiedAt, _mt_: modifiedAt})
}

describe('Widget persistence bootstrap', () => {
    beforeEach(() => {
        installGlobals()
    })

    it('repairs old scene widget records missing group and zIndex', async () => {
        const widgetId = `${PROFILE_WIDGET}#saved`
        addPersistedRecord(widgetId, {
            height: 120,
            width:  320,
            zIndex: 0,
        })

        await new WidgetCache().init()

        expect(widgetCacheStore.get(widgetId)).toMatchObject({
                                                                 group:        SCENE_WIDGETS,
                                                                 widgetsBoard: SCENE_WIDGETS_BOARD,
                                                                 zIndex:       WIDGET_LAYER_START,
                                                             })
        expect(widgetListStore.get(widgetId)).toMatchObject({
                                                                group:        SCENE_WIDGETS,
                                                                widgetsBoard: SCENE_WIDGETS_BOARD,
                                                                zIndex:       WIDGET_LAYER_START,
                                                            })
        expect(putCalls).toEqual([
                                     {
                                         id:    widgetId,
                                         store: WIDGETS_STORE,
                                         value: expect.objectContaining({
                                                                            group:        SCENE_WIDGETS,
                                                                            widgetsBoard: SCENE_WIDGETS_BOARD,
                                                                            zIndex:       WIDGET_LAYER_START,
                                                                        }),
                                     },
                                 ])
    })

    it('does not rewrite already normalized widget records', async () => {
        const widgetId = `${JOURNEY_STATS_WIDGET}#saved`
        addPersistedRecord(widgetId, {
            group:        SCENE_WIDGETS,
            widgetsBoard: SCENE_WIDGETS_BOARD,
            zIndex:       WIDGET_LAYER_START + 2,
        })

        await new WidgetCache().init()

        expect(widgetListStore.get(widgetId)).toMatchObject({
                                                                group:        SCENE_WIDGETS,
                                                                widgetsBoard: SCENE_WIDGETS_BOARD,
                                                                zIndex:       WIDGET_LAYER_START + 2,
                                                            })
        expect(putCalls).toHaveLength(0)
    })

    it('restores journey widgets on non-scene boards with the journey group', async () => {
        const widgetId = `${PROFILE_WIDGET}#video`
        addPersistedRecord(widgetId, {
            widgetsBoard: 'video-crop-zone',
            zIndex:       0,
        })

        await new WidgetCache().init()

        expect(widgetListStore.get(widgetId)).toMatchObject({
                                                                group:        JOURNEY_WIDGETS,
                                                                widgetsBoard: 'video-crop-zone',
                                                                zIndex:       WIDGET_LAYER_START,
                                                            })
    })
})

describe('Widget dynamic renderer bootstrap', () => {
    beforeEach(() => {
        installGlobals()
    })

    it('assigns a visible default zIndex when a widget is rendered without one', async () => {
        const DynamicTestWidget = () => null
        const renderer = WidgetDynamicRenderer.instance
        renderer.registry = {
            getLazyComponent: vi.fn(async () => DynamicTestWidget),
        }

        await renderer.renderWidget(SCENE_WIDGETS, DYNAMIC_TEST_WIDGET, {
            forceRefresh: true,
            widgetsBoard: SCENE_WIDGETS_BOARD,
        })

        const widgetId = `${DYNAMIC_TEST_WIDGET}#generated`
        expect(widgetCacheStore.get(widgetId)).toMatchObject({
                                                                 group:        SCENE_WIDGETS,
                                                                 widgetsBoard: SCENE_WIDGETS_BOARD,
                                                                 zIndex:       WIDGET_LAYER_START,
                                                             })
        expect(widgetListStore.get(widgetId)).toMatchObject({
                                                                group:        SCENE_WIDGETS,
                                                                widgetsBoard: SCENE_WIDGETS_BOARD,
                                                                zIndex:       WIDGET_LAYER_START,
                                                            })
    })
})
