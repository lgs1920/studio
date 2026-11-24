/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: startup-data-loader.test.js
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

import {describe, expect, it, vi} from 'vitest'

const mocks = vi.hoisted(() => ({
        draw:               vi.fn(),
        readCurrentFromDB:  vi.fn(),
        setProfileVisibility: vi.fn(),
        updateTrackVisibility: vi.fn(),
        updatePOIsVisibility: vi.fn(),
}))

vi.mock('cesium', async importOriginal => {
    const actual = await importOriginal()
    return {
        ...actual,
        CustomDataSource: class {
            constructor(name) {
                this.name = name
            }
        },
        GeoJsonDataSource: class {
            constructor(name) {
                this.name = name
            }
        },
    }
})

vi.mock('@Core/Journey', () => ({
    Journey: {
        deserialize: ({object}) => {
            const tracks = new Map((object?.tracks ?? [])
                .filter(item => item && Object.prototype.hasOwnProperty.call(item, 'key'))
                .map(item => [item.key, item.value]))
            return {
                ...object,
                addToEditor:      vi.fn(),
                globalSettings:   vi.fn(),
                tracks,
                updateVisibility: vi.fn(),
                visible:          true,
            }
        },
        readFromDB: vi.fn(),
    },
}))

vi.mock('@Core/MapPOI', () => ({
    MapPOI: class {
        constructor(data = {}) {
            Object.assign(this, data)
        }
    },
}))

vi.mock('@Core/Track', () => ({
    Track: class {
        constructor(title, options = {}) {
            Object.assign(this, options)
            this.addToEditor = vi.fn()
            this.slug = options.slug
            this.title = title
            this.visible = options.visible ?? true
        }
    },
}))

vi.mock('@Utils/cesium/TrackUtils', () => ({
    TrackUtils: {
        draw:                  mocks.draw,
        readCurrentFromDB:     mocks.readCurrentFromDB,
        readRemainingFromDB:   vi.fn(),
        setProfileVisibility:  mocks.setProfileVisibility,
        updateTrackVisibility: mocks.updateTrackVisibility,
        updatePOIsVisibility:  mocks.updatePOIsVisibility,
    },
}))

const {StartupDataLoader} = await import('@Core/ui/startup/StartupDataLoader')

