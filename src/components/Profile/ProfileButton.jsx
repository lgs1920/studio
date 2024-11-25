import { faChartLine }                 from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import './style.css'
import { FA2SL }                       from '@Utils/FA2SL'
import { forwardRef }                  from 'react'
import { useSnapshot }                 from 'valtio'
import { TrackUtils }                  from '../../Utils/cesium/TrackUtils'
//read version


export const ProfileButton = forwardRef(function ProfileButton(props, ref) {

    const mainStore = lgs.mainProxy
    const mainSnap = useSnapshot(mainStore)

    const toggleProfileButton = (event) => {
        mainStore.components.profile.show = !mainStore.components.profile.show
    }

    TrackUtils.setProfileVisibility(lgs.theJourney)

    console.log(mainSnap.canViewProfile)
    return (<>
        {mainSnap.canViewProfile &&
            <SlTooltip hoist placement={props.tooltip} content="Open Profile">
                {<SlButton size={'small'} className={'square-icon'} id={'open-the-profile-panel'}
                           onClick={toggleProfileButton}
                           key={mainSnap.components.profile.key}>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faChartLine)}></SlIcon>
                </SlButton>}
            </SlTooltip>
        }
    </>)
})
