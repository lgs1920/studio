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
 * Last modified: 2026-09-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, it, vi} from 'vitest'

const mocks = vi.hoisted(() => ({
    draw:               vi.fn(),
    setProfileVisibility: vi.fn(),
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
        deserialize: ({object}) => ({
            ...object,
            addToEditor:     vi.fn(),
            globalSettings:  vi.fn(),
            tracks:          new Map(),
            updateVisibility: vi.fn(),
            visible:         true,
        }),
    },
}))

vi.mock('@Core/MapPOI', () => ({
    MapPOI: class {},
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
        draw:                 mocks.draw,
        readCurrentFromDB:    vi.fn(),
        readRemainingFromDB:  vi.fn(),
        setProfileVisibility: mocks.setProfileVisibility,
    },
}))

const {StartupDataLoader} = await import('@Core/ui/startup/StartupDataLoader')

describe('startup data loader', () => {
    it('renders secondary tracks even when hide other journeys keeps them hidden', async () => {
        const sources = new Map()
        const database = 'studio-db'
        const previousLgs = globalThis.lgs
        const previousNamespace = globalThis.__
        const previousScheduler = globalThis.scheduler
        let resolveDraw
        const drawCompleted = new Promise(resolve => {
            resolveDraw = resolve
        })
        const postTask = vi.fn(async callback => callback())

        mocks.draw.mockImplementationOnce(() => resolveDraw())

        globalThis.lgs = {
            journeys:             new Map(),
            saveJourneyInContext: journey => globalThis.lgs.journeys.set(journey.slug, journey),
            scene:                {requestRender: vi.fn()},
            settings:              {journey: {hideOtherJourneys: true}},
            stores:               {main: {journeysReady: false, readyForTheShow: false}},
            theJourney:           {slug: 'current-journey'},
            viewer:               {
                dataSources: {
                    add:      async source => sources.set(source.name, source),
                    getByName: name => [sources.get(name)].filter(Boolean),
                },
            },
        }
        globalThis.__ = {ui: {poiManager: {list: new Map()}}}
        vi.stubGlobal('requestIdleCallback', callback => {
            callback()
            return 1
        })
        globalThis.scheduler = {postTask, yield: async () => {}}

        const client = {
            request: vi.fn(async (request, consume) => {
                if (request.type === 'journey-keys') {
                    await consume({keys: ['journey-a'], type: 'journey-keys'})
                    return true
                }

                await consume({data: {slug: 'journey-a'}, type: 'journey'})
                await consume({data: {geometryType: 'LineString', slug: 'track-a', title: 'Track A'}, key: 'track-a', type: 'track'})
                await consume({geometry: {coordinates: [[1, 1], [2, 2]], type: 'LineString'}, type: 'geometry'})
                await consume({key: 'track-a', type: 'track-end'})
                await consume({type: 'journey-end'})
                return true
            }),
        }

        try {
            const loader = new StartupDataLoader(database, client)

            await expect(loader.loadRemainingJourneys()).resolves.toHaveLength(1)
            expect(globalThis.lgs.stores.main.journeysReady).toBe(true)
            await drawCompleted
            expect(mocks.draw).toHaveBeenCalledOnce()
            expect(mocks.draw).toHaveBeenCalledWith(expect.objectContaining({slug: 'track-a'}), {
                action:       3,
                forcedToHide: true,
                renderMode:   'primitive',
            })
            expect(postTask).toHaveBeenCalledWith(expect.any(Function), {priority: 'background'})
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

    it('reuses one worker for the secondary journey queue', async () => {
        const sources = new Map()
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

                if (message.requestType === 'journey-keys') {
                    this.pendingPackets = [
                        {keys: ['journey-a', 'journey-b'], type: 'journey-keys'},
                        {result: true, type: 'done'},
                    ]
                }
                else {
                    this.pendingPackets = [
                        {data: {slug: message.key, tracks: [{__type: 'Map'}]}, type: 'journey'},
                        {
                            data: {
                                geometryType: 'LineString',
                                key:          `${message.key}-track`,
                                slug:         `${message.key}-track`,
                                title:        `${message.key} track`,
                            },
                            key:  `${message.key}-track`,
                            type: 'track',
                        },
                        {coordinates: [[1, 1], [2, 2]], type: 'geometry'},
                        {key: `${message.key}-track`, type: 'track-end'},
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
            saveJourneyInContext: journey => globalThis.lgs.journeys.set(journey.slug, journey),
            scene:                {requestRender: vi.fn()},
            stores:               {main: {journeysReady: false, readyForTheShow: false}},
            viewer:               {
                dataSources: {
                    add:      async source => sources.set(source.name, source),
                    getByName: name => [sources.get(name)].filter(Boolean),
                },
            },
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
            await vi.waitFor(() => expect(mocks.draw).toHaveBeenCalledTimes(2))
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
})
