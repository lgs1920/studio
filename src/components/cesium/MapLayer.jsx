import { BASE_LAYERS, OVERLAY_LAYERS } from '@Core/constants'
import {
    ArcGisMapServerImageryProvider, NeverTileDiscardPolicy, OpenStreetMapImageryProvider, UrlTemplateImageryProvider,
    WebMapTileServiceImageryProvider,
}                                      from 'cesium'
import { ImageryLayer }                from 'resium'
import { subscribe, useSnapshot }      from 'valtio'
import { LayersUtils }                 from '../../Utils/cesium/LayersUtils'

export const SLIPPY = 'slippy'
export const WMTS = 'wmts'
export const ARCGIS = 'arcgis'
export const THUNDERFOREST = 'thunderforest'

export const MapLayer = (props) => {

    const isBase = props.type === BASE_LAYERS
    const manager = __.layerManager
    if (![BASE_LAYERS, OVERLAY_LAYERS].includes(props.type)) {
        return (<></>)
    }

    let snapshot = useSnapshot(lgs.settings.layers)
    let snapLayer = isBase ? snapshot.base : snapshot.overlay

    if (snapLayer === null) {
        return (<></>)
    }

    if (isBase) {
        lgs.mainProxy.theLayer = manager.layers.get(snapLayer)
    }
    else {
        lgs.mainProxy.theLayerOverlay = manager.layers.get(snapLayer)
    }

    let theLayer = manager.layers.get(snapLayer)

    // Bail if there is no layer
    if (theLayer === undefined) {
        return (<></>)
    }
    let theProvider = manager.providers.get(theLayer.provider)

    subscribe(lgs.settings.layers, () => {
        console.log('change')
        let settings = lgs.settings.layers
        const snapLayer = isBase ? settings.base : settings.overlay
        if (isBase) {
            lgs.mainProxy.theLayer = manager.getLayerProxy(snapLayer)
        }
        else {
            lgs.mainProxy.theLayerOverlay = manager.getLayerProxy(snapLayer)
        }
        let theLayer = manager.getLayerProxy(snapLayer)
        // Bail if there is no layer
        if (theLayer === undefined) {
            theProvider = undefined
            return (<></>)
        }
        theProvider = manager.providers.get(theLayer.provider)
    })

    return (<>
            {  //OpenStreet Map type  layers (ie slippy)
                theProvider && theProvider.type === SLIPPY && theLayer.type === props.type &&
                <ImageryLayer imageryProvider={
                    new OpenStreetMapImageryProvider(
                        {
                            url:               theLayer.url,
                            credit:            props.type,
                            tileDiscardPolicy: NeverTileDiscardPolicy(),
                            customShader:      LayersUtils.testShader,
                        })}
                />
            }

            {  // Thunderforest Map Type Layers
                theProvider && theProvider.type === THUNDERFOREST && theLayer.type === props.type &&
                <ImageryLayer imageryProvider={
                    new UrlTemplateImageryProvider({
                                                       url:               theLayer.url + '{z}/{x}/{y}.png?apikey=' + theLayer.usage.token,
                                                       credit:            props.type,
                                                       tileDiscardPolicy: NeverTileDiscardPolicy(),
                                                       customShader:      LayersUtils.testShader,
                                                   })}
                />
            }

            {   // WMTS layers
                theProvider && theProvider.type === WMTS && theLayer.type === props.type &&
                <ImageryLayer imageryProvider={
                    new WebMapTileServiceImageryProvider({
                                                             url:             theLayer.url,
                                                             layer:           theLayer.layer,
                                                             style:           theLayer.style,
                                                             format:          theLayer.format,
                                                             tileMatrixSetID: theLayer.tileMatrixSetID,
                                                             // We credit to get if it is base or overlay.
                                                             credit: props.type,
                                                             apikey: 'ign_scan_ws',
                                                         })
                }/>
            }

            {   // ArcGIS layers
                theProvider && theProvider.type === ARCGIS && theLayer.type === props.type &&
                <ImageryLayer
                    imageryProvider={ArcGisMapServerImageryProvider.fromUrl(theLayer.url, {
                        // We credit to get if it is base or overlay.
                        credit: props.type,
                    })}/>
            }
        </>
    )
}
