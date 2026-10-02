/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: cartographic-cache-policy.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-02
 * Last modified: 2026-10-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/** Default persistent cartographic payload budget, in bytes. */
export const DEFAULT_TILE_CACHE_BYTES = 512 * 1024 * 1024

/** User-selectable persistent cartographic budgets, in bytes. */
export const TILE_CACHE_BUDGETS = [256, 512, 1024, 2048].map(value => value * 1024 * 1024)

/** Return a supported budget, falling back safely for missing or corrupt settings. */
export const normalizeTileCacheBudget = value =>
    TILE_CACHE_BUDGETS.includes(Number(value)) ? Number(value) : DEFAULT_TILE_CACHE_BYTES

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

/** Classify only tile, terrain, or 3D content requests from explicit source rules. */
export const classifyTileRequest = (request, rules = []) => {
    if (request.method !== 'GET' || request.headers.has('range') || request.cache === 'no-store') return null
    if (request.credentials === 'include' && !request.headers.has('authorization')) return null
    let url = new URL(request.url)
    // WMS requests can use Studio's existing allowlisted proxy.
    if (url.pathname.endsWith('/proxy.php') && url.searchParams.has('csurl')) {
        const proxyUrl = url
        try {
            url = new URL(proxyUrl.searchParams.get('csurl'))
            proxyUrl.searchParams.forEach((value, name) => { if (name !== 'csurl') url.searchParams.append(name, value) })
        }
        catch { return null }
    }
    if (!['http:', 'https:'].includes(url.protocol)) return null
    // Google content retains its provider-managed HTTP caching contract.
    if (/(^|\.)googleapis\.com$/.test(url.hostname)) return null
    const image = /\.(?:png|jpe?g|webp)$/i.test(url.pathname)
    const terrain = /(?:\.terrain|\/layer\.json)$/i.test(url.pathname)
    const content3d = /\.(?:json|glb|gltf|bin|b3dm|i3dm|pnts|cmpt|ktx2|png|jpe?g|webp)$/i.test(url.pathname)
    if (url.hostname === 'assets.ion.cesium.com') {
        if (!(terrain || content3d)) return null
        return {kind: terrain ? 'terrain' : image ? 'imagery' : 'tiles3d', ion: true}
    }
    const query = new Map([...url.searchParams].map(([key, value]) => [key.toLowerCase(), value]))
    for (const rule of rules) {
        if (url.origin !== rule.origin || !(url.pathname === rule.path || url.pathname.startsWith(rule.path.endsWith('/') ? rule.path : `${rule.path}/`))) continue
        if (rule.kind === 'terrain' && terrain) return {kind: 'terrain', ion: false}
        if (rule.kind === 'tiles3d' && content3d) return {kind: 'tiles3d', ion: false}
        if (rule.kind !== 'imagery') continue
        if (['wmts', 'wmts-legacy'].includes(rule.mode) && query.get('request')?.toLowerCase() === 'gettile') {
            if (rule.layer && query.get('layer') !== rule.layer) continue
            if (rule.matrixSet && query.get('tilematrixset') !== rule.matrixSet) continue
            return {kind: 'imagery', ion: false}
        }
        if (rule.mode === 'wms') {
            if (query.get('request')?.toLowerCase() === 'getmap' && query.get('layers') === rule.layer) {
                return {kind: 'imagery', ion: false}
            }
            continue
        }
        if (image || (rule.mode === 'wayback' && /\/\d+\/\d+\/\d+\/?$/.test(url.pathname))) {
            return {kind: 'imagery', ion: false}
        }
    }
    return null
}

/** Resolve an explicitly permitted HTTP freshness deadline without inventing a TTL. */
export const tileFreshnessDeadline = (response, now) => {
    if (response.status !== 200 || response.type === 'opaque' || /(?:^|,)\s*\*/.test(response.headers.get('vary') ?? '')
        || /text\/html/i.test(response.headers.get('content-type') ?? '')) return 0
    const control = response.headers.get('cache-control') ?? ''
    if (/(?:^|,)\s*(?:no-store|no-cache)\b/i.test(control)) return 0
    const match = /(?:^|,)\s*max-age\s*=\s*"?(\d+)"?/i.exec(control)
    const date = Date.parse(response.headers.get('date') ?? '')
    const age = Math.max(Number(response.headers.get('age')) || 0, Number.isFinite(date) ? (now - date) / 1000 : 0)
    if (match) return now + Math.max(0, Number(match[1]) - age) * 1000
    const expires = Date.parse(response.headers.get('expires') ?? '')
    return Number.isFinite(expires) ? now + Math.max(0, expires - (Number.isFinite(date) ? date + age * 1000 : now)) : 0
}
