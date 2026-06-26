/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Base3DLayer.jsx
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

import { BASE3D_ENTITY } from '@Core/constants'
import { IonLayerUtils } from '@Utils/cesium/IonLayerUtils'
import { UIToast } from '@Utils/UIToast'
import { useEffect } from 'react'
import { useSnapshot } from 'valtio'

export const Base3DLayer = () => {
    const layers = useSnapshot(lgs.settings.layers)
    const ion = useSnapshot(lgs.stores.ion)
    const manager = __.layersAndTerrainManager
    const layerId = layers.base3d
    const layer = layerId ? manager.getEntityProxy(layerId) : null

    useEffect(() => {
        if (!lgs.viewer || lgs.viewer.isDestroyed() || !layer || layer.type !== BASE3D_ENTITY || (IonLayerUtils.isPersonalLayer(layer) && ion.source !== 'user')) {
            if (lgs.base3dTileset && lgs.viewer?.scene?.primitives?.contains?.(lgs.base3dTileset)) {
                lgs.viewer.scene.primitives.remove(lgs.base3dTileset, true)
            }
            lgs.base3dTileset = null
            lgs.stores.main.theBase3DLayer = null
            return undefined
        }

        let cancelled = false
        let tileset = null
        const previousGlobeShow = lgs.viewer.scene.globe.show
        const previousDepthTestAgainstTerrain = lgs.viewer.scene.globe.depthTestAgainstTerrain

        const load = async () => {
            try {
                const sceneKind = `${layer?.sceneKind ?? layer?.base3d?.kind ?? layer?.tiles3d?.kind ?? ''}`.toLowerCase()
                tileset = await IonLayerUtils.createTileset({
                    ...layer,
                    sceneKind,
                    show: layer?.show !== false,
                })

                if (cancelled) {
                    tileset.destroy?.()
                    return
                }

                lgs.base3dTileset = tileset
                lgs.stores.main.theBase3DLayer = layer
                if (!lgs.viewer.scene.primitives.contains(tileset)) {
                    lgs.viewer.scene.primitives.add(tileset)
                }

                lgs.viewer.scene.globe.show = layer?.base3d?.showGlobe !== false
                if (layer?.base3d?.showTerrain === false) {
                    lgs.viewer.scene.globe.depthTestAgainstTerrain = false
                }

                if (layer?.base3d?.flyToOnLoad ?? false) {
                    await lgs.viewer.flyTo(tileset)
                }

                lgs.viewer.scene.requestRender()
            }
            catch (error) {
                UIToast.error({
                                  caption: 'Cesium 3D base',
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
            if (lgs.base3dTileset === tileset) {
                lgs.base3dTileset = null
            }
            if (lgs.stores.main.theBase3DLayer?.id === layer?.id) {
                lgs.stores.main.theBase3DLayer = null
            }
            if (lgs.viewer && !lgs.viewer.isDestroyed()) {
                lgs.viewer.scene.globe.show = previousGlobeShow
                lgs.viewer.scene.globe.depthTestAgainstTerrain = previousDepthTestAgainstTerrain
                lgs.viewer.scene.requestRender()
            }
        }
    }, [ion.source, layer])

    return null
}
