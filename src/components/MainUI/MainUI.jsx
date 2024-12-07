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
import { Panel as LayersPanel }             from '../Settings/layers/Panel'
import { PanelButton as LayersButton }      from '../Settings/layers/PanelButton'
import { Panel as SettingsPanel }           from '../Settings/Panel'

import { Utils }           from '../TracksEditor/Utils.js'
import { CameraTarget }    from './CameraTarget'
import { CreditsBar }      from './credits/CreditsBar'
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
    subscribe(lgs.mainProxy.drawers, () => {
        const offset = (lgs.mainProxy.drawers.open === null) ? 0 : Utils.panelOffset()
        __.ui.css.setCSSVariable('--top-right-ui-right-margin', offset)
        __.ui.css.setCSSVariable('--lgs-horizontal-panel-width', `calc( 100% - ${offset})`)
    })

    return (
        <>
            <div id="lgs-main-ui">
                <div id={'top-left-ui'}>
                    {/* <SettingsButton tooltip={'right'}/> */}
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

                    <div id={'bottom-left-ui'}>
                        {
                            lgs.platform !== 'production' &&
                            <div id="used-platform"
                                 className={'lgs-card on-map'}> [{lgs.platform}-{lgs.versions.studio}]
                            </div>
                        }
                    </div>

                    <div id={'bottom-right-ui'}>
                        <CreditsBar/>
                    </div>

                <div id={'top-right-ui'}>
                    <CompassUI scene={lgs.scene}/>
                </div>

                {/* <FloatingMenu/> */}

                <Profile/>
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

