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
 * Last modified: 2026-09-20
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
    it('renders secondary tracks through the capped Cesium render path', async () => {
        const sources = new Map()
        const database = 'studio-db'
        const previousLgs = globalThis.lgs
        const previousNamespace = globalThis.__
        const previousScheduler = globalThis.scheduler
        let resolveDraw
        const drawCompleted = new Promise(resolve => {
            resolveDraw = resolve
        })

        mocks.draw.mockImplementationOnce(() => resolveDraw())

        globalThis.lgs = {
            journeys:             new Map(),
            saveJourneyInContext: journey => globalThis.lgs.journeys.set(journey.slug, journey),
            scene:                {requestRender: vi.fn()},
            stores:               {main: {readyForTheShow: false}},
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
        globalThis.scheduler = {yield: async () => {}}

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
            await drawCompleted
            expect(mocks.draw).toHaveBeenCalledOnce()
            expect(mocks.draw).toHaveBeenCalledWith(expect.objectContaining({slug: 'track-a'}), {
                action:       3,
                forcedToHide: false,
                renderMode:   'primitive',
            })
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
