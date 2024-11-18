import { faUserGear }        from '@fortawesome/pro-regular-svg-icons'
import { SlDetails, SlIcon } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }             from '@Utils/FA2SL'
import React                 from 'react'
import { RemoveProfile }     from './RemoveProfile'
import { ResetProfile }      from './ResetProfile'

export const ProfileTools = () => {

    return (
        <SlDetails small key={'tools-general'} className={'lgs-theme'}>
            <span slot="summary">
                <SlIcon library="fa" name={FA2SL.set(faUserGear)}/> {'My Profile'}
            </span>
            <ResetProfile/>
            <RemoveProfile/>
        </SlDetails>

    )
}