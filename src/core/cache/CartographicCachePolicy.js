/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CartographicCachePolicy.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-08
 * Last modified: 2026-11-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/** Default persistent cartographic payload budget, in bytes. */
export const DEFAULT_TILE_CACHE_BYTES = 512 * 1024 * 1024

/** User-selectable persistent cartographic budgets, in bytes. */
export const TILE_CACHE_BUDGETS = [256, 512, 1024, 2048].map(value => value * 1024 * 1024)

/** Return a supported budget, falling back safely for missing or corrupt settings. */
export const normalizeTileCacheBudget = value => (
    TILE_CACHE_BUDGETS.includes(Number(value)) ? Number(value) : DEFAULT_TILE_CACHE_BYTES
)

/** Identify Google content even when Cesium exposes it through an Ion asset URL. */
const isGoogleLayer = (provider, layer) => {
    const identity = [provider.id, provider.name, layer.id, layer.sceneKind, layer.imageryKind, layer.base3d?.kind, layer.tiles3d?.kind]
        .map(value => `${value ?? ''}`.toLowerCase())
        .join(' ')
    return /google|photorealistic/.test(identity) || /google\.com\/(?:maps|earth)/i.test(layer.url ?? '')
}

/** Replace template variables before resolving a provider URL without retaining credentials. */
const normalizedSourceUrl = (address, origin) => {
    const templateAddress = address.replace(/\{[^}]*\}/g, 'TEMPLATE')
    return new URL(templateAddress, origin)
}

/** Build a path-bounded worker rule for one declared provider resource root. */
const sourceRule = (url, kind, mode, provider, layer) => {
    let path = url.pathname
    if (kind === 'tiles3d') path = path.slice(0, path.lastIndexOf('/') + 1)
    else if (path.includes('TEMPLATE')) path = path.slice(0, path.indexOf('TEMPLATE'))
    return {
        origin: url.origin,
        path,
        kind,
        mode,
        provider,
        layer: layer.layer ?? '',
        matrixSet: layer.tileMatrixSetID ?? '',
    }
}

/** Build credential-free routing rules from the configured cartographic catalog. */
export const buildTileCacheRules = (providers = [], origin = 'https://studio.invalid') => {
    const rules = []
    for (const provider of providers) {
        for (const layer of provider.layers ?? []) {
            const providerId = provider.id ?? provider.name ?? 'configured-provider'
            if (isGoogleLayer(provider, layer)) {
                const assetId = Number(layer.ionAssetId ?? layer.assetId)
                if (Number.isSafeInteger(assetId) && assetId > 0) {
                    rules.push({origin: 'https://assets.ion.cesium.com', path: `/${assetId}`, kind: 'exclude', provider: 'google'})
                }
                continue
            }

            const kind = layer.type === 'terrain' ? 'terrain'
                : ['tiles3d', 'base3d'].includes(layer.type) ? 'tiles3d'
                    : layer.type === 'vector' || layer.tile === 'vector' ? 'vector' : 'imagery'
            if (kind === 'imagery' && !layer.tile) continue
            if (kind === 'terrain' && !['url', 'mapterhorn'].includes(layer.terrainType)) continue
            const address = kind === 'tiles3d' ? layer.tiles3d?.url ?? layer.url : layer.url
            const assetId = Number(layer.ionAssetId ?? layer.assetId)
            if (layer.cache === false && Number.isSafeInteger(assetId) && assetId > 0) {
                rules.push({origin: 'https://assets.ion.cesium.com', path: `/${assetId}`, kind: 'exclude', provider: providerId})
            }
            if (!address || layer.tile === 'ion' || layer.cache === false && kind === 'terrain' && layer.terrainType === 'cesium') continue

            try {
                const url = normalizedSourceUrl(address, origin)
                if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) continue
                const mode = kind === 'imagery' ? layer.tile
                    : layer.terrainType === 'mapterhorn' ? 'mapterhorn' : kind
                const rule = sourceRule(url, kind, mode, providerId, layer)
                rules.push(layer.cache === false ? {...rule, kind: 'exclude'} : rule)

                if (layer.cache === false) continue

                // Absolute nested 3D Tile resources can use explicitly declared provider hosts.
                const nestedHosts = [provider.cacheHosts, layer.cacheHosts, layer.tiles3d?.cacheHosts]
                    .flatMap(hosts => Array.isArray(hosts) ? hosts : [])
                for (const host of nestedHosts) {
                    const nestedUrl = normalizedSourceUrl(host, origin)
                    if (!['http:', 'https:'].includes(nestedUrl.protocol) || nestedUrl.username || nestedUrl.password) continue
                    rules.push(sourceRule(nestedUrl, kind, mode, providerId, layer))
                }
            }
            catch {
                // Ignore malformed or unavailable provider URLs.
            }
        }
    }
    return rules
}
