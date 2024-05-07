import { CameraPositionUI }      from '@Components/cesium/CameraPositionUI/CameraPositionUI'
import { CompassUI }             from '@Components/cesium/CompassUI/CompassUI'
import { CreditsUI }             from '@Components/CreditsUI/CreditsUI'
import { FloatingMenu }          from '@Components/FloatingMenu/FloatingMenu'
import { FullScreenUI }          from '@Components/FullScreenUI/FullScreenUI'
import { Profile }               from '@Components/Profile/Profile'
import { Toolbar }               from '@Components/VT3D_UI/Toolbar'
import { CanvasEvents }          from '@Core/events/CanvasEvents'
import { forwardRef, useEffect } from 'react'
import { useCesium }             from 'resium'

import './style.css'

export const VT3D_UI = forwardRef(function VT3D_UI(props, ref) {

    vt3d.viewer = useCesium().viewer

    useEffect(() => {

        // Manage canvas related events
        CanvasEvents.attach()
        CanvasEvents.addListeners()

    }, [])


    return (
        <>
            <div id="vt3d-main-ui" ref={ref}>
                <div id={'top-left-ui'}>
                    <CameraPositionUI ref={ref}/>
                    <Toolbar editor={true} profile={true} fileLoader={true} position={'vertical'}/>
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
                    <CompassUI ref={ref}/>
                </div>

                <FloatingMenu/>

            </div>
        </>
    )

})

