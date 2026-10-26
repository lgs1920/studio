/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poi-manager-replay-pois.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-26
 * Last modified: 2026-10-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {POIManager} from '@Core/ui/POIManager'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {proxyMap} from 'valtio/utils'

afterEach(() => {
    POIManager.instance?.destroy()
    vi.unstubAllGlobals()
})

describe('POIManager Replay POI selection', () => {
    it('loads global POIs at startup so Replay can animate them along a selected journey', async () => {
        const journey = {
            slug: 'journey-startup-pois',
            visible: true,
            POIsVisible: true,
            tracks: new Map([['track', {
                slug: 'track',
                content: {geometry: {type: 'LineString', coordinates: [[0, 0], [0.01, 0]]}},
            }]]),
        }
        const pois = [
            {id: 'global-visible', type: 'poi', longitude: 0.002, latitude: 0, visible: true},
            {id: 'global-hidden', type: 'poi', longitude: 0.008, latitude: 0, visible: false},
            {id: 'journey-owned', type: 'poi', parent: journey.slug, longitude: 0.005, latitude: 0, visible: true},
            {id: 'other-journey', type: 'poi', parent: 'journey-other', longitude: 0.006, latitude: 0, visible: true},
        ]
        const poiById = new Map(pois.map(poi => [poi.id, poi]))
        vi.stubGlobal('window', {dispatchEvent: vi.fn()})
        vi.stubGlobal('CustomEvent', class CustomEvent {
            constructor(type, options) {
                this.type = type
                this.detail = options?.detail
            }
        })
        vi.stubGlobal('lgs', {
            settings: {poi: {association: {maxDistance: 1000}}},
            stores: {main: {components: {pois: {list: proxyMap()}}}},
            db: {lgs1920: {
                keys: vi.fn(async () => pois.map(poi => poi.id)),
                get: vi.fn(async id => poiById.get(id)),
            }},
            getJourneyByTrackSlug: vi.fn(() => undefined),
        })
        vi.stubGlobal('__', {ui: {}})

        const manager = new POIManager()
        manager.ensurePersistedDisplaySettings = vi.fn(async () => {})
        const loaded = await manager.readStartupPOIsFromDB({journey})

        expect(loaded.map(poi => poi.id)).toEqual(['global-visible', 'global-hidden', 'journey-owned'])
        expect(manager.getJourneyReplayPOIsForJourney(journey, 1000).map(entry => entry.poi.id)).toEqual([
            'global-visible',
            'journey-owned',
        ])
        expect(manager.getJourneyReplayPOIsForJourney(journey, 1000, {includeHidden: true}).map(entry => entry.poi.id)).toEqual([
            'global-visible',
            'journey-owned',
            'global-hidden',
        ])
    })

    it('includes persisted-hidden POIs when Replay explicitly shows all POIs', () => {
        const visiblePOI = {
            id: 'visible-poi',
            longitude: 0.002,
            latitude: 0,
            visible: true,
        }
        const hiddenPOI = {
            id: 'hidden-poi',
            longitude: 0.008,
            latitude: 0,
            visible: false,
        }
        const list = proxyMap([
            [visiblePOI.id, visiblePOI],
            [hiddenPOI.id, hiddenPOI],
        ])
        const journey = {
            slug: 'journey-replay-pois',
            tracks: new Map([['track', {
                slug: 'track',
                content: {geometry: {type: 'LineString', coordinates: [[0, 0], [0.01, 0]]}},
            }]]),
        }
        vi.stubGlobal('lgs', {
            settings: {poi: {association: {maxDistance: 1000}}},
            stores: {main: {components: {pois: {list}}}},
        })

        const manager = new POIManager()
        const normalResults = manager.getJourneyReplayPOIsForJourney(journey, 1000)
        const showAllResults = manager.getJourneyReplayPOIsForJourney(journey, 1000, {includeHidden: true})

        expect(normalResults.map(entry => entry.poi.id)).toEqual(['visible-poi'])
        expect(showAllResults.map(entry => entry.poi.id)).toEqual(['visible-poi', 'hidden-poi'])
    })
})
