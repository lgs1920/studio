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

import { BASE_ENTITY, OVERLAY_ENTITY, URL_AUTHENT_KEY } from '@Core/constants'
import {
    ImageryLayer, NeverTileDiscardPolicy, OpenStreetMapImageryProvider, UrlTemplateImageryProvider,
    WebMapTileServiceImageryProvider,
}                                                       from 'cesium'
import { useEffect, useMemo }     from 'react'
import { subscribe, useSnapshot } from 'valtio'
import { BASE_INDEX, DEFAULT_LAYERS_COLOR_SETTINGS, OVERLAY_INDEX } from '../../core/constants'

export const SLIPPY = 'slippy'
export const WMTS = 'wmts'
export const WMTS_LEGACY = 'wmts-legacy'
export const ARCGIS = 'arcgis'
export const THUNDERFOREST = 'thunderforest'
export const SWISSTOPO = 'swisstopo'
export const WAYBACK = 'wayback'
export const MAPTILER = 'maptiler'

const stripTrailingSlash = url => (url?.endsWith('/') ? url.replace(/\/+$/, '') : url)

const readLevelOption = value => {
    const level = Number(value)
    return Number.isInteger(level) && level >= 0 ? level : undefined
}

const buildLegacyWmtsUrl = layer => {
    if (!layer?.url) {
        return ''
    }
    const baseUrl = layer.url
    const apiKey = layer.apikey ? `apikey=${layer.apikey}` : ''
    const other = layer.other ?? ''
    const params = [
        apiKey,
        other.replace(/^\?/, '').replace(/^&/, ''),
        `layer=${layer.layer}`,
        `style=${layer.style ?? 'default'}`,
        `format=${layer.format}`,
        `tilematrixset=${layer.tileMatrixSetID}`,
        'TileMatrix={z}',
        'TileRow={y}',
        'TileCol={x}',
    ].filter(Boolean).join('&')
    return `${baseUrl}?${params}`
}

const applyLayerSettings = (layer, layerId) => {
    let settings = DEFAULT_LAYERS_COLOR_SETTINGS
    if (lgs.settings.layers?.colorSettings !== null) {
        settings = lgs.settings.layers?.colorSettings[layerId]
    }
    layer.brightness = settings?.brightness ?? DEFAULT_LAYERS_COLOR_SETTINGS.brightness
    layer.contrast = settings?.contrast ?? DEFAULT_LAYERS_COLOR_SETTINGS.contrast
    layer.hue = settings?.hue ?? DEFAULT_LAYERS_COLOR_SETTINGS.hue
    layer.saturation = settings?.saturation ?? DEFAULT_LAYERS_COLOR_SETTINGS.saturation
    layer.gamma = settings?.gamma ?? DEFAULT_LAYERS_COLOR_SETTINGS.gamma
    layer.alpha = settings?.alpha ?? DEFAULT_LAYERS_COLOR_SETTINGS.alpha
}

const MapLayerImagery = ({imageryProvider, isBase, layerId}) => {
    useEffect(() => {
        if (!lgs.viewer || lgs.viewer.isDestroyed()) {
            return
        }

        if (!imageryProvider) {
            return
        }

        let layer
        if (isBase) {
            if (lgs.theLayer) {
                lgs.viewer.imageryLayers.remove(lgs.theLayer, true)
            }
            lgs.theLayer = new ImageryLayer(imageryProvider)
            applyLayerSettings(lgs.theLayer, layerId)
            lgs.viewer.imageryLayers.add(lgs.theLayer, BASE_INDEX)
            layer = lgs.theLayer
        }
        else {
            if (lgs.theLayerOverlay) {
                lgs.viewer.imageryLayers.remove(lgs.theLayerOverlay, true)
            }
            lgs.theLayerOverlay = new ImageryLayer(imageryProvider)
            applyLayerSettings(lgs.theLayerOverlay, layerId)
            lgs.viewer.imageryLayers.add(lgs.theLayerOverlay, OVERLAY_INDEX)
            layer = lgs.theLayerOverlay
        }

        lgs.viewer.scene.requestRender()

        return () => {
            if (layer && !lgs.viewer.isDestroyed() && lgs.viewer.imageryLayers.contains(layer)) {
                lgs.viewer.imageryLayers.remove(layer, true)
            }
        }
    }, [imageryProvider, isBase, layerId])

    return null
}

