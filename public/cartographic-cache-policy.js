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
 * Last modified: 2026-11-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/** Default persistent cartographic payload budget, in bytes. */
export const DEFAULT_TILE_CACHE_BYTES = 512 * 1024 * 1024

const TILE_CACHE_SECRET_QUERY_KEYS = new Set([
                                                   'access_token',
                                                   'api_key',
                                                   'apikey',
                                                   'key',
                                                   'subscription-key',
                                                   'token',
                                               ])
const GOOGLE_TILE_HOST_PATTERN = /(?:^|\.)(?:googleapis\.(?:com|cn)|google\.(?:com|cn)|googleusercontent\.com|gstatic\.(?:com|cn))$/i
const IMAGE_TILE_PATTERN = /\.(?:png|jpe?g|webp|avif)$/i
const TERRAIN_TILE_PATTERN = /(?:\.terrain|\/layer\.json|\/\d+\/\d+\/\d+\.(?:bin|png|jpe?g|webp|tif))$/i
const THREE_D_TILE_PATTERN = /\.(?:json|subtree|glb|gltf|bin|b3dm|i3dm|pnts|cmpt|vctr|geom|ktx2|png|jpe?g|webp)$/i
const VECTOR_TILE_PATTERN = /\.(?:pbf|mvt)$/i

/** Identify Google Maps endpoints before any response-cache key is considered. */
export const isGoogleTileRequest = request => {
    try {
        return GOOGLE_TILE_HOST_PATTERN.test(new URL(request.url).hostname)
    }
    catch {
        return false
    }
}

/** Resolve a safe source classification from explicitly registered provider rules. */
export const classifyTileRequest = (request, rules = [], siteOrigin = globalThis.location?.origin) => {
    if (request.method !== 'GET') return null
    if (isGoogleTileRequest(request)) return {kind: 'bypass', ion: false, provider: 'google'}

    let url
    try {
        url = new URL(request.url)
    }
    catch {
        return null
    }
    const networkOnly = request.headers.has('range')
        || request.cache === 'no-store'
        || request.credentials === 'include'
        || request.credentials === 'same-origin' && url.origin === siteOrigin

    // WMS requests can use Studio's existing allowlisted proxy.
    if (url.pathname.endsWith('/proxy.php') && url.searchParams.has('csurl')) {
        const proxyUrl = url
        try {
            url = new URL(proxyUrl.searchParams.get('csurl'))
            proxyUrl.searchParams.forEach((value, name) => {
                if (name !== 'csurl') url.searchParams.append(name, value)
            })
        }
        catch {
            return null
        }
    }
    if (!['http:', 'https:'].includes(url.protocol)) return null

    const matchesPath = rule => rule.origin === url.origin
        && (url.pathname === rule.path || url.pathname.startsWith(rule.path.endsWith('/') ? rule.path : `${rule.path}/`))
    if (rules.some(rule => rule.kind === 'exclude' && matchesPath(rule))) {
        return {kind: 'bypass', ion: false, provider: 'configured-provider'}
    }

    const image = IMAGE_TILE_PATTERN.test(url.pathname)
    const terrain = TERRAIN_TILE_PATTERN.test(url.pathname)
    const content3d = THREE_D_TILE_PATTERN.test(url.pathname)
    const vector = VECTOR_TILE_PATTERN.test(url.pathname)
    if (url.hostname === 'assets.ion.cesium.com') {
        if (!(terrain || content3d)) return null
        return networkOnly
            ? {kind: 'bypass', ion: true, provider: 'cesium-ion'}
            : {kind: terrain ? 'terrain' : image ? 'imagery' : 'tiles3d', ion: true, provider: 'cesium-ion'}
    }

    const query = new Map([...url.searchParams].map(([key, value]) => [key.toLowerCase(), value]))
    for (const rule of rules) {
        if (rule.kind === 'exclude' || !matchesPath(rule)) continue
        if (rule.kind === 'terrain' && (terrain
            || rule.mode === 'mapterhorn' && /\/\d+\/\d+\/\d+\.webp$/i.test(url.pathname))) {
            return networkOnly
                ? {kind: 'bypass', ion: false, provider: rule.provider ?? 'configured-provider'}
                : {kind: 'terrain', ion: false, provider: rule.provider ?? 'configured-provider'}
        }
        if (rule.kind === 'tiles3d' && content3d) {
            return networkOnly
                ? {kind: 'bypass', ion: false, provider: rule.provider ?? 'configured-provider'}
                : {kind: 'tiles3d', ion: false, provider: rule.provider ?? 'configured-provider'}
        }
        if (rule.kind === 'vector' && vector) {
            return networkOnly
                ? {kind: 'bypass', ion: false, provider: rule.provider ?? 'configured-provider'}
                : {kind: 'vector', ion: false, provider: rule.provider ?? 'configured-provider'}
        }
        if (rule.kind !== 'imagery') continue
        if (['wmts', 'wmts-legacy'].includes(rule.mode) && query.get('request')?.toLowerCase() === 'gettile') {
            if (rule.layer && query.get('layer') !== rule.layer) continue
            if (rule.matrixSet && query.get('tilematrixset') !== rule.matrixSet) continue
            return networkOnly
                ? {kind: 'bypass', ion: false, provider: rule.provider ?? 'configured-provider'}
                : {kind: 'imagery', ion: false, provider: rule.provider ?? 'configured-provider'}
        }
        if (rule.mode === 'wmts-legacy' && query.has('tilematrix') && query.has('tilerow') && query.has('tilecol')) {
            return networkOnly
                ? {kind: 'bypass', ion: false, provider: rule.provider ?? 'configured-provider'}
                : {kind: 'imagery', ion: false, provider: rule.provider ?? 'configured-provider'}
        }
        if (rule.mode === 'wms') {
            if (query.get('request')?.toLowerCase() === 'getmap' && query.get('layers') === rule.layer) {
                return networkOnly
                    ? {kind: 'bypass', ion: false, provider: rule.provider ?? 'configured-provider'}
                    : {kind: 'imagery', ion: false, provider: rule.provider ?? 'configured-provider'}
            }
            continue
        }
        if (image || (rule.mode === 'wayback' && /\/\d+\/\d+\/\d+\/?$/.test(url.pathname))) {
            return networkOnly
                ? {kind: 'bypass', ion: false, provider: rule.provider ?? 'configured-provider'}
                : {kind: 'imagery', ion: false, provider: rule.provider ?? 'configured-provider'}
        }
    }
    return null
}

