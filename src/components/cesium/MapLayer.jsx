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
                    url: 'https://wmts.geopf.fr/wmts',
                    layer: 'ORTHOIMAGERY.ORTHOPHOTOS',
                    style: 'normal',
                    format: 'image/jpeg',
                    tileMatrixSetID: 'PM',
                    service: 'WMTS',
                })}/>
            }
            https://wmts.geopf.fr/wmts?
            layer=ORTHOIMAGERY.ORTHOPHOTOS&
            style=normal&
            tilematrixset=PM&
            Service=WMTS&
            Request=GetTile&
            Version=1.0.0&
            Format=image%2Fjpeg&
            TileMatrix=11
            &TileCol=1060&TileRow=732

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
