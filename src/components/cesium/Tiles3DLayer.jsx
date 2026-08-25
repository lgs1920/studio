/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Tiles3DLayer.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-25
 * Last modified on: 2026-06-25
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { TILES3D_ENTITY } from '@Core/constants'
import { IonLayerUtils } from '@Utils/cesium/IonLayerUtils'
import { addTiles3DErrorLabel, removeTiles3DErrorLabels } from '@Utils/cesium/Tiles3DErrorLabels'
import { useEffect } from 'react'
import { useSnapshot } from 'valtio'

export const Tiles3DLayer = () => {
    const layers = useSnapshot(lgs.settings.layers)
    const ion = useSnapshot(lgs.stores.ion)
    const manager = __.layersAndTerrainManager
    const layerId = layers.tiles3d
    const layer = layerId ? manager.getEntityProxy(layerId) : null

    useEffect(() => {
        if (!lgs.viewer || lgs.viewer.isDestroyed() || !layer || layer.type !== TILES3D_ENTITY || (IonLayerUtils.isIonDependentLayer(layer) && ion.source !== 'user')) {
            if (lgs.stores.main.theTiles3DLayer?.id) {
                removeTiles3DErrorLabels(lgs.viewer, lgs.stores.main.theTiles3DLayer.id)
            }
            if (lgs.theTiles3DLayer && lgs.viewer?.scene?.primitives?.contains?.(lgs.theTiles3DLayer)) {
                lgs.viewer.scene.primitives.remove(lgs.theTiles3DLayer, true)
            }
            lgs.theTiles3DLayer = null
            lgs.stores.main.theTiles3DLayer = null
            return undefined
        }

        let cancelled = false
        let tileset = null
        let removeTileFailedListener = null

        const load = async () => {
            try {
                tileset = await IonLayerUtils.createTileset({
                    ...layer,
                    show: layer?.show !== false,
                })

                if (cancelled) {
                    tileset.destroy?.()
                    return
                }

                const handleTileFailed = error => {
                    window.setTimeout(() => {
                        if (!cancelled) {
                            addTiles3DErrorLabel({viewer: lgs.viewer, layer, error})
                        }
                    }, 0)
                }

                if (tileset.tileFailed?.addEventListener) {
                    tileset.tileFailed.addEventListener(handleTileFailed)
                    removeTileFailedListener = () => tileset.tileFailed.removeEventListener(handleTileFailed)
                }

                lgs.theTiles3DLayer = tileset
                lgs.stores.main.theTiles3DLayer = layer
                if (!lgs.viewer.scene.primitives.contains(tileset)) {
                    lgs.viewer.scene.primitives.add(tileset)
                }

                if (layer?.tiles3d?.flyToOnLoad ?? false) {
                    await lgs.viewer.flyTo(tileset)
                }

                lgs.viewer.scene.requestRender()
            }
            catch (error) {
                addTiles3DErrorLabel({viewer: lgs.viewer, layer, error})
                console.warn('Cesium 3D Tiles overlay failed to load', error)
            }
        }

        void load()

        return () => {
            cancelled = true
            removeTileFailedListener?.()
            removeTiles3DErrorLabels(lgs.viewer, layer?.id)
            if (tileset && lgs.viewer?.scene?.primitives?.contains?.(tileset)) {
                lgs.viewer.scene.primitives.remove(tileset, true)
            }
            if (lgs.theTiles3DLayer === tileset) {
                lgs.theTiles3DLayer = null
            }
            if (lgs.stores.main.theTiles3DLayer?.id === layer?.id) {
                lgs.stores.main.theTiles3DLayer = null
            }
        }
    }, [ion.source, layer])

    return null
}
