import { STARTER_POI } from '@Core/constants'
import { useSnapshot } from 'valtio'
import { POI }         from '../cesium/POI'

export const StarterPOI = (props) => {
    const welcome = useSnapshot(lgs.mainProxy.components.welcome)

    const point = __.ui.poiManager.add({
                                           longitude: lgs.settings.starter.longitude,
                                           latitude:  lgs.settings.starter.latitude,
                                           height: lgs.settings.starter.height,
                                           title:     lgs.settings.starter.name,
                                           color:  lgs.settings.starter.color,
                                           id:        STARTER_POI,
                                       })

    __.ui.poiManager.add(point)

    return (

        <>
            {__.ui.sceneManager.is3D && !welcome.modal && welcome.flag && !lgs.theJourney &&
                <POI point={point}/>
            }
        </>
    )

}