/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ion-layer-utils-cache.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-30
 * Last modified: 2026-06-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { beforeEach, describe, expect, it, vi } from 'vitest'

const cacheManagerInstances = []

vi.mock('@Core/cache/CacheManager', () => ({
    CacheManager: vi.fn().mockImplementation(function CacheManager(cacheName, maxQuota) {
        this.cacheName = cacheName
        this.maxQuota = maxQuota
        this.clear = vi.fn()
        cacheManagerInstances.push(this)
    }),
}))

vi.mock('cesium', async (importOriginal) => {
    const actual = await importOriginal()

    return {
        ...actual,
        Ion: {
            ...actual.Ion,
            defaultAccessToken: '',
        },
        Cesium3DTileset: {
            ...actual.Cesium3DTileset,
            fromUrl: vi.fn(),
        },
        Google2DImageryProvider: {
            ...actual.Google2DImageryProvider,
            fromIonAssetId: vi.fn(),
        },
        IonImageryProvider: {
            ...actual.IonImageryProvider,
            fromAssetId: vi.fn(),
        },
        IonResource: {
            ...actual.IonResource,
            fromAssetId: vi.fn(),
        },
        createGooglePhotorealistic3DTileset: vi.fn(),
    }
})

import { CacheManager } from '@Core/cache/CacheManager'
import { IonLayerUtils } from '@Utils/cesium/IonLayerUtils'

describe('IonLayerUtils Cesium cache', () => {
    beforeEach(() => {
        cacheManagerInstances.length = 0
        globalThis.__ = {app: {}}
        globalThis.lgs = {
            stores: {
                ion: {
                    token: 'shared-token',
                },
            },
        }
        IonLayerUtils.lastSyncedToken = null
        vi.clearAllMocks()
    })

    it('uses a single persistent Cesium cache name', () => {
        expect(IonLayerUtils.tokenCacheName('token-a')).toBe('cesium-ion-assets')
        expect(IonLayerUtils.tokenCacheName('token-b')).toBe('cesium-ion-assets')
    })

    it('initializes the shared cache once and reuses it across token changes', async () => {
        const firstName = await IonLayerUtils.syncCesiumCache('token-a')

        expect(firstName).toBe('cesium-ion-assets')
        expect(CacheManager).toHaveBeenCalledTimes(1)
        expect(CacheManager).toHaveBeenCalledWith('cesium-ion-assets', 500 * 1024 * 1024)
        expect(globalThis.__.app.cesiumCache).toBeInstanceOf(CacheManager)

        const firstCache = globalThis.__.app.cesiumCache
        const secondName = await IonLayerUtils.syncCesiumCache('token-b')

        expect(secondName).toBe('cesium-ion-assets')
        expect(CacheManager).toHaveBeenCalledTimes(1)
        expect(globalThis.__.app.cesiumCache).toBe(firstCache)
        expect(firstCache.clear).toHaveBeenCalledTimes(1)
        expect(cacheManagerInstances).toHaveLength(1)
    })

    it('creates 3D tiles from a direct URL when provided', async () => {
        const {Cesium3DTileset} = await import('cesium')
        Cesium3DTileset.fromUrl.mockResolvedValue({id: 'tileset'})

        const tileset = await IonLayerUtils.createTileset({
            id: 'external-buildings',
            type: 'tiles3d',
            show: true,
            tiles3d: {
                kind: 'url',
                url:  'https://example.com/tileset.json',
            },
        })

        expect(Cesium3DTileset.fromUrl).toHaveBeenCalledWith(
            'https://example.com/tileset.json',
            expect.objectContaining({
                maximumScreenSpaceError: 16,
                show: true,
            }),
        )
        expect(tileset).toEqual({id: 'tileset'})
    })

    it('passes the provider token explicitly to Ion resources', async () => {
        const {IonResource} = await import('cesium')

        await IonLayerUtils.ionResourceFromAssetId(1, 'provider-token')

        expect(IonResource.fromAssetId).toHaveBeenCalledWith(1, {accessToken: 'provider-token'})
    })

    it('rejects Ion resources when no provider token is available', async () => {
        const {IonResource} = await import('cesium')
        globalThis.lgs.stores.ion.token = ''

        await expect(IonLayerUtils.ionResourceFromAssetId(1)).rejects.toThrow('A Cesium Ion token is required')
        expect(IonResource.fromAssetId).not.toHaveBeenCalled()
    })

    it('creates a Google 2D imagery provider for dedicated Google Maps layers', async () => {
        const {Google2DImageryProvider} = await import('cesium')
        Google2DImageryProvider.fromIonAssetId.mockResolvedValue({id: 'google-imagery'})

        const provider = await IonLayerUtils.imageryProviderFromLayer({
            assetId:     3830182,
            imageryKind: 'google2d',
            mapType:     'satellite',
        }, {accessToken: 'google-token'})

        expect(Google2DImageryProvider.fromIonAssetId).toHaveBeenCalledWith({
            assetId:          3830182,
            accessToken:      'google-token',
            mapType:          'satellite',
            overlayLayerType: undefined,
        })
        expect(provider).toEqual({id: 'google-imagery'})
    })

    it('creates Google Photorealistic 3D Tiles with the layer visibility', async () => {
        const {createGooglePhotorealistic3DTileset} = await import('cesium')
        createGooglePhotorealistic3DTileset.mockResolvedValue({id: 'google-3d'})

        const tileset = await IonLayerUtils.createTileset({
            id:        'google-photorealistic-3d',
            type:      'base3d',
            show:      true,
            sceneKind: 'google-photorealistic',
        }, {accessToken: 'google-token'})

        expect(createGooglePhotorealistic3DTileset).toHaveBeenCalledWith(
            {onlyUsingWithGoogleGeocoder: true},
            {
                show: true,
            },
        )
        expect(tileset).toEqual({id: 'google-3d'})
    })
})
