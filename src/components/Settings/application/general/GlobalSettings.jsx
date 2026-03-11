/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: GlobalSettings.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-11
 * Last modified: 2026-03-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { CameraSettings }      from '@Components/Settings/application/general/CameraSettings'
import { UnitsSystemSettings } from '@Components/Settings/application/general/UnitsSystemSettings'
import { SlDetails }           from '@shoelace-style/shoelace/dist/react'
import { WaDetails } from '@web.awesome.me/webawesome-pro/dist/react'
import { useEffect, useRef }   from 'react'

export const GlobalSettings = () => {
    const generalTools = useRef(null)

    useEffect(() => {
        __.ui.ui.initDetailsGroup(generalTools.current)
    }, [])


    return (

        <div ref={generalTools} id={'global-style-settings'} className={'lgs--details-list'}>
            <WaDetails id={'tools-unit-system'}
                       small open={false}
                       className={'lgs-theme'}
                       name="global-settings"
            >
                <UnitsSystemSettings/>
            </WaDetails>

            <WaDetails id={'ui-camera-settings'}
                       small open={false}
                       className={'lgs-theme'}
                       name="global-settings"
            >
                <CameraSettings/>
            </WaDetails>

        </div>

    )
}