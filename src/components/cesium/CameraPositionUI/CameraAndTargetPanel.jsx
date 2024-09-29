import './style.css'
import { proxy, useSnapshot }     from 'valtio'
import { CameraPositionUI }       from './CameraPositionUI'
import { CameraTargetPositionUI } from './CameraTargetPositionUI'


export const CameraAndTargetPanel = () => {

    const ui = useSnapshot(proxy(lgs.configuration.ui))

    return (
        <>
            {
                (ui.showCameraPosition || ui.showCameraTargetPosition) &&
                <div id={'camera-and-target-position-panel'}>
                    {ui.showCameraPosition &&
                        <CameraPositionUI/>
                    }
                    {ui.showCameraTargetPosition &&
                        <CameraTargetPositionUI/>
                    }
                </div>
            }
        </>
    )
}

