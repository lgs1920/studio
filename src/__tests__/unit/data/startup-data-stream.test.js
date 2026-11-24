/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: startup-data-stream.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-20
 * Last modified: 2026-11-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    streamStartupJourney, streamStartupJourneyCatalog, streamStartupPOIs,
} from '@Core/ui/startup/startupData'
import {describe, expect, it, vi} from 'vitest'

const line = coordinates => ({
    type:       'Feature',
    properties: {},
    geometry:   {
        type:        'LineString',
        coordinates,
    },
})

const serializedTracks = [
    {__type: 'Map'},
    {key: 'track-a', value: {title: 'Track A', content: line([[1, 1], [2, 2]])}},
    {key: 'track-b', value: {title: 'Track B', content: line([[3, 3], [4, 4]])}},
]

describe('startup data streaming', () => {
    it('streams the persisted current track first', async () => {
        const packets = []
        const trackEnds = []

        await streamStartupJourney({slug: 'journey-a', tracks: serializedTracks}, async packet => {
            packets.push(packet)
        }, {
            onTrackEnd: ({key}) => trackEnds.push(key),
            preferredTrackKey: 'track-b',
        })

        expect(packets.filter(packet => packet.type === 'track').map(packet => packet.key))
            .toEqual(['track-b', 'track-a'])
        expect(trackEnds).toEqual(['track-b', 'track-a'])
        expect(packets[0]).toMatchObject({
            spatial:   {bounds: [1, 1, 4, 4], centroid: {latitude: 2.5, longitude: 2.5}},
            trackKeys: ['track-b', 'track-a'],
        })
    })

    it('streams a catalog summary without transferring track geometry or metrics', async () => {
        const packets = []

        await streamStartupJourneyCatalog([
            [{
                activity: 'cycling',
                metrics:  {global: {distance: 100}, points: [[1, 1]]},
                slug:     'journey-a',
                title:    'Journey A',
                tracks:   [
                    {__type: 'Map'},
                    {
                        key:   'track-a',
                        value: {
                            color:   '#fff',
                            content: line([[1, 1], [2, 2]]),
                            metrics: {points: [[1, 1]]},
                            renderStyle: {color: '#fff'},
                            slug:    'track-a',
                            title:   'Track A',
                        },
                    },
                ],
            }],
        ], async packet => packets.push(packet))

        expect(packets).toHaveLength(1)
        expect(packets[0].data).toMatchObject({
            activity: 'cycling',
            slug:     'journey-a',
            title:    'Journey A',
        })
        expect(packets[0].data.metrics).toBeUndefined()
        expect(packets[0].data.tracks).toContainEqual({
            key:   'track-a',
            value: {
                color:       '#fff',
                renderStyle: {color: '#fff'},
                slug:        'track-a',
                title:       'Track A',
            },
        })
        expect(packets[0].data.tracks[0].value.content).toBeUndefined()
        expect(packets[0].data.tracks[0].value.metrics).toBeUndefined()
        expect(packets[0].spatial).toEqual({bounds: [1, 1, 2, 2], centroid: {latitude: 1.5, longitude: 1.5}})
    })

    it('keeps feature metadata and non-line geometry in the worker contract', async () => {
        const packets = []
        const content = {
            type:       'Feature',
            id:         'track-feature',
            properties: {coordinateProperties: {times: ['2026-01-01T00:00:00Z']}},
            bbox:       [1, 2, 3, 4],
            geometry:   {type: 'Point', coordinates: [1, 2, 3]},
        }

        await streamStartupJourney({
                                  slug:   'journey-a',
                                  tracks: [{key: 'track-a', value: {title: 'Track A', content}}],
                              }, async packet => {
                                  packets.push(packet)
                              })

        expect(packets.find(packet => packet.type === 'track').data.contentMetadata).toEqual({
                                                                                                  type:       'Feature',
                                                                                                  id:         'track-feature',
                                                                                                  properties: content.properties,
                                                                                                  bbox:       content.bbox,
                                                                                              })
        expect(packets.find(packet => packet.type === 'geometry')).toEqual({
                                                                                type:     'geometry',
                                                                                geometry: content.geometry,
                                                                            })
    })

    it('signals the first POI batch while filtering to the current journey', async () => {
        const packets = []
        const batches = []
        const emit = vi.fn(async packet => packets.push(packet))

        await streamStartupPOIs([
                                  {id: 'poi-a', parent: 'journey-a', visible: true},
                                  {id: 'poi-b', parent: 'journey-b', visible: true},
                              ], emit, {
                                  batchSize:    1,
                                  currentOnly:  true,
                                  onBatch:      items => batches.push(items.map(item => item.id)),
                                  parents:      ['journey-a'],
                              })

        expect(packets).toEqual([{type: 'pois', items: [{id: 'poi-a', parent: 'journey-a', visible: true}]}])
        expect(batches).toEqual([['poi-a']])
    })

    it('includes global POIs in current-journey batches and hidden POIs in full batches', async () => {
        const currentPackets = []
        const allPackets = []
        const pois = [
            {id: 'journey-visible', parent: 'journey-a', visible: true},
            {id: 'journey-hidden', parent: 'journey-a', visible: false},
            {id: 'other-journey', parent: 'journey-b', visible: true},
            {id: 'global-visible', parent: null, visible: true},
            {id: 'global-hidden', parent: '__global__', visible: false},
            {id: 'starter-hidden', parent: null, type: 'starter', visible: false},
        ]

        await streamStartupPOIs(pois, async packet => currentPackets.push(packet), {
            currentOnly:  true,
            globalParent: '__global__',
            includeStarter: false,
            parents:      ['journey-a'],
        })
        await streamStartupPOIs(pois, async packet => allPackets.push(packet), {
            currentOnly: false,
        })

        expect(currentPackets.flatMap(packet => packet.items.map(poi => poi.id))).toEqual([
            'journey-visible',
            'global-visible',
            'global-hidden',
        ])
        expect(allPackets.flatMap(packet => packet.items.map(poi => poi.id))).toEqual(pois.map(poi => poi.id))
    })
})
