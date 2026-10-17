/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TerrainUtils.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2024-12-01
 * Last modified: 2026-10-17
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    NO_FOCUS, REFRESH_DRAWING, TERRAIN_FROM_CESIUM, TERRAIN_FROM_CESIUM_ELLIPSOID, TERRAIN_FROM_MAPTERHORN, TERRAIN_FROM_URL,
    URL_AUTHENT_KEY,
} from '@Core/constants'
import { IonLayerUtils } from './IonLayerUtils'
import { MapterhornTerrainProvider } from './MapterhornTerrainProvider'
import { CesiumTerrainProvider, EllipsoidTerrainProvider, Terrain, sampleTerrain, sampleTerrainMostDetailed } from 'cesium'

/**
 * Redraw loaded, ground-clamped tracks after their terrain provider changes.
 *
 * @returns {Promise<void>} Completion of the loaded track redraw requests.
 */
const refreshTracksOnTerrainChange = async () => {
    const journeys = new Set(globalThis.lgs?.journeys?.values?.() ?? [])
    const editorJourney = globalThis.lgs?.theJourneyEditorProxy?.journey
    if (editorJourney) {
        journeys.add(editorJourney)
    }

    const tracks = [...journeys].flatMap(journey => [...(journey?.tracks?.values?.() ?? [])])
    await Promise.allSettled(tracks.map(track => track.draw?.({action: REFRESH_DRAWING, mode: NO_FOCUS})))
}

export class TerrainUtils {

    /**
     * Create the terrain provider declared by the selected layer.
     *
     * @param entity {string|object} Entity Id or Entity Object
     * @return {Promise<object|null>} Terrain provider or null for an unknown entity.
     */
    static setTerrain = async entity => {
        // we assume that if it not a string,it is the entity object
        const theEntity = (typeof entity === 'string') ? __.layersAndTerrainManager.getEntityProxy(entity) : entity

        // Set the right terrain
        if (!theEntity) {
            return null
        }

        if (theEntity.terrainType === TERRAIN_FROM_MAPTERHORN) {
            return new MapterhornTerrainProvider({
                url: theEntity.url,
                maxLevel: theEntity.maximumLevel ?? 17,
                heightmapResolution: theEntity.heightmapResolution ?? 65,
            })
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

    /**
     * Apply a selected terrain through Cesium's existing scene and error boundary.
     *
     * @param {string|object} entity - Terrain entity or catalogue id.
     * @returns {Promise<void>} Scene terrain update completion.
     */
    static changeTerrain = async entity => {
        const theEntity = (typeof entity === 'string') ? __.layersAndTerrainManager.getEntityProxy(entity) : entity

        try {
            const terrain = new Terrain(await TerrainUtils.setTerrain(theEntity))
            if (terrain) {
                await lgs.scene.setTerrain(terrain)
                __.ui.poiManager?.refreshTerrainClamping?.()
                await refreshTracksOnTerrainChange()
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

    /**
     * Sample altitude without requiring unavailable tile-availability metadata.
     *
     * @param {object[]} positions - Cartographic positions updated by Cesium.
     * @param {object} options - Provider and precision options.
     * @returns {Promise<object[]>} Positions with sampled terrain heights.
     */
    static sampleTerrainHeights = (positions, {
        provider = globalThis.lgs?.viewer?.terrainProvider,
        mostDetailed = true,
        level = 11,
    } = {}) => mostDetailed && provider?.availability
        ? sampleTerrainMostDetailed(provider, positions)
        : sampleTerrain(provider, mostDetailed ? provider?.samplingLevel ?? level : level, positions)
}
