/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileButton.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-30
 * Last modified: 2025-06-29
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

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
            <SlTooltip hoist placement={props.tooltip} content="Open the journey profile">
                {<SlButton size={'small'} className={'square-button'} id={'open-the-profile-panel'}
                           onClick={toggleProfileButton}
                           key={mainSnap.components.profile.key}>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faChartLine)}></SlIcon>
                </SlButton>}
            </SlTooltip>
        }
    </>)
}
