/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: IonLayerUtils.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-25
 * Last modified on: 2026-06-25
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    BASE3D_ENTITY, PERSONAL_ACCESS, VAULT_STORE,
} from '@Core/constants'
import { CacheManager } from '@Core/cache/CacheManager'
import { Cesium3DTileset, Google2DImageryProvider, Ion, IonImageryProvider, IonResource, createGooglePhotorealistic3DTileset } from 'cesium'

const CESIUM_CACHE_PREFIX = 'cesium-ion-assets'
const DEFAULT_CACHE_QUOTA = 500 * 1024 * 1024

const normalizeToken = value => typeof value === 'string' ? value.trim() : ''

const fnv1a = (input) => {
    const value = normalizeToken(input)
    let hash = 0x811c9dc5

    for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i)
        hash = Math.imul(hash, 0x01000193)
    }

    return `0x${(hash >>> 0).toString(16).padStart(8, '0')}`
}

const getActiveToken = () => normalizeToken(globalThis.lgs?.stores?.ion?.token ?? Ion.defaultAccessToken)

export class IonLayerUtils {
    static tokenCacheName = (token = getActiveToken()) => `${CESIUM_CACHE_PREFIX}-${fnv1a(token)}`

    static async syncCesiumCache(token = getActiveToken(), {purgePrevious = true} = {}) {
        const cacheName = IonLayerUtils.tokenCacheName(token)
        const currentCache = globalThis.__?.app?.cesiumCache
        if (currentCache?.cacheName === cacheName) {
            return cacheName
        }

        if (purgePrevious && currentCache?.cacheName && currentCache.cacheName !== cacheName) {
            try {
                currentCache.clear?.()
            }
            catch (error) {
                console.error('[IonLayerUtils] Failed to clear previous Cesium cache:', error)
            }
        }

        if (globalThis.__?.app) {
            globalThis.__.app.cesiumCache = new CacheManager(cacheName, DEFAULT_CACHE_QUOTA)
        }
        return cacheName
    }

    static async ionResourceFromAssetId(assetId, accessToken = getActiveToken()) {
        const id = Number(assetId)
        if (!Number.isInteger(id) || id <= 0) {
            throw new Error(`Invalid Cesium Ion asset ID: ${assetId}`)
        }

        return IonResource.fromAssetId(id, accessToken ? {accessToken} : undefined)
    }

    static async imageryProviderFromLayer(layer, {accessToken = getActiveToken()} = {}) {
        const id = Number(layer?.ionAssetId ?? layer?.assetId)
        if (!Number.isInteger(id) || id <= 0) {
            return null
        }

        const imageryKind = `${layer?.imageryKind ?? layer?.tilesKind ?? layer?.providerKind ?? ''}`.toLowerCase()
        if (imageryKind === 'google2d') {
            return Google2DImageryProvider.fromIonAssetId({
                assetId:     id,
                accessToken: accessToken || undefined,
                mapType: layer?.mapType ?? 'satellite',
                overlayLayerType: layer?.overlayLayerType,
            })
        }

        return IonImageryProvider.fromAssetId(id, accessToken ? {accessToken} : undefined)
    }

    static async createTileset(layer, {accessToken = getActiveToken()} = {}) {
        const kind = `${layer?.sceneKind ?? layer?.base3d?.kind ?? layer?.tiles3d?.kind ?? ''}`.toLowerCase()
        const assetId = Number(layer?.ionAssetId ?? layer?.assetId)

        if (kind === 'google-photorealistic'
            || kind === 'google-photorealistic-3d'
            || kind === 'google-photorealistic-tiles'
            || `${layer?.id ?? ''}`.includes('photorealistic')) {
            return createGooglePhotorealistic3DTileset({}, {
                show: layer?.show ?? true,
            })
        }

        if (!Number.isInteger(assetId) || assetId <= 0) {
            throw new Error(`Invalid Cesium Ion asset ID: ${layer?.ionAssetId ?? layer?.assetId}`)
        }

        const resource = await IonLayerUtils.ionResourceFromAssetId(assetId, accessToken)
        return Cesium3DTileset.fromUrl(resource, {
            maximumScreenSpaceError: layer?.tiles3d?.maximumScreenSpaceError ?? layer?.maximumScreenSpaceError ?? 16,
            show: layer?.show ?? true,
        })
    }

    static isPersonalLayer = (layer) => `${layer?.usage?.type ?? ''}`.toLowerCase() === PERSONAL_ACCESS

    static isBase3DLayer = (layer) => `${layer?.type ?? ''}`.toLowerCase() === BASE3D_ENTITY

    static setLayerToken = async (layer, token) => {
        if (!layer) {
            return
        }
        if (!globalThis.lgs?.db?.vault?.put) {
            return
        }
        await globalThis.lgs.db.vault.put(layer.id, normalizeToken(token), VAULT_STORE)
    }

    static getActiveToken = getActiveToken
}