describe('startup data loader', () => {
    it('loads a Journey with saved Fix Path corrections before its first track draw', async () => {
        const sources = new Map()
        const previousLgs = globalThis.lgs
        const previousNamespace = globalThis.__
        const previousScheduler = globalThis.scheduler

        globalThis.lgs = {
            journeys:          new Map(),
            markJourneyLoaded: vi.fn(),
            saveJourneyInContext: journey => globalThis.lgs.journeys.set(journey.slug, journey),
            scene:             {requestRender: vi.fn()},
            settings:          {journey: {}, layers: {terrain: 'terrain-a'}},
            stores:            {main: {readyForTheShow: false}},
            viewer:            {
                dataSources: {
                    add:       async source => sources.set(source.name, source),
                    getByName: name => [sources.get(name)].filter(Boolean),
                },
            },
        }
        globalThis.__ = {ui: {poiManager: {list: new Map()}}}
        vi.stubGlobal('requestIdleCallback', callback => {
            callback()
            return 1
        })
        globalThis.scheduler = {yield: async () => {}}
        mocks.draw.mockResolvedValue(undefined)

        const client = {
            request: vi.fn(async (_request, consume) => {
                await consume({data: {
                    fixPathEnabled: true,
                    fixPathCorrectionData: {
                        revision: 2,
                        tracks: {'track-a': []},
                    },
                    slug: 'journey-a',
                }, type: 'journey'})
                await consume({
                    data: {geometryType: 'LineString', slug: 'track-a', title: 'Track A'},
                    key:  'track-a',
                    type: 'track',
                })
                await consume({geometry: {coordinates: [[1, 1], [2, 2]], type: 'LineString'}, type: 'geometry'})
                await consume({key: 'track-a', type: 'track-end'})
                await consume({items: [], type: 'pois'})
                await consume({type: 'primary-ready'})
                return true
            }),
        }

        try {
            const loader = new StartupDataLoader('studio-db', client)

            const loadedJourney = await loader.loadJourney('journey-a', {current: true, currentTrackKey: 'track-a'})
            expect(loadedJourney).toMatchObject({
                fixPathEnabled: true,
                fixPathCorrectionData: {revision: 2, tracks: {'track-a': []}},
                slug: 'journey-a',
            })
            await vi.waitFor(() => expect(mocks.draw).toHaveBeenCalledOnce())

            expect(mocks.draw).toHaveBeenCalledWith(expect.objectContaining({slug: 'track-a'}), expect.objectContaining({
                action:           3,
                forcedToHide:     false,
                renderMode:       'primitive',
            }))
        }
        finally {
            globalThis.lgs = previousLgs
            globalThis.__ = previousNamespace
            globalThis.scheduler = previousScheduler
            vi.unstubAllGlobals()
            mocks.draw.mockReset()
            mocks.readCurrentFromDB.mockReset()
            mocks.setProfileVisibility.mockReset()
            mocks.updateTrackVisibility.mockReset()
        }
    })

    it('retains the saved Fix Path state when the legacy loader reads the current Journey', async () => {
        const previousLgs = globalThis.lgs
        const previousNamespace = globalThis.__
        const previousScheduler = globalThis.scheduler
        const track = {parent: 'journey-a', slug: 'track-a'}
        const journey = {
            fixPathEnabled: true,
            fixPathCorrectionData: {revision: 1, tracks: {'track-a': []}},
            slug: 'journey-a',
            tracks: new Map([['track-a', track]]),
        }
        mocks.readCurrentFromDB.mockResolvedValue(journey)
        globalThis.lgs = {
            db: {lgs1920: {get: vi.fn(async () => null)}},
            theTrack: track,
        }
        globalThis.__ = {ui: {poiManager: {list: new Map()}}}
        globalThis.scheduler = {yield: async () => {}}
        vi.stubGlobal('requestIdleCallback', callback => {
            callback()
            return 1
        })

        try {
            const loader = new StartupDataLoader('studio-db', null)

            await expect(loader.loadCurrentJourney()).resolves.toBe(journey)
            expect(mocks.readCurrentFromDB).toHaveBeenCalledWith()
            expect(journey.fixPathEnabled).toBe(true)
            expect(journey.fixPathCorrectionData.revision).toBe(1)
        }
        finally {
            globalThis.lgs = previousLgs
            globalThis.__ = previousNamespace
            globalThis.scheduler = previousScheduler
            vi.unstubAllGlobals()
            mocks.draw.mockReset()
            mocks.readCurrentFromDB.mockReset()
        }
    })

    it('persists POI display defaults before installing worker-loaded POIs', async () => {
        const previousLgs = globalThis.lgs
        const previousNamespace = globalThis.__
        const data = {id: 'poi-a', type: 'poi', display: {category: true}}
        const list = new Map()
        const ensurePersistedDisplaySettings = vi.fn(async poiData => {
            poiData.display = {category: true, titleCategoryIcon: false, maxWidth: 200}
        })
        const addToJourneyIndex = vi.fn()
        globalThis.lgs = {theJourney: {slug: 'journey-a'}}
        globalThis.__ = {
            ui: {
                poiManager: {
                    list,
                    addToJourneyIndex,
                    ensurePersistedDisplaySettings,
                },
            },
        }

        const client = {
            request: vi.fn(async (_request, consume) => {
                await consume({items: [data], type: 'pois'})
                return true
            }),
        }

        try {
            const loader = new StartupDataLoader('studio-db', client)
            await loader.loadPOIs({currentOnly: true})

            expect(client.request.mock.calls[0][0].globalParent).toBe('__global__')
            expect(ensurePersistedDisplaySettings).toHaveBeenCalledWith(data)
            expect(list.get(data.id)).toMatchObject({
                display: {category: true, titleCategoryIcon: false, maxWidth: 200},
            })
            expect(addToJourneyIndex).toHaveBeenCalledWith(data.id, list.get(data.id))
        }
        finally {
            globalThis.lgs = previousLgs
            globalThis.__ = previousNamespace
        }
    })

    it('loads a secondary journey catalog without rendering secondary tracks', async () => {
        const database = 'studio-db'
        const previousLgs = globalThis.lgs
        const previousNamespace = globalThis.__

        globalThis.lgs = {
            journeys:             new Map(),
            markJourneyLoaded:    vi.fn(),
            saveJourneyInContext: journey => globalThis.lgs.journeys.set(journey.slug, journey),
            scene:                {requestRender: vi.fn()},
            settings:              {journey: {hideOtherJourneys: true}},
            stores:               {main: {journeysReady: false, readyForTheShow: false}},
            theJourney:           {slug: 'current-journey'},
            viewer:               {dataSources: {add: vi.fn(), getByName: vi.fn(() => [])}},
        }
        globalThis.__ = {ui: {poiManager: {list: new Map()}}}

        const client = {
            request: vi.fn(async (_request, consume) => {
                await consume({
                    data: {
                        slug:   'journey-a',
                        title:  'Journey A',
                        tracks: [{key: 'track-a', value: {slug: 'track-a', title: 'Track A'}}, {__type: 'Map'}],
                    },
                    type: 'journey-summary',
                })
                return true
            }),
        }

        try {
            const loader = new StartupDataLoader(database, client)

            await expect(loader.loadRemainingJourneys()).resolves.toHaveLength(1)
            expect(globalThis.lgs.stores.main.journeysReady).toBe(true)
            expect(globalThis.lgs.markJourneyLoaded).not.toHaveBeenCalled()
            expect(mocks.draw).not.toHaveBeenCalled()
            expect(globalThis.lgs.journeys.get('journey-a')).toMatchObject({
                isStartupSummary: true,
                tracksLoaded:      false,
            })
        }
        finally {
            globalThis.lgs = previousLgs
            globalThis.__ = previousNamespace
        }
    })

    it('reuses one worker for the journey catalog', async () => {
        const workers = []
        const previousLgs = globalThis.lgs
        const previousNamespace = globalThis.__
        const previousScheduler = globalThis.scheduler

        class WorkerStub {
            constructor() {
                this.onmessage = null
                this.onmessageerror = null
                this.onerror = null
                this.terminate = vi.fn()
                this.pendingPackets = []
                workers.push(this)
            }

            postMessage = message => {
                if (message.type === 'ack') {
                    queueMicrotask(() => this.sendNext())
                    return
                }
                if (message.type !== 'request') {
                    return
                }

                if (message.requestType === 'journey-catalog') {
                    this.pendingPackets = [
                        {data: {slug: 'journey-a', tracks: [{__type: 'Map'}]}, type: 'journey-summary'},
                        {data: {slug: 'journey-b', tracks: [{__type: 'Map'}]}, type: 'journey-summary'},
                        {result: true, type: 'done'},
                    ]
                }
                this.sendNext()
            }

            sendNext = () => {
                const next = this.pendingPackets.shift()
                if (!next) {
                    return
                }
                if (next.type === 'done') {
                    this.onmessage?.({data: next})
                    return
                }
                this.onmessage?.({data: {data: next, id: next.id ?? 1, type: 'packet'}})
            }
        }

        globalThis.lgs = {
            journeys:             new Map(),
            markJourneyLoaded:    vi.fn(),
            saveJourneyInContext: journey => globalThis.lgs.journeys.set(journey.slug, journey),
            scene:                {requestRender: vi.fn()},
            stores:               {main: {journeysReady: false, readyForTheShow: false}},
            viewer:               {dataSources: {add: vi.fn(), getByName: vi.fn(() => [])}},
        }
        globalThis.__ = {ui: {poiManager: {list: new Map()}}}
        vi.stubGlobal('Worker', WorkerStub)
        vi.stubGlobal('requestIdleCallback', callback => {
            callback()
            return 1
        })
        globalThis.scheduler = {yield: async () => {}}

        try {
            const loader = new StartupDataLoader('studio-db')

            await expect(loader.loadRemainingJourneys()).resolves.toHaveLength(2)
            expect(workers).toHaveLength(1)
            expect(globalThis.lgs.stores.main.journeysReady).toBe(true)
            expect(globalThis.lgs.markJourneyLoaded).not.toHaveBeenCalled()
            expect(mocks.draw).not.toHaveBeenCalled()
            expect(globalThis.lgs.journeys.has('journey-a')).toBe(true)
            expect(globalThis.lgs.journeys.has('journey-b')).toBe(true)
        }
        finally {
            globalThis.lgs = previousLgs
            globalThis.__ = previousNamespace
            globalThis.scheduler = previousScheduler
            vi.unstubAllGlobals()
            mocks.draw.mockReset()
            mocks.setProfileVisibility.mockReset()
        }
    })

    it('loads a selected journey and its POIs progressively through the worker', async () => {
        const sources = new Map()
        const previousLgs = globalThis.lgs
        const previousNamespace = globalThis.__
        const previousScheduler = globalThis.scheduler
        const onSpatialReady = vi.fn()
        const onFirstTrackReady = vi.fn()

        globalThis.lgs = {
            journeys:             new Map(),
            markJourneyLoaded:    vi.fn(),
            saveJourneyInContext: journey => globalThis.lgs.journeys.set(journey.slug, journey),
            scene:                {requestRender: vi.fn()},
            settings:             {journey: {hideOtherJourneys: false}},
            stores:               {main: {readyForTheShow: false}},
            theJourney:           {slug: 'current-journey'},
            viewer:               {
                dataSources: {
                    add:       async source => sources.set(source.name, source),
                    getByName: name => [sources.get(name)].filter(Boolean),
                },
            },
        }
        const list = new Map()
        globalThis.__ = {ui: {poiManager: {list, addToJourneyIndex: vi.fn()}}}
        vi.stubGlobal('requestIdleCallback', callback => {
            callback()
            return 1
        })
        globalThis.scheduler = {yield: async () => {}}
        mocks.draw.mockResolvedValue(undefined)

        const client = {
            request: vi.fn(async (_request, consume) => {
                await consume({
                    data:      {slug: 'journey-b', title: 'Journey B'},
                    spatial:   {bounds: [1, 1, 2, 2], centroid: {latitude: 1.5, longitude: 1.5}},
                    trackKeys: ['track-b'],
                    type:      'journey',
                })
                await consume({
                    data: {geometryType: 'LineString', slug: 'track-b', title: 'Track B'},
                    key:  'track-b',
                    type: 'track',
                })
                await consume({geometry: {coordinates: [[1, 1], [2, 2]], type: 'LineString'}, type: 'geometry'})
                await consume({key: 'track-b', type: 'track-end'})
                await consume({items: [{id: 'poi-b', parent: 'journey-b'}], type: 'pois'})
                await consume({type: 'journey-end'})
                return true
            }),
        }

        try {
            const loader = new StartupDataLoader('studio-db', client)
            const firstLoad = loader.ensureJourneyLoaded('journey-b', {onFirstTrackReady, onSpatialReady})
            const secondLoad = loader.ensureJourneyLoaded('journey-b')
            const journey = await firstLoad
            await secondLoad

            expect(client.request).toHaveBeenCalledOnce()
            expect(client.request.mock.calls[0][0]).toMatchObject({loadPOIs: true, type: 'journey'})
            expect(onSpatialReady).toHaveBeenCalledWith(journey, expect.objectContaining({
                centroid: {latitude: 1.5, longitude: 1.5},
            }))
            expect(onFirstTrackReady).toHaveBeenCalledWith(journey, expect.objectContaining({slug: 'track-b'}))
            expect(list.has('poi-b')).toBe(true)
            expect(mocks.draw).toHaveBeenCalledWith(
                expect.objectContaining({slug: 'track-b'}),
                expect.objectContaining({renderMode: 'primitive'}),
            )
            expect(journey.tracksLoaded).toBe(true)
            expect(globalThis.lgs.markJourneyLoaded).toHaveBeenCalledWith('journey-b')
        }
        finally {
            globalThis.lgs = previousLgs
            globalThis.__ = previousNamespace
            globalThis.scheduler = previousScheduler
            vi.unstubAllGlobals()
            mocks.draw.mockReset()
        }
    })
})
