import { faUserGear }               from '@fortawesome/pro-regular-svg-icons'
import { SlDetails, SlIcon }        from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                    from '@Utils/FA2SL'
import React, { useEffect, useRef } from 'react'
import { RemoveProfile }            from './RemoveProfile'
import { ResetProfile }             from './ResetProfile'

export const ProfileTools = () => {

    const profileDetails = useRef(null)
    useEffect(() => {
        __.ui.ui.initDetailsGroup(profileDetails.current)
    }, [])
    return (
        <SlDetails small key={'tools-profile'} className={'lgs-theme'} ref={profileDetails}>
            <span slot="summary">
                <SlIcon library="fa" name={FA2SL.set(faUserGear)}/> {'My Profile'}
            </span>
            <ResetProfile/>
            <RemoveProfile/>
        </SlDetails>

    )
}