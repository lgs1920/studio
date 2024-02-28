import './style.css'
import { forwardRef }        from 'react'
import { useCesium }         from 'resium'
import { CameraPositionUI }  from '../../cesium/CameraPositionUI/CameraPositionUI'
import { CompassUI }         from '../../cesium/CompassUI/CompassUI'
import { CreditsUI }         from '../CreditsUI/CreditsUI'
import { TrackFileLoaderUI } from '../TrackFileLoaderUI/TrackFileLoaderUI'
import { TracksEditor }      from '../TracksEditor/TracksEditor'

export const VT3D_UI = forwardRef(function VT3D_UI(props, ref) {
    vt3d.viewer = useCesium().viewer

    return (
        <>
            <div id="vt3d-main-ui" className={'ui'} ref={ref}>
                <CameraPositionUI ref={ref}/>
                <TrackFileLoaderUI ref={ref}/>
                <CompassUI ref={ref}/>
                <CreditsUI ref={ref}/>
                <TracksEditor ref={ref}/>

            </div>
        </>
    )

})

