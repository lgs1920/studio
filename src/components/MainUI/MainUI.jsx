import { CameraPositionUI }       from '@Components/cesium/CameraPositionUI/CameraPositionUI'
import { CompassUI }              from '@Components/cesium/CompassUI/CompassUI'
import { CreditsUI }              from '@Components/CreditsUI/CreditsUI'
import { FullScreenUI }           from '@Components/FullScreenUI/FullScreenUI'
import { Profile }                from '@Components/Profile/Profile'
import { TracksEditor }           from '@Components/TracksEditor/TracksEditor'
import { Toolbar }                from '@Components/MainUI/Toolbar'
import { forwardRef, useEffect }  from 'react'
import { useCesium }              from 'resium'

import './style.css'
import { CameraTargetPositionUI } from '../cesium/CameraPositionUI/CameraTargetPositionUI.jsx'

export const MainUI = forwardRef(function VT3D_UI(props, ref) {

    lgs.viewer = useCesium().viewer

    useEffect(() => {

        // Manage canvas related events
        // CanvasEvents.attach()
        // CanvasEvents.addListeners()

    }, [])


    return (
        <>
            <div id="lgs-main-ui" ref={ref}>
                <div id={'top-left-ui'}>
                    <CameraPositionUI ref={ref}/>
                    <CameraTargetPositionUI ref={ref}/>

                    <Toolbar editor={true}
                             profile={true}
                             fileLoader={true}
                             position={'vertical'}
                             tooltip={'right'}/>
                    <TracksEditor/>
                </div>

                <div id={'bottom-ui'}>
                    <div id={'bottom-left-ui'}>
                        <FullScreenUI ref={ref}/>
                        <CreditsUI ref={ref}/>
                    </div>
                    <div id={'profile-ui'}>
                        <Profile ref={ref}/>
                    </div>
                    <div id={'bottom-right-ui'}>

                    </div>
                </div>
                <div id={'top-right-ui'}>
                    <CompassUI ref={ref} scene={lgs.scene}/>
                </div>

                {/* <FloatingMenu/> */}

            </div>
        </>
    )

})

