import { BASE_ENTITY, OVERLAY_ENTITY } from '@Core/constants'
import {
    NeverTileDiscardPolicy, OpenStreetMapImageryProvider, UrlTemplateImageryProvider, WebMapTileServiceImageryProvider,
}                                      from 'cesium'
import { ImageryLayer }                from 'resium'
import { subscribe, useSnapshot }      from 'valtio'

export const SLIPPY = 'slippy'
export const WMTS = 'wmts'
export const WMTS_LEGACY = 'wmts-legacy'
export const ARCGIS = 'arcgis'
export const THUNDERFOREST = 'thunderforest'
export const SWISSTOPO = 'swisstopo'
export const WAYBACK = 'wayback'
export const MAPTILER = 'maptiler'

const IMAGERY_AUTHENT_KEY = '{%authent%}'

export const MapLayer = (props) => {

    const layers = useSnapshot(lgs.settings.layers)
    const main = useSnapshot(lgs.mainProxy)

    const isBase = props.type === BASE_ENTITY
    const manager = __.layersAndTerrainManager
    if (![BASE_ENTITY, OVERLAY_ENTITY].includes(props.type)) {
        return (<></>)
    }

    // Apply changes on settings
    subscribe(lgs.settings.layers, () => {
        let settings = lgs.settings.layers
        const snapLayer = isBase ? settings.base : settings.overlay
        if (isBase) {
            lgs.mainProxy.theLayer = manager.getEntityProxy(snapLayer)
        }
        else {
            lgs.mainProxy.theLayerOverlay = snapLayer ? manager.getEntityProxy(snapLayer) : null
        }
    })

    let snapLayer = isBase ? layers.base : layers.overlay
    if (snapLayer === null || snapLayer === '') {
        return (<></>)
    }

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
        return (<></>)
    }
    const theProvider = manager.getProviderProxyByEntity(theLayer.id)

    // If we have authent in the url, we need to replace it
    let theURL = theLayer.url
    if (theURL.includes(IMAGERY_AUTHENT_KEY)) {
        if (theLayer.usage?.unlocked && theLayer.usage?.name) {
            theURL = theURL.replace(IMAGERY_AUTHENT_KEY, `${theLayer.usage.name}=${theLayer.usage.token}`)
        }
        else {
            theURL = theURL.replace(IMAGERY_AUTHENT_KEY, '')
        }
    }

    return (
        <>
            {  //OpenStreet Map type  layers (ie slippy)
                theProvider && theLayer.tile === SLIPPY && theLayer.type === props.type &&
                <ImageryLayer key={theURL + '-' + theLayer.type} imageryProvider={
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
                <ImageryLayer key={theURL + '-' + theLayer.type} imageryProvider={
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
                <ImageryLayer key={theURL + '-' + theLayer.type} imageryProvider={
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
                <ImageryLayer key={theURL + '-' + theLayer.type} imageryProvider={
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
                <ImageryLayer key={theURL + '-' + theLayer.type} imageryProvider={
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
                <ImageryLayer key={theURL + '-' + theLayer.type} imageryProvider={
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
                <ImageryLayer key={theURL + '-' + theLayer.type}
                              imageryProvider={new UrlTemplateImageryProvider({
                                                                                  url:               `${theURL}/{z}/{y}/{x}`,
                                                                                  credit:            props.type,
                                                                                  tileDiscardPolicy: NeverTileDiscardPolicy(),

                                                                              })}/>
            }
        </>
    )
}
