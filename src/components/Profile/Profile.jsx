/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Profile.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-26
 * Last modified: 2025-12-26
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { SlDrawer }               from '@shoelace-style/shoelace/dist/react'
import './style.css'
import { useSnapshot }            from 'valtio'
import { useCallback, useEffect } from 'react'
import { CHART_ELEVATION_VS_DISTANCE } from '@Core/ui/Profiler'
import { ProfileChart }           from './ProfileChart'

/**
 * Component displaying the elevation profile drawer
 */
export const Profile = function Profile() {
    const $main = lgs.mainProxy
    const main = useSnapshot($main)
    const data = __.ui.profiler?.prepareData()
    useEffect(() => {
        // Sync visibility state with profiler service
        __.ui.profiler?.setVisibility()
    }, [$main.cabViewProfile, $main.components.profile.show])


    if (!main.canViewProfile || !main.components.profile.show) {
        return null
    }

    return (
        <>
            {data && (
                <div id={`profile-${CHART_ELEVATION_VS_DISTANCE}`}>
                    <ProfileChart data={data}/>
                </div>
            )}
        </>
    )
}