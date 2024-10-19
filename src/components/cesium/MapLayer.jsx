import { LayerManager }                                                   from '@Core/layers/LayerManager.js'
import { OpenStreetMapImageryProvider, WebMapTileServiceImageryProvider } from 'cesium'
import { ImageryLayer }                                                   from 'resium'
import { subscribe, useSnapshot }                                         from 'valtio'

export const MapLayer = (layer) => {

    let snapshot = useSnapshot(lgs.settings.layers)
    subscribe(lgs.settings.layers, () => {
                  let snapshot = useSnapshot(lgs.settings.layers)
              },
    )
    return (<>

            {
                snapshot.current === LayerManager.OSM_PLAN &&
                <ImageryLayer imageryProvider={new OpenStreetMapImageryProvider({
                    url: 'https://tile.openstreetmap.org/',
                })}/>
            }

            {
                snapshot.current === LayerManager.IGN_PLAN &&
                <ImageryLayer imageryProvider={new WebMapTileServiceImageryProvider({
                                                                                        url: 'https://data.geopf.fr/wmts',
                    layer: 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2',
                    style: 'normal',
                    format: 'image/png',
                    tileMatrixSetID: 'PM',
                })}/>
            }

            {
                snapshot.current === LayerManager.IGN_AERIAL &&
                <ImageryLayer imageryProvider={new WebMapTileServiceImageryProvider({
                                                                                        url:   'https://data.geopf.fr/wmts',
                                                                                        layer: 'ORTHOIMAGERY.ORTHOPHOTOS.ORTHO-EXPRESS.2024',
                    style: 'normal',
                    format: 'image/jpeg',
                    tileMatrixSetID: 'PM',
                    service: 'WMTS',
                })}/>
            }

            {
                snapshot.current === LayerManager.IGN_CADASTRAL &&
                <ImageryLayer imageryProvider={new WebMapTileServiceImageryProvider({
                                                                                        url: 'https://data.geopf.fr/wmts',
                    layer: 'CADASTRALPARCELS.PARCELLAIRE_EXPRESS',
                    style: 'normal',
                    format: 'image/png',
                    tileMatrixSetID: 'PM',
                })}/>
            }

        </>
    )
}
