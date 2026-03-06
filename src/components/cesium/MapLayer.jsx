/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapLayer.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-06
 * Last modified: 2026-03-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { useEffect }                                    from 'react'
import { BASE_ENTITY, OVERLAY_ENTITY, URL_AUTHENT_KEY } from '@Core/constants'
import {
    ImageryLayer, NeverTileDiscardPolicy, OpenStreetMapImageryProvider, UrlTemplateImageryProvider,
    WebMapTileServiceImageryProvider,
}                                                       from 'cesium'
import { useSnapshot, subscribe }                       from 'valtio'
import { BASE_INDEX, DEFAULT_LAYERS_COLOR_SETTINGS, OVERLAY_INDEX } from '../../core/constants'

// Constants for layer types
export const SLIPPY = 'slippy'
export const WMTS = 'wmts'
export const WMTS_LEGACY = 'wmts-legacy'
export const ARCGIS = 'arcgis'
export const THUNDERFOREST = 'thunderforest'
export const SWISSTOPO = 'swisstopo'
export const WAYBACK = 'wayback'
export const MAPTILER = 'maptiler'

/**
 * Imagery component handling the lifecycle of the Cesium ImageryLayer
 */
const Imagery = ({imageryProvider, layerId, type, settings}) => {
    useEffect(() => {

        if (!lgs.viewer || lgs.viewer.isDestroyed()) {
            console.error('[MapLayer] Viewer is not ready')
            return
        }

        console.log(`[MapLayer] Mounting imagery for: ${layerId} (Type: ${type})`)

        if (!imageryProvider) {
            console.error(`[MapLayer] Invalid provider for: ${layerId}`)
            return
        }

        const layer = new ImageryLayer(imageryProvider)

        // Applying production-grade visual settings
        layer.brightness = settings?.brightness ?? DEFAULT_LAYERS_COLOR_SETTINGS.brightness
        layer.contrast = settings?.contrast ?? DEFAULT_LAYERS_COLOR_SETTINGS.contrast
        layer.hue = settings?.hue ?? DEFAULT_LAYERS_COLOR_SETTINGS.hue
        layer.saturation = settings?.saturation ?? DEFAULT_LAYERS_COLOR_SETTINGS.saturation
        layer.gamma = settings?.gamma ?? DEFAULT_LAYERS_COLOR_SETTINGS.gamma
        layer.alpha = settings?.alpha ?? DEFAULT_LAYERS_COLOR_SETTINGS.alpha

        const index = type === BASE_ENTITY ? BASE_INDEX : OVERLAY_INDEX
        lgs.viewer.imageryLayers.add(layer, index)

        return () => {
            console.log(`[MapLayer] Unmounting/Cleaning up: ${layerId}`)
            if (!lgs.viewer.isDestroyed() && lgs.viewer.imageryLayers.contains(layer)) {
                lgs.viewer.imageryLayers.remove(layer, true)
            }
        }
    }, [imageryProvider, layerId, type, settings])

    return null
}

export const MapLayer = (props) => {
    const layers = useSnapshot(lgs.settings.layers)
    const manager = __.layersAndTerrainManager

    if (![BASE_ENTITY, OVERLAY_ENTITY].includes(props.type)) {
        console.error(sprintf('%s %s', 'Improper layer type: ', props.type))
        return (<>{'Improper layer type !'}</>)
    }

    const snapLayer = props.type === BASE_ENTITY ? layers.base : layers.overlay
    if (!snapLayer) {
        return null
    }

    const theLayer = manager.getEntityProxy(snapLayer)
    if (!theLayer) {
        return null
    }

    const theProvider = manager.getProviderProxyByEntity(theLayer.id)
    let theURL = theLayer.url

    // Auth handling
    if (theURL.includes(URL_AUTHENT_KEY)) {
        const authValue = (theLayer.usage?.unlocked && theLayer.usage?.name)
                          ? `${theLayer.usage.name}=${theLayer.usage.token}`
                          : ''
        theURL = theURL.replace(URL_AUTHENT_KEY, authValue)
    }

    const colorSettings = lgs.settings.layers?.colorSettings?.[theLayer.id] || DEFAULT_LAYERS_COLOR_SETTINGS

    return (
        <>
            {theProvider && theLayer.type === props.type && (
                <>
                    {theLayer.tile === SLIPPY && (
                        <Imagery
                            key={'slippy-' + theLayer.id}
                            layerId={theLayer.id}
                            type={props.type}
                            settings={colorSettings}
                            imageryProvider={new OpenStreetMapImageryProvider({
                                                                                  url:               theURL,
                                                                                  credit:            props.type,
                                                                                  tileDiscardPolicy: NeverTileDiscardPolicy(),
                                                                              })}
                        />
                    )}

                    {theLayer.tile === MAPTILER && (
                        <Imagery
                            key={'maptiler-' + theLayer.id}
                            layerId={theLayer.id}
                            type={props.type}
                            settings={colorSettings}
                            imageryProvider={new UrlTemplateImageryProvider({
                                                                                url:               theURL,
                                                                                credit:            props.type,
                                                                                tileDiscardPolicy: NeverTileDiscardPolicy(),
                                                                            })}
                        />
                    )}

                    {theLayer.tile === WMTS && (
                        <Imagery
                            key={'wmts-' + theLayer.id}
                            layerId={theLayer.id}
                            type={props.type}
                            settings={colorSettings}
                            imageryProvider={new WebMapTileServiceImageryProvider({
                                                                                      url:             theURL,
                                                                                      layer:           theLayer.layer,
                                                                                      style:           theLayer.style,
                                                                                      format:          theLayer.format,
                                                                                      tileMatrixSetID: theLayer.tileMatrixSetID,
                                                                                      credit:          props.type,
                                                                                  })}
                        />
                    )}

                    {/* Add other providers following this pattern */}
                </>
            )}
        </>
    )
}