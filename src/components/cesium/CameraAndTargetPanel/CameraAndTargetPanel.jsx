import './style.css'
import { TextValueUI } from '@Components/TextValueUI/TextValueUI.jsx'

import { faAngle, faArrowsToCircle, faMountains, faVideo } from '@fortawesome/pro-regular-svg-icons'
import { SlAnimation }                                     from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                           from '@Utils/FA2SL'
import { meter, mile }                                     from '@Utils/UnitUtils'
import { proxy, useSnapshot }                              from 'valtio'


export const CameraAndTargetPanel = () => {
    //  lgs.viewer = useCesium().viewer

    const camera = useSnapshot(lgs.mainProxy.components.camera)
    const ui = useSnapshot(proxy(lgs.settings.ui))
    return (
        <div id={'camera-and-target-position-panel'}>
            {ui.camera.showTargetPosition && !__.ui.cameraManager.lookingAtTheSky(camera.target) &&
                <SlAnimation size="small" easing="bounceInLeft" duration={1000} iterations={1}
                             play={ui.camera.showTargetPosition}>
                    <div className="camera-data-panel lgs-card on-map">
                        <sl-icon library="fa" name={FA2SL.set(faArrowsToCircle)}></sl-icon>
                        <div>
                            <TextValueUI value={camera.target.longitude?.toFixed(5)}
                                         className={'camera-longitude'}
                                         text={'Lon:'}/>
                            <TextValueUI value={camera.target.latitude?.toFixed(5)}
                                         className={'camera-latitude'}
                                         text={'Lat:'}/>
                            <sl-icon library="fa" name={FA2SL.set(faMountains)}></sl-icon>
                            <TextValueUI value={camera.target.height?.toFixed()}
                                         className={'camera-altitude'}
                                         units={[meter, mile]}/>
                            {__.ui.sceneManager.is2D &&
                                <>
                                    <sl-icon library="fa" name={FA2SL.set(faVideo)}></sl-icon>
                                    <TextValueUI value={camera.position?.height?.toFixed()}
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
                                    <TextValueUI value={camera.position.longitude?.toFixed(5)}
                                                 className={'camera-longitude'}
                                                 text={'Lon:'}/>
                                    <TextValueUI value={camera.position.latitude?.toFixed(5)}
                                                 className={'camera-latitude'}
                                                 text={'Lat:'}/>
                                    <sl-icon library="fa" name={FA2SL.set(faMountains)}></sl-icon>
                                    <TextValueUI value={camera.position?.height?.toFixed()}
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
                                        <TextValueUI value={camera.position.heading?.toFixed()}
                                                     className={'camera-heading'} text={'Heading:'} units={'°'}/>

                                        <TextValueUI value={(camera.position?.pitch)?.toFixed()}
                                                     className={'camera-pitch'} text={'Pitch:'} units={'°'}/>

                                        <TextValueUI value={(camera.position?.roll)?.toFixed()}
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

