import { faChartLine }                 from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import './style.css'
import { TrackUtils }                  from '@Utils/cesium/TrackUtils'
import { FA2SL }                       from '@Utils/FA2SL'
import { useSnapshot }                 from 'valtio'
//read version


export const ProfileButton = (props) => {

    const mainStore = lgs.mainProxy
    const mainSnap = useSnapshot(mainStore)

    const toggleProfileButton = (event) => {
        mainStore.components.profile.show = !mainStore.components.profile.show
    }

    TrackUtils.setProfileVisibility(lgs.theJourney)

    return (<>
        {mainSnap.canViewProfile &&
            <SlTooltip hoist placement={props.tooltip} content="Open the current journey profile">
                {<SlButton size={'small'} className={'square-button'} id={'open-the-profile-panel'}
                           onClick={toggleProfileButton}
                           key={mainSnap.components.profile.key}>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faChartLine)}></SlIcon>
                </SlButton>}
            </SlTooltip>
        }
    </>)
}
