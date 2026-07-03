/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poi-utils-replay-visibility.test.js
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

describe('POIUtils replay visibility', () => {
    beforeEach(() => {
        const {container} = createEntityContainer()
        globalThis.lgs = {
            stores: {
                replay: proxy({
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

    it('keeps a replay-hidden poi hidden while the replay is active', () => {
        globalThis.lgs.stores.replay.active = true

        expect(POIUtils.setPOIVisibility({
            visible: true,
            replay: {
                visible: false,
            },
        }, true)).toBe(false)
    })

    it('lets visible pois show when the replay is active', () => {
        globalThis.lgs.stores.replay.active = true

        expect(POIUtils.setPOIVisibility({
            visible: true,
            replay: {
                visible: true,
            },
        }, true)).toBe(true)
    })

    it('forces all pois hidden when hide-all replay mode is enabled', () => {
        globalThis.lgs.stores.replay.active = true
        globalThis.lgs.stores.replay.hideAllPoisDuringJourneyReplay = true
        globalThis.lgs.settings = {
            ui: {
                replay: {
                    hideAllPoisDuringJourneyReplay: true,
                },
            },
        }

        expect(POIUtils.setPOIVisibility({
            visible: true,
            replay: {
                visible: true,
            },
        }, true)).toBe(false)
    })

    it('updates an existing billboard visibility when replay hides the poi', async () => {
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

        globalThis.lgs.stores.replay.active = true
        const entity = await POIUtils.draw({
            id:        'poi-1',
            longitude: 2,
            latitude:  48,
            height:    100,
            visible:   true,
            replay: {
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
