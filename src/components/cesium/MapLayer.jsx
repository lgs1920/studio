import { BASE_LAYERS, OVERLAY_LAYERS }                                                                    from '@Core/constants'
import { ArcGisMapServerImageryProvider, OpenStreetMapImageryProvider, WebMapTileServiceImageryProvider } from 'cesium'
import { ImageryLayer }                                                                                   from 'resium'
import { subscribe, useSnapshot }                                                                         from 'valtio'

export const SLIPPY = 'Slippy'
export const WMTS = 'WMTS'
export const ARCGIS = 'ARCGIS'

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
        let settings = lgs.settings.layers
        const snapLayer = isBase ? settings.base : settings.overlay
        if (isBase) {
            lgs.mainProxy.theLayer = manager.layers.get(snapLayer)
        }
        else {
            lgs.mainProxy.theLayerOverlay = manager.layers.get(snapLayer)
        }
        let theLayer = manager.layers.get(snapLayer)
        // Bail if there is no layer
        if (theLayer === undefined) {
            theProvider = undefined
            return (<></>)
        }
        theProvider = manager.providers.get(theLayer.provider)
    })

    return (<>

            {  //Open Map layers
                theProvider && theProvider.type === SLIPPY && theLayer.type === props.type &&
                <ImageryLayer imageryProvider={new OpenStreetMapImageryProvider({
                                                                                    url: theLayer.url,
                                                                                    // We credit to get if it is base
                                                                                    // or overlay.
                                                                                    credit: props.type,
                })}/>
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
