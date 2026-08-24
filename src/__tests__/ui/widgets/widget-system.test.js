/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: widget-system.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-04-30
 * Last modified: 2026-04-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    CROP_TOOLS_WIDGETS, JOURNEY_STATS_WIDGET, JOURNEY_WIDGETS, LGS_VISUAL_WIDGET, PROFILE_WIDGET, SCENE_WIDGETS, SCENE_WIDGETS_BOARD,
    WIDGET_LAYER_START, WIDGETS_STORE,
}                                               from '../../../core/constants'
import { WidgetDynamicRenderer }                from '../../../core/ui/widget-manager/dynamic-render/WidgetDynamicRender'
import { WidgetCache }                          from '../../../core/ui/widget-manager/WidgetCache'
import { WidgetCoreRegistry }                   from '../../../core/ui/widget-manager/WidgetCoreRegistry'

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
        configuration: {
            videoFormats: [
                {value: '1x1', locked: true, aspectRatio: 1},
                {value: '16x9', locked: true, aspectRatio: 16 / 9},
            ],
            widgetRatio: {value: '1x1', locked: true, aspectRatio: 1},
        },
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
                getWidgetPosition:   vi.fn(async () => null),
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

describe('Widget registry ratio resolution', () => {
    beforeEach(() => {
        installGlobals()
    })

    it('keeps an explicit visual widget ratio instead of the global widget ratio', async () => {
        const registry = new WidgetCoreRegistry()
        const element = {}

        const config = await registry.retrieveConfig(element, {
            id:        `${PROFILE_WIDGET}#scene`,
            type:      LGS_VISUAL_WIDGET,
            ratio:     '16x9',
            container: document.body,
        })

        expect(config.ratio.value).toBe('16x9')
    })

    it('migrates old persisted global ratios when an explicit widget ratio is requested', async () => {
        const registry = new WidgetCoreRegistry()
        const element = {}
        const container = {
            getBoundingClientRect: vi.fn(() => ({
                left:   0,
                top:    0,
                right:  1000,
                bottom: 1000,
                width:  1000,
                height: 1000,
            })),
        }

        __.ui.widgetManager.getWidgetPosition = vi.fn(async () => ({
            leftRatio:    50,
            topRatio:     50,
            width:        200,
            height:       200,
            ratio:        '1x1',
            widgetsBoard: SCENE_WIDGETS_BOARD,
        }))

        const config = await registry.retrieveConfig(element, {
            id:             `${PROFILE_WIDGET}#scene`,
            type:           LGS_VISUAL_WIDGET,
            ratio:          '16x9',
            container,
            boundsContainer: container,
            persist:        true,
            widgetsBoard:   SCENE_WIDGETS_BOARD,
        })

        expect(config.ratio.value).toBe('16x9')
        expect(config.dimensions.width).toBeCloseTo(355.5555555556)
        expect(config.dimensions.height).toBe(200)
        expect(config.position.left).toBeCloseTo(322.2222222222)
        expect(config.position.top).toBe(400)
    })

    it('ignores persisted positions from an older position key', async () => {
        const registry = new WidgetCoreRegistry()
        const container = {
            getBoundingClientRect: vi.fn(() => ({
                left:   0,
                top:    0,
                right:  1000,
                bottom: 800,
                width:  1000,
                height: 800,
            })),
        }

        __.ui.widgetManager.getWidgetPosition = vi.fn(async () => ({
            leftRatio:   10,
            topRatio:    10,
            width:       200,
            height:      100,
            positionKey: 'test-toolbar-window-v1',
        }))

        const config = await registry.retrieveConfig(document.createElement('div'), {
            id:              'test-toolbar-widget',
            attachTo:        'center',
            container,
            boundsContainer: container,
            left:            '50%',
            persist:         true,
            positionKey:     'test-toolbar-window-v2',
            top:             '66.7%',
            type:            'toolbar',
        })

        expect(config.fromDB).toBe(false)
        expect(config.position).toEqual({left: 0, top: 0})
    })

    it('migrates an active runtime config from the global ratio to the explicit widget ratio', async () => {
        const registry = new WidgetCoreRegistry()
        const element = {}

        const initialConfig = await registry.retrieveConfig(element, {
            id:        `${PROFILE_WIDGET}#scene`,
            type:      LGS_VISUAL_WIDGET,
            ratio:     '1x1',
            container: {},
        })
        initialConfig.runtimeReady = true
        initialConfig.position = {left: 400, top: 400}
        initialConfig.dimensions = {width: 200, height: 200}

        const migratedConfig = await registry.retrieveConfig(element, {
            id:        `${PROFILE_WIDGET}#scene`,
            type:      LGS_VISUAL_WIDGET,
            ratio:     '16x9',
            container: {},
        })

        expect(migratedConfig.ratio.value).toBe('16x9')
        expect(migratedConfig.dimensions.width).toBeCloseTo(355.5555555556)
        expect(migratedConfig.dimensions.height).toBe(200)
        expect(migratedConfig.position.left).toBeCloseTo(322.2222222222)
        expect(migratedConfig.position.top).toBe(400)
    })

    it('preserves a custom ratio object that is not part of the preset list', async () => {
        const registry = new WidgetCoreRegistry()
        const element = {}

        const config = await registry.retrieveConfig(element, {
            id:        `${PROFILE_WIDGET}#scene`,
            type:      LGS_VISUAL_WIDGET,
            ratio:     {
                value:       'custom',
                aspectRatio: 3 / 2,
                locked:      true,
                width:       3,
                height:      2,
            },
            container: {},
        })

        expect(config.ratio.value).toBe('custom')
        expect(config.ratio.aspectRatio).toBeCloseTo(1.5)
        expect(config.ratio.width).toBe(3)
        expect(config.ratio.height).toBe(2)
        expect(config.ratio.locked).toBe(true)
    })

    it('serializes widget position data into a cloneable plain object', () => {
        const registry = new WidgetCoreRegistry()
        const container = {
            getBoundingClientRect: vi.fn(() => ({
                left:   10,
                top:    20,
                width:  1000,
                height: 800,
            })),
        }
        const element = {
            style: {
                left: '110px',
                top:  '220px',
            },
            getBoundingClientRect: vi.fn(() => ({
                left:   110,
                top:    220,
                width:  320,
                height: 180,
            })),
        }
        const getComputedStyleSpy = vi.spyOn(window, 'getComputedStyle').mockReturnValue({
            width:  '320px',
            height: '180px',
        })
        vi.spyOn(registry, 'getElementById').mockReturnValue(element)

        const positionData = registry.preparePositionDataForStorage(`${PROFILE_WIDGET}#cloneable`, {
            container,
            dimensions: {
                width:  320,
                height: 180,
            },
            expandedDimensions: new Proxy({
                width:  300,
                height: 170,
            }, {}),
            expandedInlineDimensions: new Proxy({
                width:  '',
                height: '',
            }, {}),
            position: {
                left: 110,
                top:  220,
            },
            ratio: new Proxy({
                value:       '16x9',
                aspectRatio: 16 / 9,
                locked:      true,
            }, {}),
            scale: new Proxy({
                x: 1.25,
                y: 1.25,
            }, {}),
            type: LGS_VISUAL_WIDGET,
        })

        getComputedStyleSpy.mockRestore()

        expect(() => structuredClone(positionData)).not.toThrow()
        expect(Array.isArray(positionData.ratio)).toBe(false)
        expect(positionData.ratio).toEqual({
            value:       '16x9',
            aspectRatio: 16 / 9,
            locked:      true,
        })
        expect(positionData.scale).toEqual({
            x: 1.25,
            y: 1.25,
        })
    })

    it('persists crop dimensions without a visual scale', () => {
        const registry = new WidgetCoreRegistry()
        const container = {
            getBoundingClientRect: vi.fn(() => ({
                left:   0,
                top:    0,
                width:  800,
                height: 450,
            })),
        }
        const element = {
            style: {
                left: '80px',
                top:  '45px',
            },
            getBoundingClientRect: vi.fn(() => ({
                left:   80,
                top:    45,
                width:  640,
                height: 360,
            })),
        }
        vi.spyOn(registry, 'getElementById').mockReturnValue(element)

        const positionData = registry.preparePositionDataForStorage('video-crop-zone', {
            container,
            isCropper: true,
            cropDimensions: {
                left:   80,
                top:    45,
                width:  640,
                height: 360,
            },
            position: {left: 80, top: 45},
            scale:    {x: 0.67, y: 0.67},
        })

        expect(positionData.width).toBe(640)
        expect(positionData.height).toBe(360)
        expect(positionData.scale).toEqual({x: 1, y: 1})
    })
})

