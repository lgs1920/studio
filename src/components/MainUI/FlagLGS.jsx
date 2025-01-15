import { useSnapshot } from 'valtio'
import { POI }         from '../cesium/POI'

export const FlagLGS = (props) => {
    const welcome = useSnapshot(lgs.mainProxy.components.welcome)
    return (

        <>
            {__.ui.sceneManager.is3D && !welcome.modal && welcome.flag &&
                <POI id="flagLGS"
                     point={{
                         longitude: lgs.settings.starter.longitude,
                         latitude:  lgs.settings.starter.latitude,
                         elevation: lgs.settings.starter.height,
                         title:     'La Grande Sure',
                         color: lgs.settings.ui.poi.lgsColor,
                     }}
                />

            }

        </>
    )

}