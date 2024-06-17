import './style.css'
import { faLocationPlus } from '@fortawesome/pro-regular-svg-icons'

import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { TrackUtils }                  from '@Utils/cesium/TrackUtils'
import { FA2SL }                       from '@Utils/FA2SL'

export const JourneyLoader = (props) => {

    return (
        <>
            <SlTooltip hoist placement={props.tooltip} content="Add a new Journey">
                <SlButton size={'small'} onClick={TrackUtils.uploadJourneyFile} className={'square-icon'}>
                    <SlIcon library="fa" name={FA2SL.set(faLocationPlus)}/>
                </SlButton>
            </SlTooltip>
        </>
    )

}

