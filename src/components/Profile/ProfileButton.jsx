import { faChartLine }                 from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import './style.css'
import { FA2SL }                       from '@Utils/FA2SL'
import { forwardRef }                  from 'react'
import { useSnapshot }                 from 'valtio'
//read version


export const ProfileButton = forwardRef(function ProfileButton(props, ref) {

    const mainStore = vt3d.mainProxy
    const mainSnap = useSnapshot(mainStore)

    const toggleProfileButton = (event) => {
        mainStore.components.profile.show = !mainStore.components.profile.show
    }

    return (<>
        {mainSnap.canViewJourneyData &&
            <SlTooltip placement={'right'} content="Open Profile">
                {<SlButton size={'small'} className={'square-icon'} id={'open-the-profile-panel'}
                           onClick={toggleProfileButton}>
                    <SlIcon library="fa" name={FA2SL.set(faChartLine)}></SlIcon>
                </SlButton>}
            </SlTooltip>
        }
    </>)
})
