/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poi-utils-flythrough-visibility.test.js
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { POIUtils } from '@Utils/cesium/POIUtils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

const propertyValue = value => typeof value?.getValue === 'function' ? value.getValue() : value

const createEntityContainer = () => {
    const entities = new Map()
    return {
        entities,
        container: {
            values:  [],
            getById: id => entities.get(id),
            add:     entity => {
                entities.set(entity.id, entity)
                return entity
            },
        },
    }
}

describe('POIUtils flythrough visibility', () => {
    beforeEach(() => {
        const {container} = createEntityContainer()
        globalThis.lgs = {
            stores: {
                flythrough: proxy({
                    active:  false,
                    playing: false,
                    paused:  false,
                }),
            },
            viewer: {
                entities:    container,
                dataSources: {
                    length: 0,
                    get:    () => null,
                },
                scene: {
                    render: vi.fn(),
                },
            },
        }
        globalThis.__ = {
            ui: {
                sceneManager: {
                    is2D:     false,
                    noRelief: () => true,
                },
            },
        }
    })

    afterEach(() => {
        globalThis.lgs = undefined
        globalThis.__ = undefined
    })

    it('keeps a flythrough-hidden poi hidden while the flythrough is active', () => {
        globalThis.lgs.stores.flythrough.active = true

        expect(POIUtils.setPOIVisibility({
            visible: true,
            flythrough: {
                visible: false,
            },
        }, true)).toBe(false)
    })

    it('lets visible pois show when the flythrough is active', () => {
        globalThis.lgs.stores.flythrough.active = true

        expect(POIUtils.setPOIVisibility({
            visible: true,
            flythrough: {
                visible: true,
            },
        }, true)).toBe(true)
    })

    it('forces all pois hidden when hide-all flythrough mode is enabled', () => {
        globalThis.lgs.stores.flythrough.active = true
        globalThis.lgs.stores.flythrough.hideAllPoisDuringFlythrough = true
        globalThis.lgs.settings = {
            ui: {
                flythrough: {
                    hideAllPoisDuringFlythrough: true,
                },
            },
        }

        expect(POIUtils.setPOIVisibility({
            visible: true,
            flythrough: {
                visible: true,
            },
        }, true)).toBe(false)
    })

    it('updates an existing billboard visibility when flythrough hides the poi', async () => {
        await POIUtils.draw({
            id:        'poi-1',
            longitude: 2,
            latitude:  48,
            height:    100,
            visible:   true,
            image:     {
                src:    'data:image/png;base64,test',
                width:  40,
                height: 20,
            },
        })

        globalThis.lgs.stores.flythrough.active = true
        const entity = await POIUtils.draw({
            id:        'poi-1',
            longitude: 2,
            latitude:  48,
            height:    100,
            visible:   true,
            flythrough: {
                visible: false,
            },
            image: {
                src:    'data:image/png;base64,test2',
                width:  40,
                height: 20,
            },
        })

        expect(entity.show).toBe(false)
        expect(propertyValue(entity.billboard.show)).toBe(false)
    })
})
