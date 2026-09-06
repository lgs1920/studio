/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: orbit-settings.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-06
 * Last modified: 2026-09-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { CURRENT_JOURNEY, CURRENT_POI } from '@Core/constants'
import { Journey }                         from '@Core/Journey'
import { getOrbitSettings, persistOrbitSettings } from '@Core/OrbitSettings'
import { afterEach, describe, expect, it, vi }  from 'vitest'
import { proxy }                            from 'valtio'

const clone = value => {
    if (value === null || typeof value !== 'object') {
        return value
    }
    if (value instanceof Map) {
        return new Map(Array.from(value.entries(), ([key, entry]) => [key, clone(entry)]))
    }
    if (Array.isArray(value)) {
        return value.map(clone)
    }
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clone(entry)]))
}

describe('target rotation settings', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('uses target settings before the standard fallback', () => {
        const settings = getOrbitSettings(
            {rotation: {rpm: 0.6, direction: -1}},
            'rotation',
            {rpm: 3, direction: 1},
        )

        expect(settings).toEqual({rpm: 0.6, direction: -1})
    })

    it('resolves persisted journey settings when the runtime target only keeps its identity', () => {
        const journey = {
            element:  CURRENT_JOURNEY,
            slug:     'journey-a',
            panorama: {rpm: 0.8},
        }
        vi.stubGlobal('lgs', {
                              getJourneyBySlug: vi.fn(() => journey),
                          })

        const settings = getOrbitSettings(
            {element: CURRENT_JOURNEY, slug: journey.slug},
            'panorama',
            {rpm: 3},
        )

        expect(settings.rpm).toBe(0.8)
    })

    it('resolves the active journey from the scene target when the runtime target only has coordinates', () => {
        const journey = {
            element:  CURRENT_JOURNEY,
            slug:     'journey-a',
            rotation: {rpm: 0.8},
        }
        vi.stubGlobal('lgs', {
                              theJourney: journey,
                          })
        vi.stubGlobal('__', {
                             ui: {
                                 sceneManager: {
                                     target: journey,
                                 },
                             },
                         })

        const settings = getOrbitSettings(
            {longitude: 5, latitude: 45, height: 1200},
            'rotation',
            {rpm: 3},
        )

        expect(settings.rpm).toBe(0.8)
    })

    it('persists rotation settings in a journey without requiring a POI', async () => {
        const journey = {
            element:          CURRENT_JOURNEY,
            slug:             'journey-a',
            rotation:         {},
            persistToDatabase: vi.fn(async () => undefined),
        }
        vi.stubGlobal('lgs', {
                              getJourneyBySlug: vi.fn(() => journey),
                          })

        await persistOrbitSettings({element: CURRENT_JOURNEY, slug: journey.slug}, 'rotation', {rpm: 0.6})

        expect(journey.rotation.rpm).toBe(0.6)
        expect(journey.persistToDatabase).toHaveBeenCalledTimes(1)
    })

    it('persists in the current journey when the centroid target only has coordinates', async () => {
        const journey = {
            element:          CURRENT_JOURNEY,
            slug:             'journey-a',
            rotation:         {},
            persistToDatabase: vi.fn(async () => undefined),
        }
        vi.stubGlobal('lgs', {theJourney: journey})
        vi.stubGlobal('__', {
                             ui: {
                                 sceneManager: {target: null},
                             },
                         })

        await persistOrbitSettings(
            {longitude: 5, latitude: 45, height: 1200},
            'rotation',
            {rpm: 1},
        )

        expect(journey.rotation.rpm).toBe(1)
        expect(journey.persistToDatabase).toHaveBeenCalledTimes(1)
    })

    it('reads the current journey RPM for an anonymous centroid at startup', () => {
        const journey = {
            element:  CURRENT_JOURNEY,
            slug:     'journey-a',
            rotation: {rpm: 1},
        }
        vi.stubGlobal('lgs', {theJourney: journey})
        vi.stubGlobal('__', {
                             ui: {
                                 sceneManager: {target: null},
                             },
                         })

        const settings = getOrbitSettings(
            {longitude: 5, latitude: 45, height: 1200},
            'rotation',
            {rpm: 3},
        )

        expect(settings.rpm).toBe(1)
    })

    it('writes the changed journey RPM to the same payload read after restart', async () => {
        const storedJourneys = []
        vi.stubGlobal('__', {
                             app: {
                                 deepClone: clone,
                                 singleTitle: title => title,
                             },
                         })
        vi.stubGlobal('lgs', {
                              journeys: new Map(),
                              db: {
                                  lgs1920: {
                                      put: vi.fn(async (slug, value) => {
                                          storedJourneys.push({slug, value})
                                      }),
                                  },
                              },
                          })
        const journey = proxy(new Journey('Journey A', 'GPX', {slug: 'journey-a'}))
        lgs.theJourney = journey

        await persistOrbitSettings({element: CURRENT_JOURNEY, slug: journey.slug}, 'rotation', {rpm: 1})

        const persisted = storedJourneys.at(-1)?.value
        const restored = Journey.deserialize({object: persisted, reset: true})
        expect(persisted.rotation.rpm).toBe(1)
        expect(restored.rotation.rpm).toBe(1)
    })

    it('falls back to the active journey when the journey index is not ready', async () => {
        const journey = {
            element:          CURRENT_JOURNEY,
            slug:             'journey-a',
            rotation:         {},
            persistToDatabase: vi.fn(async () => undefined),
        }
        vi.stubGlobal('lgs', {theJourney: journey})

        await persistOrbitSettings({element: CURRENT_JOURNEY, slug: journey.slug}, 'rotation', {rpm: 1})

        expect(journey.rotation.rpm).toBe(1)
        expect(journey.persistToDatabase).toHaveBeenCalledTimes(1)
    })

    it('prefers the active journey over a stale journey index entry', async () => {
        const activeJourney = {
            element:          CURRENT_JOURNEY,
            slug:             'journey-a',
            rotation:         {},
            persistToDatabase: vi.fn(async () => undefined),
        }
        const indexedJourney = {
            element:          CURRENT_JOURNEY,
            slug:             'journey-a',
            rotation:         {rpm: 2},
            persistToDatabase: vi.fn(async () => undefined),
        }
        vi.stubGlobal('lgs', {
                              theJourney:     activeJourney,
                              getJourneyBySlug: vi.fn(() => indexedJourney),
                          })

        await persistOrbitSettings({element: CURRENT_JOURNEY, slug: activeJourney.slug}, 'rotation', {rpm: 1})

        expect(activeJourney.rotation.rpm).toBe(1)
        expect(activeJourney.persistToDatabase).toHaveBeenCalledTimes(1)
        expect(indexedJourney.rotation.rpm).toBe(2)
    })

    it('persists panorama settings in a POI when the target is a POI', async () => {
        const poi = {
            element: CURRENT_POI,
            id:      'poi-a',
            panorama: {},
        }
        const updatePOI = vi.fn(async () => undefined)
        vi.stubGlobal('lgs', {
                              stores: {
                                  main: {
                                      components: {
                                          pois: {
                                              list: new Map([[poi.id, poi]]),
                                          },
                                      },
                                  },
                              },
                          })
        vi.stubGlobal('__', {
                             ui: {
                                 poiManager: {
                                     updatePOI,
                                 },
                             },
                         })

        await persistOrbitSettings({element: CURRENT_POI, id: poi.id}, 'panorama', {rpm: 0.8})

        expect(updatePOI).toHaveBeenCalledWith(poi.id, {panorama: {rpm: 0.8}})
    })
})
