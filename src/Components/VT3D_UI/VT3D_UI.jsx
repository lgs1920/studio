import './style.css'
import { forwardRef, useEffect } from 'react'
import { useCesium }             from 'resium'
import { CanvasEvents }          from '../../../core/events/CanvasEvents'
import { CameraPositionUI }      from '../../cesium/CameraPositionUI/CameraPositionUI'
import { CompassUI }             from '../../cesium/CompassUI/CompassUI'
import { CreditsUI }             from '../CreditsUI/CreditsUI'
import { FloatingMenu }          from '../FloatingMenu/FloatingMenu'
import { FullScreenUI }          from '../FullScreenUI/FullScreenUI'
import { TrackFileLoaderUI }     from '../TrackFileLoaderUI/TrackFileLoaderUI'
import { TracksEditor }          from '../TracksEditor/TracksEditor'


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
                    <TrackFileLoaderUI ref={ref}/>
                    <TracksEditor ref={ref}/>
                </div>
                <div id={'bottom-left-ui'}>
                    <FullScreenUI ref={ref}/>
                    <CreditsUI ref={ref}/>
                </div>
                <div id={'bottom-right-ui'}>
                    <CompassUI ref={ref}/>
                </div>

                <div id={'top-right-ui'}>
                </div>

                <FloatingMenu/>

            </div>
        </>
    )

})

