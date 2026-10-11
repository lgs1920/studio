/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileTools.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2024-11-17
 * Last modified: 2026-10-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaDetails, WaIcon } from '@awesome.me/webawesome/dist/react'
import { useEffect, useRef } from 'react'
import { RemoveProfile } from './RemoveProfile'
import { ResetProfile } from './ResetProfile'
import { SyncMyProfile } from './SyncMyProfile'
import { LocalDbSettings } from '../../LocalDbSettings'

export const ProfileTools = () => {

    const profileDetails = useRef(null)
    useEffect(() => {
        __.ui.ui.initDetailsGroup(profileDetails.current)
    }, [])

    return (
        <div className="lgs--details-list">

            <WaDetails small key={'tools-profile'} className={'lgs--details-hoverable'} ref={profileDetails} open>
                <span slot="summary">
                <WaIcon name="user-gear" variant={'regular'}/> {'My Profile'}
                </span>
                <SyncMyProfile/>
                <LocalDbSettings/>
                <ResetProfile/>
                <RemoveProfile/>
            </WaDetails>
        </div>

    )
}
