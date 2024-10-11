import './style.css'
import { TextValueUI } from '@Components/TextValueUI/TextValueUI.jsx'

import { faAngle, faArrowsToCircle, faMountains, faVideo } from '@fortawesome/pro-regular-svg-icons'
import { SlAnimation }                                     from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                           from '@Utils/FA2SL'
import { useCesium }                                       from 'resium'
import { proxy, useSnapshot }                              from 'valtio'
import { meter, mile }                                     from '../../../Utils/UnitUtils'


export const CameraAndTargetPanel = () => {
    lgs.viewer = useCesium().viewer

    const camera = useSnapshot(lgs.mainProxy.components.camera)
    const ui = useSnapshot(proxy(lgs.configuration.ui))

    return (
        <div id={'camera-and-target-position-panel'}>
            {ui.showCameraTargetPosition && !__.ui.cameraManager.isLookingAtTheSky(camera.target) &&
                <SlAnimation size="small" easing="bounceInLeft" duration={1000} iterations={1}
                             play={ui.showCameraTargetPosition}>
                    <div className="camera-data-panel lgs-card on-map">
                        <sl-icon library="fa" name={FA2SL.set(faArrowsToCircle)}></sl-icon>
                        <div>
                            <TextValueUI value={camera.target.longitude?.toFixed(5)}
                                         className={'camera-longitude'}
                                         text={'Lon:'}/>
                            <TextValueUI value={camera.target.latitude?.toFixed(5)}
                                         className={'camera-latitude'}
                                         text={'Lat:'}/>
                            {/* hide elevation as it is not precise enough. TODO fix this  */}
                            {/* <sl-icon library="fa" name={FA2SL.set(faMountains)}></sl-icon> */}
                            {/* <TextValueUI value={camera.target.height?.toFixed()} */}
                            {/*              className={'camera-altitude'} */}
                            {/*              units={[meter, mile]}/> */}
                        </div>
                    </div>
                </SlAnimation>
            }

            {ui.showCameraPosition &&
                <SlAnimation size="small" easing="bounceInLeft" duration={1000} iterations={1}
                             play={ui.showCameraPosition}>
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
            {ui.showCameraHPR &&
                <SlAnimation size="small" easing="bounceInLeft" duration={1000} iterations={1} play={ui.showCameraHPR}>
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
        </div>
    )
}

