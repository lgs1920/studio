/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileTools.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-12
 * Last modified: 2026-03-12
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { faUserGear }               from '@fortawesome/pro-regular-svg-icons'
import { SlIcon }            from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                    from '@Utils/FA2SL'
import { WaDetails, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import React, { useEffect, useRef } from 'react'
import { RemoveProfile }            from './RemoveProfile'
import { ResetProfile }             from './ResetProfile'

export const ProfileTools = () => {

    const profileDetails = useRef(null)
    useEffect(() => {
        __.ui.ui.initDetailsGroup(profileDetails.current)
    }, [])
    return (
        <div className="lgs--details-list">

            <WaDetails small key={'tools-profile'} className={'lgs-theme'} ref={profileDetails} open>
            <span slot="summary">
                <WaIcon name="user-gear" variant={'regular'}/> {'My Profile'}
            </span>
                <ResetProfile/>
                <RemoveProfile/>
            </WaDetails>
        </div>

    )
}