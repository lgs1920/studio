import { SCENE_MODE_3D }               from '@Core/constants'
import { faArrowsToCircle }            from '@fortawesome/pro-regular-svg-icons'
import { SlDivider, SlIcon, SlSwitch } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                       from '@Utils/FA2SL'
import { useRef }                      from 'react'
import { useSnapshot }                 from 'valtio/index'

export const CameraSettings = (props) => {

    const switchValue = (event) => {
        if (window.isOK(event)) {
            return event.target.checked
        }
    }

    const camera = useSnapshot(lgs.editorSettingsProxy.camera)
    const targetPosition = useRef(null)
    lgs.editorSettingsProxy.camera.showTargetPosition = lgs.settings.ui.camera.showTargetPosition

    return (
        <>
            <span slot="summary">{'Camera Information'}</span>
            <SlDivider/>

            {useSnapshot(lgs.settings.scene.mode).value * 1 === SCENE_MODE_3D.value &&
                <>
                    <SlSwitch size="small" align-right checked={lgs.settings.ui.camera.showPosition}
                              onSlChange={(event) => lgs.settings.ui.camera.showPosition = switchValue(event)}>
                        {'Show Camera Position'}
                        <span slot="help-text">{'Longitude, Latitude, Altitude'}</span>
                    </SlSwitch>

                    <SlSwitch size="small" align-right checked={lgs.settings.ui.camera.showHPR}
                              onSlChange={(event) => lgs.settings.ui.camera.showHPR = switchValue(event)}>
                        {'Show Camera HPR'}
                        <span slot="help-text">{'Head, Pitch, Roll'}</span>
                    </SlSwitch>
                    <SlDivider/>
                </>
            }


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
                {'Show Camera Target Marker'}
                <span slot="help-text">Marked with<SlIcon library="fa" name={FA2SL.set(faArrowsToCircle)}/></span>
            </SlSwitch>


            <SlSwitch size="small" align-right checked={camera.showTargetPosition} ref={targetPosition}
                      onSlChange={(event) => lgs.settings.ui.camera.showTargetPosition = switchValue(event)}>
                {'Show Camera Target Position'}
                <span slot="help-text">Marked with<SlIcon library="fa" name={FA2SL.set(faArrowsToCircle)}/></span>
            </SlSwitch>

        </>
    )
}