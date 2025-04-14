/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CameraAndTargetPanel.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-02-27
 * Last modified: 2025-02-27
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import './style.css'
import { NameValueUnit } from '@Components/DataDisplay/NameValueUnit.jsx'
import { APP_EVENT }               from '@Core/constants'

import { faAngle, faArrowsToCircle, faMountains, faVideo } from '@fortawesome/pro-regular-svg-icons'
import { SlAnimation }                                     from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                           from '@Utils/FA2SL'
import { meter, mile }             from '@Utils/UnitUtils'
import { useLayoutEffect, useRef } from 'react'
import { proxy, useSnapshot }      from 'valtio'


export const CameraAndTargetPanel = () => {

    const camera = useSnapshot(lgs.mainProxy.components.camera)
    const ui = useSnapshot(proxy(lgs.settings.ui))
    const _panel = useRef(null)

    useLayoutEffect(() => {
        window.addEventListener(APP_EVENT.WELCOME.HIDE, () => {
            _panel.current.style.opacity = 1
        })
    }, [])
    return (
        <div id={'camera-and-target-position-panel'} ref={_panel}>
            {ui.camera.showTargetPosition && !__.ui.cameraManager.lookingAtTheSky(camera.target) &&
                <SlAnimation size="small" easing="bounceInLeft" duration={1000} iterations={1}
                             play={ui.camera.showTargetPosition}>
                    <div className="camera-data-panel lgs-card on-map">
                        <sl-icon library="fa" name={FA2SL.set(faArrowsToCircle)}></sl-icon>
                        <div>
                            {__.convert(camera.target.latitude).to(lgs.settings.coordinateSystem.current)},&nbsp;
                            {__.convert(camera.target.longitude).to(lgs.settings.coordinateSystem.current)}
                            <sl-icon library="fa" name={FA2SL.set(faMountains)}></sl-icon>
                            <NameValueUnit value={camera.target.height?.toFixed()}
                                           className={'camera-altitude'}
                                           units={[meter, mile]}/>
                            {__.ui.sceneManager.is2D &&
                                <>
                                    <sl-icon library="fa" name={FA2SL.set(faVideo)}></sl-icon>
                                    <NameValueUnit value={camera.position?.height?.toFixed()}
                                                   className={'camera-altitude'}
                                                   units={[meter, mile]}/>
                                </>
                            }
                        </div>
                    </div>
                </SlAnimation>
            }
            {!__.ui.sceneManager.is2D &&
                <>
                    {ui.camera.showPosition &&
                        <SlAnimation size="small" easing="bounceInLeft" duration={1000} iterations={1}
                                     play={ui.camera.showPosition}>
                            <div className="camera-data-panel lgs-card on-map">
                                <sl-icon library="fa" name={FA2SL.set(faVideo)}></sl-icon>
                                <div>
                                    {__.convert(camera.position?.latitude).to(lgs.settings.coordinateSystem.current)},&nbsp;
                                    {__.convert(camera.position?.longitude).to(lgs.settings.coordinateSystem.current)}
                                    <sl-icon library="fa" name={FA2SL.set(faMountains)}></sl-icon>
                                    <NameValueUnit value={camera.position?.height?.toFixed()}
                                                   className={'camera-altitude'}
                                                   units={[meter, mile]}/>
                                </div>
                            </div>
                        </SlAnimation>
                    }
                    {ui.camera.showHPR &&
                        <SlAnimation size="small" easing="bounceInLeft" duration={1000} iterations={1}
                                     play={ui.showHPR}>
                            <>
                                <div className="camera-data-panel lgs-card on-map">
                                    <sl-icon library="fa" name={FA2SL.set(faAngle)}></sl-icon>
                                    <div>
                                        <NameValueUnit value={camera.position.heading?.toFixed()}
                                                       className={'camera-heading'} text={'Heading:'} units={'°'}/>

                                        <NameValueUnit value={(camera.position?.pitch)?.toFixed()}
                                                       className={'camera-pitch'} text={'Pitch:'} units={'°'}/>

                                        <NameValueUnit value={(camera.position?.roll)?.toFixed()}
                                                       className={'camera-roll'} text={'Roll:'} units={'°'}/>
                                    </div>
                                </div>
                            </>
                        </SlAnimation>
                    }
                </>
            }
        </div>
    )
}

