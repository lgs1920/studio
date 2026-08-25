/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapLayer.jsx
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

import { BASE_ENTITY, OVERLAY_ENTITY, URL_AUTHENT_KEY } from '@Core/constants'
import { IonLayerUtils }                                from '@Utils/cesium/IonLayerUtils'
import {
    DefaultProxy, ImageryLayer, NeverTileDiscardPolicy, OpenStreetMapImageryProvider, Resource,
    UrlTemplateImageryProvider, WebMapServiceImageryProvider, WebMapTileServiceImageryProvider,
}                                                       from 'cesium'
import { useEffect, useMemo }     from 'react'
import { subscribe, useSnapshot } from 'valtio'
import { DEFAULT_LAYERS_COLOR_SETTINGS, OVERLAY_INDEX } from '../../core/constants'

export const SLIPPY = 'slippy'
export const WMTS = 'wmts'
export const WMTS_LEGACY = 'wmts-legacy'
export const WMS = 'wms'
export const ARCGIS = 'arcgis'
export const THUNDERFOREST = 'thunderforest'
export const SWISSTOPO = 'swisstopo'
export const WAYBACK = 'wayback'
export const MAPTILER = 'maptiler'
export const ION = 'ion'

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

const getSafeImageryInsertIndex = (collection, isBase) => {
    const length = collection?.length ?? 0
    if (isBase) {
        return 0
    }
    return Math.min(OVERLAY_INDEX, length)
}

const collectionContainsLayer = (collection, layer) => {
    if (!collection || !layer || typeof collection.contains !== 'function') {
        return false
    }
    try {
        return collection.contains(layer)
    }
    catch {
        return false
    }
}

const removeLayerFromCollection = (collection, layer) => {
    if (!collectionContainsLayer(collection, layer)) {
        return
    }
    try {
        collection.remove(layer, true)
    }
    catch {
        // The collection can be destroyed while switching between base3d and globe imagery.
    }
}

const addLayerToCollection = (collection, layer, index) => {
    if (!collection || !layer || typeof collection.add !== 'function') {
        return false
    }
    try {
        collection.add(layer, index)
        return true
    }
    catch {
        return false
    }
}

const MapLayerImagery = ({imageryProvider, isBase, layerId, collection}) => {
    useEffect(() => {
        if (!lgs.viewer || lgs.viewer.isDestroyed()) {
            return
        }

        if (!imageryProvider) {
            return
        }

        let layer
        let cancelled = false
        let removeErrorListener = null

        const addLayer = async () => {
            const nextLayer = typeof imageryProvider?.then === 'function'
                              ? await ImageryLayer.fromProviderAsync(imageryProvider)
                              : new ImageryLayer(imageryProvider)

            const provider = nextLayer?.imageryProvider
            if (provider?.errorEvent?.addEventListener) {
                const onProviderError = (tileError) => {
                    console.warn('Cesium imagery tile error', {
                        layerId,
                        layerKind: isBase ? BASE_ENTITY : OVERLAY_ENTITY,
                        providerType: provider?.constructor?.name,
                        providerUrl: provider?.url,
                        providerLayers: provider?.layers,
                        x: tileError?.x,
                        y: tileError?.y,
                        level: tileError?.level,
                        message: tileError?.message,
                        timesRetried: tileError?.timesRetried,
                    })
                }

                provider.errorEvent.addEventListener(onProviderError)
                removeErrorListener = () => provider.errorEvent.removeEventListener(onProviderError)
            }

            if (cancelled) {
                nextLayer.destroy?.()
                removeErrorListener?.()
                return
            }

            if (isBase) {
                if (lgs.theLayer) {
                    removeLayerFromCollection(collection, lgs.theLayer)
                }
                lgs.theLayer = nextLayer
                applyLayerSettings(lgs.theLayer, layerId)
                addLayerToCollection(collection, lgs.theLayer, getSafeImageryInsertIndex(collection, true))
                layer = lgs.theLayer
            }
            else {
                if (lgs.theLayerOverlay) {
                    removeLayerFromCollection(collection, lgs.theLayerOverlay)
                }
                lgs.theLayerOverlay = nextLayer
                applyLayerSettings(lgs.theLayerOverlay, layerId)
                addLayerToCollection(collection, lgs.theLayerOverlay, getSafeImageryInsertIndex(collection, false))
                layer = lgs.theLayerOverlay
            }

            lgs.viewer.scene.requestRender()
        }

        void addLayer()

        return () => {
            cancelled = true
            removeErrorListener?.()
            removeErrorListener = null
            if (!layer) {
                return
            }

            if (!lgs.viewer || lgs.viewer.isDestroyed()) {
                return
            }

            if (collection && !(typeof collection.isDestroyed === 'function' && collection.isDestroyed())) {
                removeLayerFromCollection(collection, layer)
            }

            if (isBase && lgs.theLayer === layer) {
                lgs.theLayer = null
            }
            else if (!isBase && lgs.theLayerOverlay === layer) {
                lgs.theLayerOverlay = null
            }
        }
    }, [collection, imageryProvider, isBase, layerId])

    return null
}

