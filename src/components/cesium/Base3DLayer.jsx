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
import { useEffect, useRef } from 'react'
import { useSnapshot } from 'valtio'

export const Base3DLayer = () => {
    const layers = useSnapshot(lgs.settings.layers)
    const ion = useSnapshot(lgs.stores.ion)
    const manager = __.layersAndTerrainManager
    const layerId = layers.base3d
    const layer = layerId ? manager.getEntityProxy(layerId) : null
    const loadingTimer = useRef(null)
    const loadingStartedAt = useRef(0)
    const nextFrame = () => new Promise(resolve => window.requestAnimationFrame(() => resolve()))
    const MIN_LOADING_VISIBILITY_MS = 500
    const MAX_LOADING_VISIBILITY_MS = 3000

    const setBase3DLoading = (loading) => {
        const isLoading = lgs.stores.main.components.layers.base3dLoading === true
        if (loading && isLoading) {
            return
        }

        lgs.stores.main.components.layers.base3dLoading = loading
        if (loadingTimer.current !== null) {
            clearTimeout(loadingTimer.current)
            loadingTimer.current = null
        }

        if (loading) {
            loadingStartedAt.current = Date.now()
            loadingTimer.current = window.setTimeout(() => {
                lgs.stores.main.components.layers.base3dLoading = false
                loadingTimer.current = null
            }, MAX_LOADING_VISIBILITY_MS)
        }
    }

    const clearLoadingTimer = () => {
        if (loadingTimer.current !== null) {
            clearTimeout(loadingTimer.current)
            loadingTimer.current = null
        }
    }

    useEffect(() => {
        if (!lgs.viewer || lgs.viewer.isDestroyed() || !layer || layer.type !== BASE3D_ENTITY || (IonLayerUtils.isPersonalLayer(layer) && ion.source !== 'user')) {
            if (lgs.base3dTileset && lgs.viewer?.scene?.primitives?.contains?.(lgs.base3dTileset)) {
                lgs.viewer.scene.primitives.remove(lgs.base3dTileset, true)
            }
            lgs.base3dTileset = null
            lgs.stores.main.theBase3DLayer = null
            setBase3DLoading(false)
            return undefined
        }

        let cancelled = false
        let tileset = null
        let loadingFinished = false
        const previousGlobeShow = lgs.viewer.scene.globe.show
        const previousDepthTestAgainstTerrain = lgs.viewer.scene.globe.depthTestAgainstTerrain

        const finishLoading = async () => {
            if (cancelled || loadingFinished) {
                return
            }
            loadingFinished = true

            const elapsed = Date.now() - loadingStartedAt.current
            if (elapsed < MIN_LOADING_VISIBILITY_MS) {
                await new Promise(resolve => window.setTimeout(resolve, MIN_LOADING_VISIBILITY_MS - elapsed))
            }
            clearLoadingTimer()
            lgs.stores.main.components.layers.base3dLoading = false
        }

        const load = async () => {
            try {
                setBase3DLoading(true)
                await nextFrame()
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

                if (tileset.readyPromise) {
                    await tileset.readyPromise.catch(() => null)
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
            finally {
                if (!cancelled) {
                    await finishLoading()
                }
            }
        }

        void load()

        return () => {
            cancelled = true
            clearLoadingTimer()
            lgs.stores.main.components.layers.base3dLoading = false
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
