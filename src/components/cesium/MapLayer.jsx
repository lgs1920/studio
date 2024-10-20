import { ArcGisMapServerImageryProvider, OpenStreetMapImageryProvider, WebMapTileServiceImageryProvider } from 'cesium'
import { ImageryLayer }                                                                                   from 'resium'
import { subscribe, useSnapshot }                                                                         from 'valtio'

export const SLIPPY = 'Slippy'
export const WMTS = 'WMTS'
export const ARCGIS = 'ARCGIS'
export const BASE_LAYERS = 'base'
export const OVERLAY_LAYERS = 'overlay'

export const MapLayer = (props) => {

    const manager = __.layerManager
    if (![BASE_LAYERS, OVERLAY_LAYERS].includes(props.type)) {
        return (<></>)
    }

    let snapshot = useSnapshot(lgs.settings.layers)
    let snapLayer = props.type === BASE_LAYERS ? snapshot.current : snapshot.overlay

    if (snapLayer === null) {
        return (<></>)
    }

    lgs.mainProxy.theLayer = manager.layers.get(snapLayer)
    let theLayer = manager.layers.get(snapLayer)
    let theProvider = manager.providers.get(theLayer.provider)

    subscribe(lgs.settings.layers, () => {
        let snapshot = useSnapshot(lgs.settings.layers)
        const snapLayer = props.type === BASE_LAYERS ? snapshot.current : snapshot.overlay
        lgs.mainProxy.theLayer = manager.layers.get(snapLayer)
        let theLayer = manager.layers.get(snapLayer)
        let theProvider = manager.providers.get(theLayer.provider)
    })

    return (<>

            {
                theProvider.type === SLIPPY && theLayer.type === props.type &&
                <ImageryLayer imageryProvider={
                    new OpenStreetMapImageryProvider({
                                                         url: theLayer.url,
                })}/>
            }

            {
                theProvider.type === WMTS && theLayer.type === props.type &&
                <ImageryLayer imageryProvider={
                    new WebMapTileServiceImageryProvider({
                                                             url:             theLayer.url,
                                                             layer:           theLayer.layer,
                                                             style:           theLayer.style,
                                                             format:          theLayer.format,
                                                             tileMatrixSetID: theLayer.tileMatrixSetID,

                                                         }/*,{transparent:props.type === OVERLAY_LAYERS}*/)
                }/>
            }

            {
                theProvider.type === ARCGIS && theLayer.type === props.type &&
                <ImageryLayer imageryProvider={
                    ArcGisMapServerImageryProvider.fromUrl(
                        'https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer',
                    )
                }/>
            }
        </>
    )
}
