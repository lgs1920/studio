import { faUserGear }        from '@fortawesome/pro-regular-svg-icons'
import { SlDetails, SlIcon } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }             from '@Utils/FA2SL'
import React                 from 'react'
import { RemoveAccount }     from './account/RemoveAccount'
import { ResetAccount }      from './account/ResetAccount'

export const Tools = () => {

    return (
        <SlDetails small key={'tools-database'} className={'lgs-theme'}>
            <span slot="summary">
                <SlIcon library="fa" name={FA2SL.set(faUserGear)}/> {'Your Account'}
            </span>
            <ResetAccount/>
            <RemoveAccount/>
        </SlDetails>

    )
}