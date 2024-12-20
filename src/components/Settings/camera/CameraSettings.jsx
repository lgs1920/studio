import { faArrowsToCircle }                       from '@fortawesome/pro-regular-svg-icons'
import { SlDetails, SlDivider, SlIcon, SlSwitch } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                  from '@Utils/FA2SL'
import React                                      from 'react'

export const CameraSettings = () => {

    const switchValue = (event) => {
        if (window.isOK(event)) {
            return event.target.checked
        }
    }

    return (
        <SlDetails id={'ui-camera-settings'}
                   small open={false}
                   key={'ui-camera-settings'}
                   className={'lgs-theme'}
        >
            <span slot="summary">{'Camera Information'}</span>
            <SlDivider/>


            <SlSwitch size="small" align-right checked={lgs.settings.ui.camera.showPosition}
                      onSlChange={(event) => lgs.settings.ui.camera.showPosition = switchValue(event)}>
                Show Camera Position
                <span slot="help-text">{'Longitude, Latitude, Altitude'}</span>
            </SlSwitch>

            <SlSwitch size="small" align-right checked={lgs.settings.ui.camera.showHPR}
                      onSlChange={(event) => lgs.settings.ui.camera.showHPR = switchValue(event)}>
                Show Camera HPR
                <span slot="help-text">{'Different angles (head, pitch Range)'}</span>
            </SlSwitch>
            <SlDivider/>
            <SlSwitch size="small" align-right checked={lgs.settings.ui.camera.showTargetPosition}
                      onSlChange={(event) => lgs.settings.ui.camera.showTargetPosition = switchValue(event)}>
                Show Camera Target Position
                <span slot="help-text">Marked with<SlIcon library="fa" name={FA2SL.set(faArrowsToCircle)}/></span>
            </SlSwitch>

            <SlSwitch size="small" align-right checked={lgs.settings.ui.camera.targetIcon.show}
                      onSlChange={(event) => lgs.settings.ui.camera.targetIcon.show = switchValue(event)}>
                Show Camera Target Icon
                <span slot="help-text">Marked with<SlIcon library="fa" name={FA2SL.set(faArrowsToCircle)}/></span>
            </SlSwitch>


        </SlDetails>
    )
}