describe('Widget registry runtime cleanup', () => {
    beforeEach(() => {
        installGlobals()
    })

    it('detaches persistent group observers without deleting the saved configuration', () => {
        const registry = new WidgetCoreRegistry()
        const observedTarget = {}
        const observer = {
            unobserve:  vi.fn(),
            disconnect: vi.fn(),
        }
        const elementObserver = {
            disconnect: vi.fn(),
        }
        const config = {
            group:                        CROP_TOOLS_WIDGETS,
            persist:                      true,
            element:                      document.createElement('div'),
            observer,
            observedTargets:              [observedTarget],
            elementObserver,
            fromDB:                       true,
            fromRuntime:                  true,
            runtimeReady:                 true,
            skipInitialElementResizeSync: true,
        }
        const widgetId = 'video-crop-zone'
        __.ui.widgetCache.unmount = vi.fn()
        registry.setConfig(widgetId, config)
        registry.setMoveable(widgetId, {current: {}})

        registry.disposeByGroup(CROP_TOOLS_WIDGETS, true)

        expect(registry.getWidgetConfig(widgetId)).toBe(config)
        expect(config.element).toBeNull()
        expect(config.runtimeReady).toBe(false)
        expect(config.fromDB).toBe(false)
        expect(config.fromRuntime).toBe(false)
        expect(config.observedTargets).toEqual([])
        expect(observer.unobserve).toHaveBeenCalledWith(observedTarget)
        expect(observer.disconnect).toHaveBeenCalled()
        expect(elementObserver.disconnect).toHaveBeenCalled()
        expect(__.ui.widgetCache.unmount).toHaveBeenCalledWith(widgetId)
        expect(registry.getMoveable(widgetId)).toBeUndefined()
    })

    it('reloads the persisted crop dimensions after the editor runtime is detached', async () => {
        const registry = new WidgetCoreRegistry()
        const widgetId = 'video-crop-zone'
        const container = {
            getBoundingClientRect: vi.fn(() => ({
                left:   0,
                top:    0,
                right:  800,
                bottom: 450,
                width:  800,
                height: 450,
            })),
        }
        const config = await registry.retrieveConfig(document.createElement('div'), {
            id:              widgetId,
            group:           CROP_TOOLS_WIDGETS,
            isCropper:       true,
            persist:         true,
            container,
            boundsContainer: container,
            ratio:           '16x9',
        })
        config.runtimeReady = true
        config.cropDimensions = {left: 80, top: 45, width: 640, height: 360}
        config.position = {left: 80, top: 45}
        __.ui.widgetCache.unmount = vi.fn()

        registry.disposeByGroup(CROP_TOOLS_WIDGETS, true)
        __.ui.widgetManager.getWidgetPosition = vi.fn(async () => ({
            leftRatio:  50,
            topRatio:   50,
            width:      640,
            height:     360,
            scale:      {x: 0.67, y: 0.67},
            group:      CROP_TOOLS_WIDGETS,
            ratio:      '16x9',
        }))

        const reopened = await registry.retrieveConfig(document.createElement('div'), {
            id:              widgetId,
            group:           CROP_TOOLS_WIDGETS,
            isCropper:       true,
            persist:         true,
            container,
            boundsContainer: container,
            ratio:           '16x9',
        })

        expect(reopened.fromDB).toBe(true)
        expect(reopened.fromRuntime).toBe(false)
        expect(reopened.cropDimensions).toEqual({left: 80, top: 45, width: 640, height: 360})
        expect(reopened.scale).toEqual({x: 1, y: 1})
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
