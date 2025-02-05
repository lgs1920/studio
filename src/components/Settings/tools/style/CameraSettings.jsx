import { FOCUS_CENTROID, FOCUS_LAST, FOCUS_STARTER, SCENE_MODE_3D } from '@Core/constants'
import { faArrowsToCircle }                                         from '@fortawesome/pro-regular-svg-icons'
import { SlDivider, SlIcon, SlRadio, SlRadioGroup, SlSwitch }       from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                    from '@Utils/FA2SL'
import React, { useRef }                                            from 'react'
import { useSnapshot }                                              from 'valtio/index'

export const CameraSettings = (props) => {

    const switchValue = (event) => {
        if (window.isOK(event)) {
            return event.target.checked
        }
    }

    const camera = useSnapshot(lgs.editorSettingsProxy.camera)
    const targetPosition = useRef(null)
    lgs.editorSettingsProxy.camera.showTargetPosition = lgs.settings.ui.camera.showTargetPosition

    const TabInfo = () => {
        return (
            <>
                {useSnapshot(lgs.settings.scene.mode).value * 1 === SCENE_MODE_3D.value &&
                    <>
                        <div className="horizontal-alignment">
                            <SlSwitch size="small" align-right checked={lgs.settings.ui.camera.showPosition}
                                      onSlChange={(event) => lgs.settings.ui.camera.showPosition = switchValue(event)}>
                                {'Show Position'}
                                <span slot="help-text">{'Longitude, Latitude, Altitude'}</span>
                            </SlSwitch>

                            <SlSwitch size="small" align-right checked={lgs.settings.ui.camera.showHPR}
                                      onSlChange={(event) => lgs.settings.ui.camera.showHPR = switchValue(event)}>
                                {'Show HPR'}
                                <span slot="help-text">{'Head, Pitch, Roll'}</span>
                            </SlSwitch>
                        </div>
                        <SlDivider/>
                    </>

                }

                <div className="horizontal-alignment">
                    <SlSwitch size="small" align-right checked={lgs.settings.ui.camera.targetIcon.show}
                              onSlChange={(event) => {
                                  lgs.settings.ui.camera.targetIcon.show = switchValue(event)
                                  if (!lgs.settings.ui.camera.targetIcon.show) {
                                      lgs.editorSettingsProxy.camera.showTargetPosition = false
                                      if (targetPosition.current.checked) {
                                          targetPosition.current.click()
                                      }
                                  }
                              }}>
                        {'Show Target Marker'}
                        <span slot="help-text">Marked with<SlIcon library="fa"
                                                                  name={FA2SL.set(faArrowsToCircle)}/></span>
                    </SlSwitch>


                    <SlSwitch size="small" align-right checked={camera.showTargetPosition} ref={targetPosition}
                              onSlChange={(event) => lgs.settings.ui.camera.showTargetPosition = switchValue(event)}>
                        {'Show Target Position'}
                        <span slot="help-text">Marked with<SlIcon library="fa"
                                                                  name={FA2SL.set(faArrowsToCircle)}/></span>
                    </SlSwitch>
                </div>
                <SlDivider/>
            </>
        )
    }

    const TabPosition = () => {
        return (
            <div className="horizontal-alignment two-columns">
                <SlRadioGroup value={lgs.settings.ui.camera.start.app}
                              size={'small'} onSlChange={handleStartFocus}
                >
                    <label slot="label">{'Start focus is on:'}</label>
                    <SlRadio value={FOCUS_STARTER}>{'Starter POI'}</SlRadio>
                    <SlRadio value={FOCUS_LAST}>{'Last Camera location'}</SlRadio>
                </SlRadioGroup>
                <SlRadioGroup value={lgs.settings.ui.camera.start.journey}
                              size={'small'}
                              onSlChange={handleJourneyFocus}>
                    <label slot="label">{'Journey focus is on:'}</label>
                    <SlRadio value={FOCUS_CENTROID}>{'Center'}</SlRadio>
                    <SlRadio value={FOCUS_LAST}>{'Last Camera location'}</SlRadio>
                </SlRadioGroup>
            </div>
        )
    }

    const handleStartFocus = (event) => {
        lgs.settings.ui.camera.start.app = event.srcElement.value
    }
    const handleJourneyFocus = (event) => {
        lgs.settings.ui.camera.start.journey = event.srcElement.value
    }


    return (
        <>
            <span slot="summary">{'Camera Settings'}</span>
            <SlDivider/>
            <TabInfo/>
            <TabPosition/>
        </>
    )
}