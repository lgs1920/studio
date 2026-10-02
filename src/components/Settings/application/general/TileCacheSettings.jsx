/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TileCacheSettings.jsx
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

import { $cartographicCache, cartographicCacheController } from '@Core/cache/CartographicCacheController'
import { TILE_CACHE_BUDGETS, normalizeTileCacheBudget } from '../../../../../public/cartographic-cache-policy.js'
import { WaButton, WaDivider, WaIcon, WaOption, WaSelect } from '@web.awesome.me/webawesome-pro/dist/react'
import { useEffect, useState } from 'react'
import { useSnapshot } from 'valtio'

/** Format a cartographic payload budget using binary storage units. */
const formatTileCacheSize = bytes => bytes >= 1024 ** 3
    ? `${Number((bytes / 1024 ** 3).toFixed(1))} GiB`
    : `${Math.round(bytes / 1024 ** 2)} MiB`

/** Render the persisted cartographic budget and isolated purge controls. */
export const TileCacheSettings = () => {
    const app = useSnapshot(lgs.settings.app)
    const cache = useSnapshot($cartographicCache)
    const [clearing, setClearing] = useState(false)
    const maxBytes = normalizeTileCacheBudget(app.tileCacheMaxBytes)

    useEffect(() => {
        void cartographicCacheController.refresh()
        const interval = setInterval(() => { void cartographicCacheController.refresh() }, 5000)
        return () => clearInterval(interval)
    }, [])

    /** Persist a validated selection through the existing application settings owner. */
    const changeBudget = event => {
        lgs.settings.app.tileCacheMaxBytes = normalizeTileCacheBudget(event.target.value)
    }

    /** Await the purge before showing its updated usage. */
    const clearCache = async () => {
        setClearing(true)
        try { await cartographicCacheController.clear() }
        finally { setClearing(false) }
    }

    return (
        <>
            <span slot="summary"><WaIcon name="map" variant="regular"/> {'Cartographic cache'}</span>
            <WaDivider/>
            <div className="tile-cache-settings wa-stack">
                <WaSelect label="Maximum cartographic cache size" hint="Shared by map tiles, terrain, and 3D tiles."
                          size="s" appearance="filled" value={String(maxBytes)} onChange={changeBudget}>
                    {TILE_CACHE_BUDGETS.map(bytes => (
                        <WaOption key={bytes} value={String(bytes)}>
                            {formatTileCacheSize(bytes)}{bytes === 512 * 1024 ** 2 ? ' (default)' : ''}
                        </WaOption>
                    ))}
                </WaSelect>
                <p role="status" aria-live="polite">
                    {cache.available
                     ? `${formatTileCacheSize(cache.usage)} used of ${formatTileCacheSize(maxBytes)}`
                     : 'Cartographic cache unavailable. Tiles continue to load from the network.'}
                </p>
                {cache.available && cache.effectiveMaxBytes < maxBytes && (
                    <p>{`Available storage currently limits the cache to ${formatTileCacheSize(cache.effectiveMaxBytes)}.`}</p>
                )}
                <WaButton size="s" appearance="outlined" variant="neutral" loading={clearing}
                          disabled={clearing || !cache.available} onClick={clearCache}>
                    <WaIcon slot="start" name="trash" variant="regular"/>{'Clear cartographic cache'}
                </WaButton>
            </div>
        </>
    )
}