export const MapLayer = (props) => {

    const layers = useSnapshot(lgs.settings.layers)
    const ion = useSnapshot(lgs.stores.ion)

    const isBase = props.type === BASE_ENTITY
    const isLayerType = [BASE_ENTITY, OVERLAY_ENTITY].includes(props.type)
    const isBase3DActive = Boolean(layers.base3d)
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
    const layerTileMatrixLabels = theLayer?.tileMatrixLabels
    const layerCrs = theLayer?.crs
    const layerSrs = theLayer?.srs
    const layerWmsVersion = theLayer?.version
    const layerTransparent = theLayer?.transparent
    const layerApiKey = theLayer?.apikey
    const layerOther = theLayer?.other
    const layerProxy = theLayer?.proxy
    const layerUsageName = theLayer?.usage?.name
    const layerUsageToken = theLayer?.usage?.token
    const layerUsageUnlocked = theLayer?.usage?.unlocked
    const layerMinimumLevel = theLayer?.minimumLevel
    const layerMaximumLevel = theLayer?.maximumLevel
    const minLevel = readLevelOption(layerMinimumLevel)
    const maxLevel = readLevelOption(layerMaximumLevel)
    const imageryProvider = useMemo(() => {
        if (!isLayerType || !layerType || !layerTile || (isBase && isBase3DActive)) {
            return null
        }

        if (layerTile === ION && layerType === props.type && (!IonLayerUtils.isIonDependentLayer(theLayer) || ion.source === 'user')) {
            return IonLayerUtils.imageryProviderFromLayer(theLayer)
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
                                                            tileMatrixLabels: layerTileMatrixLabels,
                                                            ...levelOptions,
                                                            // We credit to get if it is base or overlay.
                                                            credit: props.type,
                                                        })
        }

        if (layerTile === WMS && layerType === props.type) {
            const wmsUrl = layerProxy
                          ? new Resource({
                              url:   theURL,
                              proxy: new DefaultProxy(layerProxy),
                          })
                          : theURL
            return new WebMapServiceImageryProvider({
                                                        url:        wmsUrl,
                                                        layers:     layerName,
                                                        parameters: {
                                                            format:      layerFormat,
                                                            styles:      layerStyle ?? '',
                                                            transparent: layerTransparent ?? true,
                                                            ...(layerWmsVersion ? {version: layerWmsVersion} : {}),
                                                        },
                                                        ...(layerCrs ? {crs: layerCrs} : {}),
                                                        ...(layerSrs ? {srs: layerSrs} : {}),
                                                        ...levelOptions,
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
        isBase,
        isBase3DActive,
        props.type,
        layerType,
        layerTile,
        layerUrl,
        layerName,
        layerFormat,
        layerStyle,
        layerTileMatrixSetID,
        layerTileMatrixLabels,
        layerCrs,
        layerSrs,
        layerWmsVersion,
        layerTransparent,
        layerUsageName,
        layerUsageToken,
        layerUsageUnlocked,
        layerApiKey,
        layerOther,
        layerProxy,
        ion.source,
        minLevel,
        maxLevel,
        theLayer,
    ])

    const ionImageryProvider = useMemo(() => {
        if (!theLayer || layerTile || !theLayer?.ionAssetId || (isBase && isBase3DActive)) {
            return null
        }

        if (IonLayerUtils.isIonDependentLayer(theLayer) && ion.source !== 'user') {
            return null
        }

        return IonLayerUtils.imageryProviderFromLayer(theLayer)
    }, [ion.source, isBase, isBase3DActive, layerTile, theLayer])

    const shouldDrapeOnBase3D = !isBase && layers.base3d && lgs.base3dTileset?.imageryLayers
    const targetCollectionKey = shouldDrapeOnBase3D ? 'base3d' : 'globe'
    const targetCollection = targetCollectionKey === 'base3d'
                           ? lgs.base3dTileset.imageryLayers
                           : lgs.viewer.imageryLayers

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
            {(imageryProvider || ionImageryProvider) && (
                <MapLayerImagery key={`${targetCollectionKey}-${layerUrl}-${layerType}-${layerId}`}
                                 isBase={isBase} layerId={layerId}
                                 imageryProvider={imageryProvider ?? ionImageryProvider}
                                 collection={targetCollection}/>
            )}
        </>
    )
}
