/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapterhornTerrainProvider.js
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

import {MapterhornTerrainProvider as UpstreamMapterhornTerrainProvider} from '@bertt/cesium-mapterhorn-provider'

/** Attribution shared by the terrain provider and the layer catalogue. */
export const MAPTERHORN_TERRAIN_CREDIT = 'Terrain data © <a href="https://mapterhorn.com/attribution/">Mapterhorn and its source data providers</a>'

/**
 * Adapt the upstream provider to Mapterhorn's partial high-resolution coverage.
 * Missing detailed tiles leave Cesium free to upsample their available parents.
 */
export class MapterhornTerrainProvider extends UpstreamMapterhornTerrainProvider {
    #unavailableTiles = new Set()

    /** Global tiles stop at level 12, which is safe for altitude sampling without availability metadata. */
    samplingLevel = 12

    /**
     * Create a provider with linked source attribution and the upstream grid defaults.
     *
     * @param {object} options - Upstream terrain URL, zoom, and heightmap options.
     */
    constructor(options = {}) {
        super({credit: MAPTERHORN_TERRAIN_CREDIT, ...options})
    }

    /**
     * Reject descendants of detailed tiles that the server has confirmed are absent.
     *
     * @param {number} x - Tile column.
     * @param {number} y - Tile row.
     * @param {number} level - Tile zoom level.
     * @returns {boolean} Whether this tile may be requested.
     */
    getTileDataAvailable = (x, y, level) => {
        if (!super.getTileDataAvailable(x, y, level)) {
            return false
        }
        for (let ancestorLevel = level; ancestorLevel > this.samplingLevel; ancestorLevel--) {
            const scale = 2 ** (level - ancestorLevel)
            if (this.#unavailableTiles.has(`${ancestorLevel}/${Math.floor(x / scale)}/${Math.floor(y / scale)}`)) {
                return false
            }
        }
        return true
    }

    /**
     * Preserve synchronous request deferral and remember missing detailed terrain.
     *
     * @param {number} x - Tile column.
     * @param {number} y - Tile row.
     * @param {number} level - Tile zoom level.
     * @param {object} request - Cesium request scheduler context.
     * @returns {Promise<object>|undefined} Terrain geometry or synchronous deferral.
     */
    requestTileGeometry = (x, y, level, request) => {
        const pending = super.requestTileGeometry(x, y, level, request)
        return pending?.catch(error => {
            // The global archive covers levels 0–12. A 404 above it denotes a
            // coverage hole, while network failures remain eligible for retry.
            if (level > this.samplingLevel && error?.statusCode === 404) {
                this.#unavailableTiles.add(`${level}/${x}/${y}`)
            }
            throw error
        })
    }
}
