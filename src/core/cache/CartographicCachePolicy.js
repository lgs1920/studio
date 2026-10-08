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
 * Last modified: 2026-10-08
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

/** Build credential-free routing rules from the configured cartographic catalog. */
export const buildTileCacheRules = (providers = [], origin = 'https://studio.invalid') => {
    const rules = []
    for (const provider of providers) {
        for (const layer of provider.layers ?? []) {
            if (layer.cache === false || layer.tile === 'ion' || `${layer.sceneKind ?? ''}`.startsWith('google')) continue
            const kind = layer.type === 'terrain' ? 'terrain'
                : ['tiles3d', 'base3d'].includes(layer.type) ? 'tiles3d' : 'imagery'
            if (kind === 'imagery' && !layer.tile) continue
            if (kind === 'terrain' && layer.terrainType !== 'url') continue
            const address = kind === 'tiles3d' ? layer.tiles3d?.url ?? layer.url : layer.url
            if (!address) continue
            try {
                const url = new URL(address.replace(/\{[^}]*\}/g, 'TEMPLATE'), origin)
                if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) continue
                let path = url.pathname
                if (kind === 'tiles3d') path = path.slice(0, path.lastIndexOf('/') + 1)
                else if (path.includes('TEMPLATE')) path = path.slice(0, path.indexOf('TEMPLATE'))
                const mode = kind === 'imagery' ? layer.tile : kind
                rules.push({origin: url.origin, path, kind, mode, layer: layer.layer ?? '', matrixSet: layer.tileMatrixSetID ?? ''})
            }
            catch { /* Ignore malformed or unavailable provider URLs. */ }
        }
    }
    return rules
}
