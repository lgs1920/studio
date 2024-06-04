import { CameraPositionUI }       from '@Components/cesium/CameraPositionUI/CameraPositionUI'
import { CompassUI }              from '@Components/cesium/CompassUI/CompassUI'
import { CreditsUI }              from '@Components/CreditsUI/CreditsUI'
import { FullScreenUI }           from '@Components/FullScreenUI/FullScreenUI'
import { Toolbar }                from '@Components/MainUI/Toolbar'
import { Profile }                from '@Components/Profile/Profile'
import { TracksEditor }           from '@Components/TracksEditor/TracksEditor'
import { useEffect }              from 'react'
import { useCesium }              from 'resium'

import './style.css'
import { subscribe, useSnapshot } from 'valtio'
import { CanvasEvents }           from '../../core/events/CanvasEvents.js'
import { CameraTargetPositionUI } from '../cesium/CameraPositionUI/CameraTargetPositionUI.jsx'
import { Utils }                  from '../TracksEditor/Utils.js'

export const MainUI = function VT3D_UI() {

    lgs.viewer = useCesium().viewer

    useEffect(() => {

        // Manage canvas related events
         CanvasEvents.attach()
        // CanvasEvents.addListeners()

    }, [])

    // We need to interact with  Editor
    subscribe(lgs.journeyEditorStore,() => {
        const offset = lgs.journeyEditorStore.show ? Utils.panelOffset() : 0
        __.ui.css.setCSSVariable('--top-right-ui-right-margin', offset)
    })

    return (
        <>
            <div id="lgs-main-ui">
                    <>
                <div id={'top-left-ui'}>
                    <CameraPositionUI/>
                    <CameraTargetPositionUI/>

                    <Toolbar editor={true}
                             profile={true}
                             fileLoader={true}
                             position={'vertical'}
                             tooltip={'right'}/>
                    <TracksEditor/>
                    <CreditsUI/>
                    <FullScreenUI/>
                </div>

                <div id={'bottom-ui'}>
                    {/* <div id={'bottom-left-ui'}></div> */}
                    <div id={'profile-ui'}>
                        <Profile/>
                    </div>
                    {/* <div id={'bottom-right-ui'}></div> */}
                </div>
                <div id={'top-right-ui'}>
                    <CompassUI scene={lgs.scene}/>
                </div>

                {/* <FloatingMenu/> */}
                    </>

            </div>


        </>
    )
}