export const MapLayer = (props) => {

    const layers = useSnapshot(lgs.settings.layers)

    const isBase = props.type === BASE_ENTITY
    const isLayerType = [BASE_ENTITY, OVERLAY_ENTITY].includes(props.type)
    const manager = __.layersAndTerrainManager
    const snapLayer = isBase ? layers.base : layers.overlay
    const theLayer = isLayerType && snapLayer ? manager.getEntityProxy(snapLayer) : null
    const layerId = theLayer?.id
    const layerType = theLayer?.type
    const layerTile = theLayer?.tile
    const layerUrl = theLayer?.url ?? ''
    const layerStyle = theLayer?.style
    const layerName = theLayer?.layer
    const layerFormat = theLayer?.format
    const layerTileMatrixSetID = theLayer?.tileMatrixSetID
    const layerApiKey = theLayer?.apikey
    const layerOther = theLayer?.other
    const layerUsageName = theLayer?.usage?.name
    const layerUsageToken = theLayer?.usage?.token
    const layerUsageUnlocked = theLayer?.usage?.unlocked
    const layerMinimumLevel = theLayer?.minimumLevel
    const layerMaximumLevel = theLayer?.maximumLevel
    const minLevel = readLevelOption(layerMinimumLevel)
    const maxLevel = readLevelOption(layerMaximumLevel)
    const imageryProvider = useMemo(() => {
        if (!isLayerType || !layerType || !layerTile) {
            return null
        }

        let theURL = layerUrl
        if (theURL && theURL.includes(URL_AUTHENT_KEY)) {
            if (layerUsageUnlocked && layerUsageName) {
                theURL = theURL.replace(URL_AUTHENT_KEY, `${layerUsageName}=${layerUsageToken}`)
            }
            else {
                theURL = theURL.replace(URL_AUTHENT_KEY, '')
            }
        }

        const levelOptions = {
            ...(minLevel !== undefined ? {minimumLevel: minLevel} : {}),
            ...(maxLevel !== undefined ? {maximumLevel: maxLevel} : {}),
        }

        if (layerTile === SLIPPY && layerType === props.type) {
            return new OpenStreetMapImageryProvider({
                                                        url:               theURL,
                                                        credit:            props.type,
                                                        tileDiscardPolicy: NeverTileDiscardPolicy(),
                                                        ...levelOptions,
                                                    })
        }

        if (layerTile === MAPTILER && layerType === props.type) {
            return new UrlTemplateImageryProvider({
                                                      url:               theURL,
                                                      credit:            props.type,
                                                      tileDiscardPolicy: NeverTileDiscardPolicy(),
                                                      ...levelOptions,
                                                  })
        }

        if (layerTile === THUNDERFOREST && layerType === props.type) {
            return new UrlTemplateImageryProvider({
                                                      url:               `${theURL}{z}/{x}/{y}.png?${layerUsageName}=${layerUsageToken}`,
                                                      credit:            props.type,
                                                      tileDiscardPolicy: NeverTileDiscardPolicy(),
                                                      style:             layerStyle,
                                                      ...levelOptions,
                                                  })
        }

        if (layerTile === SWISSTOPO && layerType === props.type) {
            return new UrlTemplateImageryProvider({
                                                      url:               theURL,
                                                      credit:            props.type,
                                                      tileDiscardPolicy: NeverTileDiscardPolicy(),
                                                      style:             layerStyle,
                                                      ...levelOptions,
                                                  })
        }

        if (layerTile === WMTS && layerType === props.type) {
            return new WebMapTileServiceImageryProvider({
                                                            url:             theURL,
                                                            layer:           layerName,
                                                            style:           layerStyle,
                                                            format:          layerFormat,
                                                            tileMatrixSetID: layerTileMatrixSetID,
                                                            ...levelOptions,
                                                            // We credit to get if it is base or overlay.
                                                            credit: props.type,
                                                        })
        }

        if (layerTile === WMTS_LEGACY && layerType === props.type) {
            return new UrlTemplateImageryProvider({
                                                      url:               buildLegacyWmtsUrl({
                                                                                               url:             layerUrl,
                                                                                               apikey:          layerApiKey,
                                                                                               other:           layerOther,
                                                                                               layer:           layerName,
                                                                                               style:           layerStyle,
                                                                                               format:          layerFormat,
                                                                                               tileMatrixSetID: layerTileMatrixSetID,
                                                                                           }),
                                                      credit:            props.type,
                                                      tileDiscardPolicy: NeverTileDiscardPolicy(),
                                                      ...levelOptions,
                                                  })
        }

        if (layerTile === WAYBACK && layerType === props.type) {
            return new UrlTemplateImageryProvider({
                                                      url:               `${stripTrailingSlash(theURL)}/{z}/{y}/{x}`,
                                                      credit:            props.type,
                                                      tileDiscardPolicy: NeverTileDiscardPolicy(),
                                                      ...levelOptions,
                                                  })
        }

        return null
    }, [
        isLayerType,
        props.type,
        layerType,
        layerTile,
        layerUrl,
        layerName,
        layerFormat,
        layerStyle,
        layerTileMatrixSetID,
        layerUsageName,
        layerUsageToken,
        layerUsageUnlocked,
        layerApiKey,
        layerOther,
        minLevel,
        maxLevel,
    ])

    /**
     * We need to update some information when layer settings
     */
    useEffect(() => {
        if (!isLayerType) {
            return undefined
        }

        const unsubscribe = subscribe(lgs.settings.layers, () => {
            let settings = lgs.settings.layers
            const snapLayer = isBase ? settings.base : settings.overlay
            if (isBase) {
                lgs.stores.main.theLayer = manager.getEntityProxy(snapLayer)
            }
            else {
                lgs.stores.main.theLayerOverlay = snapLayer ? manager.getEntityProxy(snapLayer) : null
                if (!lgs.stores.main.theLayerOverlay) {
                    lgs.viewer.imageryLayers.remove(lgs.viewer.imageryLayers.get(OVERLAY_INDEX), true)
                }
            }
        })
        return () => unsubscribe()
    }, [isBase, isLayerType, manager])

    useEffect(() => {
        if (!isLayerType) {
            return
        }

        if (isBase) {
            lgs.stores.main.theLayer = theLayer
        }
        else {
            lgs.stores.main.theLayerOverlay = theLayer
        }
    }, [isBase, isLayerType, theLayer])

    if (!isLayerType) {
        return (<>{'Improper layer type !'}</>)
    }

    // Nothing to do here, bails early
    if (snapLayer === null || snapLayer === '' || !theLayer) {
        return null
    }

    return (
        <>
            {imageryProvider && (
                <MapLayerImagery key={`${layerUrl}-${layerType}`} isBase={isBase} layerId={layerId} imageryProvider={imageryProvider}/>
            )}
        </>
    )
}
