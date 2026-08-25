/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TerrainUtils.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-03-06
 * Last modified: 2026-03-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { TERRAIN_FROM_CESIUM, TERRAIN_FROM_CESIUM_ELLIPSOID, TERRAIN_FROM_URL, URL_AUTHENT_KEY } from '@Core/constants'
import { IonLayerUtils } from './IonLayerUtils'
import { CesiumTerrainProvider, EllipsoidTerrainProvider, Terrain } from 'cesium'

export class TerrainUtils {

    /**
     * Sett  terrain from settings
     *
     * @param entity {string|object} Entity Id or Entity Object
     * @return {Promise<CesiumTerrainProvider>|null}
     */
    static async setTerrain(entity) {
        // we assume that if it not a string,it is the entity object
        const theEntity = (typeof entity === 'string') ? __.layersAndTerrainManager.getEntityProxy(entity) : entity

        // Set the right terrain
        if (!theEntity) {
            return null
        }

        // We know the URL
        if (theEntity?.url && theEntity.terrainType === TERRAIN_FROM_URL) {
            let theURL = theEntity.url
            if (theURL.includes(URL_AUTHENT_KEY)) {
                if (theEntity.usage?.unlocked && theEntity.usage?.name) {
                    theURL = theURL.replace(URL_AUTHENT_KEY, `${theEntity.usage.name}=${theEntity.usage.token}`)
                }
                else {
                    theURL = theURL.replace(URL_AUTHENT_KEY, '')
                }
            }

            return CesiumTerrainProvider.fromUrl(theURL, {requestVertexNormals: false})
        }

        if (theEntity.terrainType === TERRAIN_FROM_CESIUM) {
            const resource = await IonLayerUtils.ionResourceFromAssetId(theEntity.assetId ?? 1)
            return CesiumTerrainProvider.fromUrl(resource, {
                requestVertexNormals: false,
            })
        }

        if (theEntity.terrainType === TERRAIN_FROM_CESIUM_ELLIPSOID) {
            return new EllipsoidTerrainProvider({
                                                    requestVertexNormals: false,
                                                })
        }

        return null
    }

    static async changeTerrain(entity) {
        const theEntity = (typeof entity === 'string') ? __.layersAndTerrainManager.getEntityProxy(entity) : entity

        try {
            const terrain = new Terrain(await TerrainUtils.setTerrain(theEntity))
            if (terrain) {
                await lgs.scene.setTerrain(terrain)
            }
        }
        catch (error) {
            const errorMessage = `${error?.message ?? ''} ${error?.cause?.message ?? ''}`.toLowerCase()
            const shouldFallback = lgs.stores?.ion?.source === 'user'
                && /401|403|unauthorized|forbidden/.test(errorMessage)

            if (shouldFallback) {
                await __.ui.ionTokenManager.clear()
                return
            }

            const name = theEntity?.name ?? theEntity?.id ?? entity ?? 'terrain'
            const cause = error?.message ? ` ${error.message}` : ''
            throw new Error(`Cesium terrain "${name}" failed to load.${cause}`)
        }
    }
}
