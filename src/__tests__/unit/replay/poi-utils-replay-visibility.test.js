/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poi-utils-replay-visibility.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-12
 * Last modified: 2026-10-25
 *
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
                    render:        vi.fn(),
                    requestRender: vi.fn(),
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
                    userMode: 'expert',
                    hideAllPoisDuringJourneyReplay: true,
                },
            },
        }
        globalThis.lgs.stores.replay.userMode = 'expert'

        expect(POIUtils.setPOIVisibility({
            visible: true,
            replay: {
                visible: true,
            },
        }, true)).toBe(false)
    })

    it('allows an explicitly animated POI to show during its replay animation while hide-all is enabled', () => {
        globalThis.lgs.stores.replay.active = true
        globalThis.lgs.stores.replay.hideAllPoisDuringJourneyReplay = true
        globalThis.lgs.stores.replay.userMode = 'expert'
        globalThis.lgs.settings = {
            ui: {
                replay: {
                    userMode: 'expert',
                    hideAllPoisDuringJourneyReplay: true,
                },
            },
        }

        expect(POIUtils.setPOIVisibility({
            visible: true,
            replay: {visible: false},
        }, true, {allowReplayAnimation: true})).toBe(true)
        expect(POIUtils.setPOIVisibility({
            visible: true,
            replay: {visible: true},
        }, true)).toBe(false)
    })

    it('forces Basic Replay Show all to reveal POIs regardless of their POI-level visibility preference', () => {
        globalThis.lgs.stores.replay.active = true
        globalThis.lgs.settings = {ui: {replay: {userMode: 'basic', basic: {poiVisibilityMode: 'yes'}}}}

        expect(POIUtils.setPOIVisibility({visible: false, replay: {visible: false}}, true)).toBe(true)
    })

    it('keeps Basic Replay Start and Stop visibility under user control even when all POIs are hidden', () => {
        globalThis.lgs.stores.replay.active = true
        globalThis.lgs.settings = {ui: {replay: {userMode: 'basic', basic: {poiVisibilityMode: 'no'}}}}

        expect(POIUtils.setPOIVisibility({type: 'start', visible: true, replay: {visible: true}}, true)).toBe(true)
        expect(POIUtils.setPOIVisibility({type: 'stop', visible: true, replay: {visible: false}}, true)).toBe(false)
        expect(POIUtils.setPOIVisibility({type: 'poi', visible: true, replay: {visible: true}}, true)).toBe(false)
    })

    it('keeps a too-close poi hidden even when it is otherwise visible', () => {
        expect(POIUtils.setPOIVisibility({
            visible:  true,
            tooClose: true,
        }, true)).toBe(false)
    })

    it('hides POIs attached to other journeys without changing their saved visibility', () => {
        const currentJourney = {slug: 'journey-current'}
        const otherJourney = {slug: 'journey-other'}
        globalThis.lgs.theJourney = currentJourney
        globalThis.lgs.settings = {journey: {hideOtherJourneys: true}}
        globalThis.lgs.getJourneyByTrackSlug = parent => parent === 'track-other' ? otherJourney : null

        const poi = {parent: 'track-other', visible: true}

        expect(POIUtils.setPOIVisibility(poi, true)).toBe(false)
        expect(poi.visible).toBe(true)
    })

    it('keeps current-journey and unassociated POIs visible while hiding other journeys', () => {
        globalThis.lgs.theJourney = {slug: 'journey-current'}
        globalThis.lgs.settings = {journey: {hideOtherJourneys: true}}
        globalThis.lgs.getJourneyBySlug = slug => slug === 'journey-current' ? globalThis.lgs.theJourney : null

        expect(POIUtils.setPOIVisibility({parent: 'journey-current', visible: true}, true)).toBe(true)
        expect(POIUtils.setPOIVisibility({parent: null, visible: true}, true)).toBe(true)
    })

    it('honors an explicit Replay setting that shows other journeys', () => {
        const otherJourney = {slug: 'journey-other'}
        globalThis.lgs.theJourney = {slug: 'journey-current'}
        globalThis.lgs.stores.main = {theJourney: globalThis.lgs.theJourney}
        globalThis.lgs.stores.replay.active = true
        globalThis.lgs.settings = {
            journey: {hideOtherJourneys: true},
            ui: {
                replay: {
                    userMode: 'expert',
                    inheritHideOtherJourneys: false,
                    hideOtherJourneys: false,
                },
            },
        }
        globalThis.lgs.getJourneyBySlug = slug => slug === otherJourney.slug ? otherJourney : null

        expect(POIUtils.setPOIVisibility({parent: otherJourney.slug, visible: true}, true)).toBe(true)
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
        expect(globalThis.lgs.viewer.scene.render).not.toHaveBeenCalled()
        expect(globalThis.lgs.viewer.scene.requestRender).toHaveBeenCalledTimes(2)
    })

    it('scales an anchored POI pixel offset with the billboard distance scale', async () => {
        const entity = await POIUtils.draw({
            id:        'poi-expanded-anchor',
            longitude: 2,
            latitude:  48,
            height:    100,
            visible:   true,
            expanded:  true,
            scale:     0.5,
            pixelOffset: {x: -20, y: -40},
            image: {
                src:    'data:image/png;base64,test',
                width:  200,
                height: 100,
            },
        })

        expect(propertyValue(entity.billboard.pixelOffset).x).toBe(-10)
        expect(propertyValue(entity.billboard.pixelOffset).y).toBe(-20)
        expect(propertyValue(entity.billboard.pixelOffsetScaleByDistance)).toMatchObject({
            near:      10000,
            nearValue: 1,
            far:       50000,
            farValue:  0,
        })
    })

    it('uses a canvas directly as a billboard image without serializing it', async () => {
        const canvas = {width: 80, height: 60}

        const entity = await POIUtils.draw({
            id:        'poi-canvas-image',
            longitude: 2,
            latitude:  48,
            height:    100,
            visible:   true,
            image: {
                src:    canvas,
                width:  40,
                height: 30,
            },
        })

        expect(propertyValue(entity.billboard.image)).toBe(canvas)
        expect(globalThis.lgs.viewer.scene.requestRender).toHaveBeenCalledOnce()
    })
})
