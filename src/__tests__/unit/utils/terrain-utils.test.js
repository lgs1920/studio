/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: terrain-utils.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-14
 * Last modified: 2026-10-14
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, describe, expect, it, vi} from 'vitest'
import YAML from 'yaml'
import {readFileSync} from 'node:fs'
import {Resource, sampleTerrain, sampleTerrainMostDetailed} from 'cesium'
import {TerrainUtils} from '@Utils/cesium/TerrainUtils'
import {MapterhornTerrainProvider} from '@Utils/cesium/MapterhornTerrainProvider'

vi.mock('cesium', async importOriginal => ({
    ...await importOriginal(),
    sampleTerrain: vi.fn(async (provider, level, positions) => positions),
    sampleTerrainMostDetailed: vi.fn(async (provider, positions) => positions),
}))

afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
})

/** Resolve the actual public terrain definition for factory tests. */
const mapterhornLayer = () => YAML.parse(readFileSync('public/layers-terrains.yaml', 'utf8'))
    .providers.find(provider => provider.id === 'mapterhorn').layers[0]

describe('Mapterhorn terrain integration', () => {
    it('creates the selected catalogue terrain without an Ion token', async () => {
        const layer = mapterhornLayer()
        vi.stubGlobal('__', {layersAndTerrainManager: {getEntityProxy: id => id === layer.id ? layer : null}})
        const provider = await TerrainUtils.setTerrain(layer.id)

        expect(provider).toBeInstanceOf(MapterhornTerrainProvider)
        expect(provider.credit.html).toContain('Mapterhorn and its source data providers')
        expect(provider.credit.html).toContain('https://mapterhorn.com/attribution/')
        expect(provider.getTileDataAvailable(0, 0, 17)).toBe(true)
        expect(provider.getTileDataAvailable(0, 0, 18)).toBe(false)
        expect(await TerrainUtils.setTerrain('unknown')).toBeNull()
    })

    it('returns synchronous undefined for deferred and out-of-range requests', () => {
        const fetchBlob = vi.spyOn(Resource.prototype, 'fetchBlob').mockReturnValue(undefined)
        const provider = new MapterhornTerrainProvider()

        expect(provider.requestTileGeometry(1, 2, 3)).toBeUndefined()
        expect(provider.requestTileGeometry(1, 2, 18)).toBeUndefined()
        expect(fetchBlob).toHaveBeenCalledOnce()
    })

    it('decodes and resamples a Terrarium tile to real Cesium terrain data', async () => {
        const pixels = new Uint8ClampedArray([
            128, 100, 0, 255, 128, 200, 0, 255,
            129, 44, 0, 255, 129, 144, 0, 255,
        ])
        const close = vi.fn()
        vi.spyOn(Resource.prototype, 'fetchBlob').mockResolvedValue(new Blob())
        vi.stubGlobal('createImageBitmap', vi.fn(async () => ({width: 2, height: 2, close})))
        vi.stubGlobal('OffscreenCanvas', class {
            /** Return the controlled Terrarium pixel grid. */
            getContext = () => ({drawImage: vi.fn(), getImageData: () => ({data: pixels})})
        })
        const provider = new MapterhornTerrainProvider({heightmapResolution: 3})
        const data = await provider.requestTileGeometry(0, 0, 0)
        const rectangle = provider.tilingScheme.tileXYToRectangle(0, 0, 0)

        expect(data.interpolateHeight(rectangle, 0, 0)).toBeCloseTo(250, 6)
        expect(close).toHaveBeenCalledOnce()
        expect(createImageBitmap).toHaveBeenCalledWith(expect.any(Blob), {
            colorSpaceConversion: 'none', premultiplyAlpha: 'none',
        })
    })

    it('avoids descendants of confirmed missing detailed tiles while preserving neighboring terrain', async () => {
        const failure = Object.assign(new Error('Not found'), {statusCode: 404})
        vi.spyOn(Resource.prototype, 'fetchBlob').mockRejectedValue(failure)
        const provider = new MapterhornTerrainProvider()

        await expect(provider.requestTileGeometry(4, 6, 13)).rejects.toBe(failure)
        expect(provider.getTileDataAvailable(4, 6, 13)).toBe(false)
        expect(provider.getTileDataAvailable(8, 12, 14)).toBe(false)
        expect(provider.getTileDataAvailable(9, 13, 14)).toBe(false)
        expect(provider.getTileDataAvailable(10, 12, 14)).toBe(true)
        expect(provider.getTileDataAvailable(2, 3, 12)).toBe(true)
    })

    it('does not turn transient server errors into missing coverage', async () => {
        const failure = Object.assign(new Error('Server unavailable'), {statusCode: 503})
        vi.spyOn(Resource.prototype, 'fetchBlob').mockRejectedValue(failure)
        const provider = new MapterhornTerrainProvider()

        await expect(provider.requestTileGeometry(4, 6, 13)).rejects.toBe(failure)
        expect(provider.getTileDataAvailable(4, 6, 13)).toBe(true)
    })

    it('samples Mapterhorn at global coverage and preserves most-detailed sampling for existing terrain', async () => {
        const positions = [{longitude: 0, latitude: 0}]
        const provider = new MapterhornTerrainProvider()

        expect(await TerrainUtils.sampleTerrainHeights(positions, {provider})).toBe(positions)
        expect(sampleTerrain).toHaveBeenCalledWith(provider, 12, positions)
        expect(sampleTerrainMostDetailed).not.toHaveBeenCalled()

        const existing = {availability: {}}
        await TerrainUtils.sampleTerrainHeights(positions, {provider: existing})
        expect(sampleTerrainMostDetailed).toHaveBeenCalledWith(existing, positions)
        await TerrainUtils.sampleTerrainHeights(positions, {provider, mostDetailed: false, level: 5})
        expect(sampleTerrain).toHaveBeenLastCalledWith(provider, 5, positions)
    })

    it('applies terrain through the existing Cesium scene boundary and reports load errors', async () => {
        const setTerrain = vi.fn(async terrain => {
            await new Promise(resolve => terrain.readyEvent.addEventListener(resolve))
        })
        const refreshTerrainClamping = vi.fn()
        vi.stubGlobal('__', {ui: {poiManager: {refreshTerrainClamping}}})
        vi.stubGlobal('lgs', {
            scene: {setTerrain},
            stores: {ion: {source: 'app'}},
        })
        await TerrainUtils.changeTerrain(mapterhornLayer())
        expect(setTerrain).toHaveBeenCalledOnce()
        expect(setTerrain.mock.calls[0][0].provider).toBeInstanceOf(MapterhornTerrainProvider)
        expect(refreshTerrainClamping).toHaveBeenCalledOnce()

        setTerrain.mockRejectedValue(new Error('Scene update failed'))
        await expect(TerrainUtils.changeTerrain(mapterhornLayer())).rejects.toThrow('Scene update failed')
    })
})