/** Derive a non-secret account partition from credentials explicitly present on the request. */
export const tileCacheCredentialMaterial = request => {
    const authorization = request.headers.get('authorization')
    if (authorization) return authorization

    try {
        const url = new URL(request.url)
        if (url.username || url.password) return `${url.username}:${url.password}`
        const secrets = [...url.searchParams]
            .filter(([name]) => TILE_CACHE_SECRET_QUERY_KEYS.has(name.toLowerCase()))
            .map(([name, value]) => `${name.toLowerCase()}=${value}`)
            .sort()
        return secrets.length ? secrets.join('&') : null
    }
    catch {
        return null
    }
}

/** Resolve an explicitly permitted HTTP freshness deadline without inventing a TTL. */
export const tileFreshnessDeadline = (response, now) => {
    if (response.status !== 200 || response.type === 'opaque' || /(?:^|,)\s*\*/.test(response.headers.get('vary') ?? '')
        || /text\/html/i.test(response.headers.get('content-type') ?? '')) return 0
    const control = response.headers.get('cache-control') ?? ''
    if (/(?:^|,)\s*(?:no-store|no-cache)\b/i.test(control)) return 0
    const match = /(?:^|,)\s*max-age\s*=\s*"?(\d+)"?/i.exec(control)
    const date = Date.parse(response.headers.get('date') ?? '')
    const ageValue = Number(response.headers.get('age'))
    const age = Math.max(Number.isFinite(ageValue) ? ageValue : 0, Number.isFinite(date) ? (now - date) / 1000 : 0)
    if (match) return now + Math.max(0, Number(match[1]) - age) * 1000
    const expires = Date.parse(response.headers.get('expires') ?? '')
    return Number.isFinite(expires) ? now + Math.max(0, expires - (Number.isFinite(date) ? date + age * 1000 : now)) : 0
}

/** Parse safe Vary names and reject browser-managed account state that cannot be isolated. */
export const tileVaryHeaders = (request, response) => {
    const vary = response.headers.get('vary')
    if (!vary) return []
    const names = vary.split(',').map(name => name.trim().toLowerCase()).filter(Boolean)
    if (names.includes('*') || names.includes('cookie') || names.includes('cookie2')) return null
    if (names.some(name => !/^[!#$%&'*+.^_`|~0-9a-z-]+$/.test(name))) return null
    if (names.some(name => !request.headers.has(name))) return null
    return names
}
