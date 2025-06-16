/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapLayer.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-16
 * Last modified: 2025-06-16
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { BASE_ENTITY, OVERLAY_ENTITY, URL_AUTHENT_KEY }             from '@Core/constants'
import {
    ImageryLayer, NeverTileDiscardPolicy, OpenStreetMapImageryProvider, UrlTemplateImageryProvider,
    WebMapTileServiceImageryProvider,
}                                                                   from 'cesium'
import { subscribe, useSnapshot }                                   from 'valtio'
import { BASE_INDEX, DEFAULT_LAYERS_COLOR_SETTINGS, OVERLAY_INDEX } from '../../core/constants'

export const SLIPPY = 'slippy'
export const WMTS = 'wmts'
export const WMTS_LEGACY = 'wmts-legacy'
export const ARCGIS = 'arcgis'
export const THUNDERFOREST = 'thunderforest'
export const SWISSTOPO = 'swisstopo'
export const WAYBACK = 'wayback'
export const MAPTILER = 'maptiler'


export const MapLayer = (props) => {

    const layers = useSnapshot(lgs.settings.layers)
    const main = useSnapshot(lgs.mainProxy)

    const isBase = props.type === BASE_ENTITY
    const manager = __.layersAndTerrainManager
    if (![BASE_ENTITY, OVERLAY_ENTITY].includes(props.type)) {
        console.error(sprintf('%s %s', 'Improper layer type: ', props.type))
        return (<>{'Improper layer type !'}</>)
    }

    /**
     * We need to update some information when layer settings
     */
    subscribe(lgs.settings.layers, () => {
        let settings = lgs.settings.layers
        const snapLayer = isBase ? settings.base : settings.overlay
        if (isBase) {
            lgs.mainProxy.theLayer = manager.getEntityProxy(snapLayer)
        }
        else {
            lgs.mainProxy.theLayerOverlay = snapLayer ? manager.getEntityProxy(snapLayer) : null
            if (!lgs.mainProxy.theLayerOverlay) {
                lgs.viewer.imageryLayers.remove(lgs.viewer.imageryLayers.get(OVERLAY_INDEX), true)
            }
        }
    })

    let snapLayer = isBase ? layers.base : layers.overlay
    // Nothing to do here, bails early
    if (snapLayer === null || snapLayer === '') {
        return false
    }

    // Get the right layer
    let theLayer
    if (isBase) {
        lgs.mainProxy.theLayer = manager.getEntityProxy(snapLayer)
        theLayer = main.theLayer
    }
    else {
        lgs.mainProxy.theLayerOverlay = manager.getEntityProxy(snapLayer)
        theLayer = main.theLayerOverlay
    }

    // Bail if there is no layer
    if (!theLayer) {
        return false
    }

    // We have some, let's play with it
    const theProvider = manager.getProviderProxyByEntity(theLayer.id)

    // If we have authent in the url, we need to replace it
    let theURL = theLayer.url
    if (theURL.includes(URL_AUTHENT_KEY)) {
        if (theLayer.usage?.unlocked && theLayer.usage?.name) {
            theURL = theURL.replace(URL_AUTHENT_KEY, `${theLayer.usage.name}=${theLayer.usage.token}`)
        }
        else {
            theURL = theURL.replace(URL_AUTHENT_KEY, '')
        }
    }

    const Imagery = (props) => {

        const applySettings = layer => {
            let settings = DEFAULT_LAYERS_COLOR_SETTINGS
            if (lgs.settings.layers?.colorSettings !== null) {
                settings = lgs.settings.layers?.colorSettings[theLayer.id]
            }
            layer.brightness = settings?.brightness ?? DEFAULT_LAYERS_COLOR_SETTINGS.brightness
            layer.contrast = settings?.contrast ?? DEFAULT_LAYERS_COLOR_SETTINGS.contrast
            layer.hue = settings?.hue ?? DEFAULT_LAYERS_COLOR_SETTINGS.hue
            layer.saturation = settings?.saturation ?? DEFAULT_LAYERS_COLOR_SETTINGS.saturation
            layer.gamma = settings?.gamma ?? DEFAULT_LAYERS_COLOR_SETTINGS.gamma
            layer.alpha = settings?.alpha ?? DEFAULT_LAYERS_COLOR_SETTINGS.alpha
            //  target.colorToAlpha = new Color.fromCssColorString(settings.colorToAlpha?? defaults.colorToAlpha)
            //  target.colorToAlphaThreshold = settings.colorToAlphaThreshold ?? defaults.colorToAlphaThreshold
        }

        if (isBase) {
            if (lgs.theLayer) {
                lgs.viewer.imageryLayers.remove(lgs.theLayer, true)
            }
            lgs.theLayer = new ImageryLayer(props.imageryProvider)
            applySettings(lgs.theLayer)

            lgs.viewer.imageryLayers.add(lgs.theLayer, BASE_INDEX)
        }
        else {
            if (lgs.theLayerOverlay) {
                lgs.viewer.imageryLayers.remove(lgs.theLayerOverlay, true)
            }
            lgs.theLayerOverlay = new ImageryLayer(props.imageryProvider)
            applySettings(lgs.theLayerOverlay)
            lgs.viewer.imageryLayers.add(lgs.theLayerOverlay, OVERLAY_INDEX)
        }
        return false
    }

    return (
        <>
            {  //OpenStreet Map type  layers (ie slippy)
                theProvider && theLayer.tile === SLIPPY && theLayer.type === props.type &&
                <Imagery key={theURL + '-' + theLayer.type} imageryProvider={
                    new OpenStreetMapImageryProvider(
                        {
                            url:               theURL,
                            credit:            props.type,
                            tileDiscardPolicy: NeverTileDiscardPolicy(),
                        })}
                />
            }

            {  //MapTiler
                theProvider && theLayer.tile === MAPTILER && theLayer.type === props.type &&
                <Imagery key={theURL + '-' + theLayer.type} imageryProvider={
                    new UrlTemplateImageryProvider(
                        {
                            url:               theURL,
                            credit:            props.type,
                            tileDiscardPolicy: NeverTileDiscardPolicy(),
                        })}
                />
            }

            {  // Thunderforest Map Type Layers
                theProvider && theLayer.tile === THUNDERFOREST && theLayer.type === props.type &&
                <Imagery key={theURL + '-' + theLayer.type} imageryProvider={
                    new UrlTemplateImageryProvider({
                                                       url:               `${theURL}{z}/{x}/{y}.png?${theLayer.usage.name}=${theLayer.usage.token}`,
                                                       credit:            props.type,
                                                       tileDiscardPolicy: NeverTileDiscardPolicy(),
                                                       style:             theLayer.style,

                                                   })}
                />
            }

            {  // SwissTopo Map Type Layers
                theProvider && theLayer.tile === SWISSTOPO && theLayer.type === props.type &&
                <Imagery key={theURL + '-' + theLayer.type} imageryProvider={
                    new UrlTemplateImageryProvider({
                                                       url:               theURL,
                                                       credit:            props.type,
                                                       tileDiscardPolicy: NeverTileDiscardPolicy(),
                                                       style:             theLayer.style,

                                                   })}
                />
            }

            {   // WMTS layers
                theProvider && theLayer.tile === WMTS && theLayer.type === props.type &&
                <Imagery key={theURL + '-' + theLayer.type} imageryProvider={
                    new WebMapTileServiceImageryProvider({
                                                             url:             theURL,
                                                             layer:           theLayer.layer,
                                                             style:           theLayer.style,
                                                             format:          theLayer.format,
                                                             tileMatrixSetID: theLayer.tileMatrixSetID,
                                                             // We credit to get if it is base or overlay.
                                                             credit: props.type,
                                                         })
                }/>
            }

            {   // WMTS Legacy
                theProvider && theLayer.tile === WMTS_LEGACY && theLayer.type === props.type &&
                <Imagery key={theURL + '-' + theLayer.type} imageryProvider={
                    new UrlTemplateImageryProvider({
                                                       url:               `${theURL}?layer=${theLayer.layer}&style=${theLayer.style}&format=${theLayer.format}&tilematrixset=${theLayer.tileMatrixSetID}\
&${theLayer.other}&${(theLayer?.apikey) ? `apikey=${theLayer.apikey}` : ''}&TileMatrix={z}&TileCol={x}&TileRow={y}`,
                                                       credit:            props.type,
                                                       tileDiscardPolicy: NeverTileDiscardPolicy(),
                                                   })}
                />
            }

            {   // Wayback layers
                theProvider && theLayer.tile === WAYBACK && theLayer.type === props.type &&
                <Imagery key={theURL + '-' + theLayer.type}
                         imageryProvider={new UrlTemplateImageryProvider({
                                                                             url:               `${theURL}/{z}/{y}/{x}`,
                                                                             credit:            props.type,
                                                                             tileDiscardPolicy: NeverTileDiscardPolicy(),

                                                                         })}/>
            }
        </>
    )
}
