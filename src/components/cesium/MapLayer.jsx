import { OpenStreetMapImageryProvider, WebMapTileServiceImageryProvider } from 'cesium'
import { ImageryLayer }                                                   from 'resium'
import { useSnapshot }                                                    from 'valtio'
import { Layer }                                                          from '../../core/Layer.js'

export const MapLayer = (layer) => {

    const mainStore = vt3d.mainProxy
    const mainSnap = useSnapshot(mainStore)

    return (<>

            {
                mainSnap.layer === Layer.OSM_PLAN &&
                <ImageryLayer imageryProvider={new OpenStreetMapImageryProvider({
                    url: 'https://tile.openstreetmap.org/',
                })}/>
            }

                {
                    mainSnap.layer === Layer.IGN_PLAN &&
                    <ImageryLayer imageryProvider={new WebMapTileServiceImageryProvider({
                        url: 'https://wxs.ign.fr/cartes/geoportail/wmts',
                        layer: 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2',
                        style: 'normal',
                        format: 'image/png',
                        tileMatrixSetID: 'PM',
                    })}/>
                }

                {
                    mainSnap.layer === Layer.IGN_AERIAL &&
                    <ImageryLayer imageryProvider={new WebMapTileServiceImageryProvider({
                        url: 'https://wxs.ign.fr/cartes/geoportail/wmts',
                        layer: 'ORTHOIMAGERY.ORTHOPHOTOS2',
                        style: 'normal',
                        format: 'image/png',
                        tileMatrixSetID: 'PM',
                    })}/>
                }

                {
                    mainSnap.layer === Layer.IGN_CADASTRAL &&
                    <ImageryLayer imageryProvider={new WebMapTileServiceImageryProvider({
                        url: 'https://wxs.ign.fr/cartes/geoportail/wmts',
                        layer: 'CADASTRALPARCELS.PARCELLAIRE_EXPRESS',
                        style: 'normal',
                        format: 'image/png',
                        tileMatrixSetID: 'PM',
                    })}/>
                }

        </>
    )
}
