import { CompassUI }                        from '@Components/cesium/CompassUI/CompassUI'
import { FullScreenButton }                 from '@Components/FullScreenButton/FullScreenButton'
import { Toolbar }                          from '@Components/MainUI/Toolbar'
import { Profile }                          from '@Components/Profile/Profile'
import { TracksEditor }                     from '@Components/TracksEditor/TracksEditor'
import { useEffect }                        from 'react'
import { useCesium }                        from 'resium'

import './style.css'
import { subscribe }                        from 'valtio'
import { CanvasEvents }                     from '../../core/events/CanvasEvents.js'
import { CameraAndTargetPanel }             from '../cesium/CameraAndTargetPanel/CameraAndTargetPanel'
import { JourneyLoaderUI }                  from '../FileLoader/JourneyLoaderUI'
import { Panel as InformationPanel }        from '../InformationPanel/Panel'
import { PanelButton as InformationButton } from '../InformationPanel/PanelButton'
import { Panel as LayersPanel }             from '../SettingsPanel/layers/Panel'
import { PanelButton as LayersButton }      from '../SettingsPanel/LayersButton'
import { Panel as SettingsPanel }           from '../SettingsPanel/Panel'
import { PanelButton as SettingsButton }    from '../SettingsPanel/PanelButton'

import { Utils }           from '../TracksEditor/Utils.js'
import { CameraTarget }    from './CameraTarget'
import { StudioLogo }      from './StudioLogo'
import { SupportUI }       from './SupportUI'
import { SupportUIButton } from './SupportUIButton'

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
                    <SettingsButton tooltip={'right'}/>
                    <LayersButton tooltip={'right'}/>

                    <Toolbar editor={true}
                             profile={true}
                             fileLoader={true}
                             position={'vertical'}
                             tooltip={'right'}/>
                    <InformationButton/>
                    <SupportUIButton/>
                    <FullScreenButton/>
                </div>

                <div id={'bottom-ui'}>
                    <div id={'bottom-left-ui'}>
                        {
                            lgs.platform !== 'production' &&
                            <div id="used-platform"
                                 className={'lgs-card on-map'}> [{lgs.platform}-{lgs.versions.studio}]</div>
                        }
                    </div>
                    <div id={'profile-ui'}>
                        <Profile/>
                    </div>
                    <div id={'bottom-right-ui'}>
                        <StudioLogo xsmall width={'50px'}/>
                    </div>
                    {/* <div id={'bottom-right-ui'}></div> */}
                </div>
                <div id={'top-right-ui'}>
                    <CompassUI scene={lgs.scene}/>
                </div>

                {/* <FloatingMenu/> */}
                    </>


                <InformationPanel/>
                <SettingsPanel/>
                <LayersPanel/>
                <TracksEditor/>
                <CameraAndTargetPanel/>
            </div>

            <CameraTarget/>
            <SupportUI/>
            <JourneyLoaderUI multiple/>

        </>
    )
}

