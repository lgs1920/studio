/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Tiles3DLayer.jsx
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

import { TILES3D_ENTITY } from '@Core/constants'
import { IonLayerUtils } from '@Utils/cesium/IonLayerUtils'
import { UIToast } from '@Utils/UIToast'
import { useEffect } from 'react'
import { useSnapshot } from 'valtio'

export const Tiles3DLayer = () => {
    const layers = useSnapshot(lgs.settings.layers)
    const ion = useSnapshot(lgs.stores.ion)
    const manager = __.layersAndTerrainManager
    const layerId = layers.tiles3d
    const layer = layerId ? manager.getEntityProxy(layerId) : null

    useEffect(() => {
        if (!lgs.viewer || lgs.viewer.isDestroyed() || !layer || layer.type !== TILES3D_ENTITY || (IonLayerUtils.isPersonalLayer(layer) && ion.source !== 'user')) {
            if (lgs.theTiles3DLayer && lgs.viewer?.scene?.primitives?.contains?.(lgs.theTiles3DLayer)) {
                lgs.viewer.scene.primitives.remove(lgs.theTiles3DLayer, true)
            }
            lgs.theTiles3DLayer = null
            return undefined
        }

        let cancelled = false
        let tileset = null

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
                UIToast.error({
                                  caption: 'Cesium 3D Tiles overlay',
                                  text:    error?.message ?? String(error),
                              })
            }
        }

        void load()

        return () => {
            cancelled = true
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
