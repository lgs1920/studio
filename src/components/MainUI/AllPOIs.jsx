import { STARTER_POI } from '@Core/constants'
import { useSnapshot } from 'valtio'
import { POI }         from '../cesium/POI'

export const AllPOIs = (props) => {
    const list = useSnapshot(lgs.mainProxy.components.poi.list)


    return (

        <>
            {__.ui.sceneManager.is3D && Array.from(list.keys()).map((key) => (
                key !== STARTER_POI && (
                    <POI key={key} point={__.ui.poiManager.list.get(key)}/>
                )
            ))}
        </>
    )

}