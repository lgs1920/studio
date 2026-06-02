/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: GlobalSettings.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-29
 * Last modified: 2026-04-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { CameraSettings }      from '@Components/Settings/application/general/CameraSettings'
import { JourneyStatisticsSettings } from '@Components/Settings/application/general/JourneyStatisticsSettings'
import { UnitsSystemSettings } from '@Components/Settings/application/general/UnitsSystemSettings'
import { WaDetails } from '@web.awesome.me/webawesome-pro/dist/react'
import { memo, useRef } from 'react'

export const GlobalSettings = memo(() => {
    const generalTools = useRef(null)

    return (

        <div ref={generalTools} id={'global-style-settings'} className={'lgs--details-list'}>
            <WaDetails id={'tools-unit-system'}
                       small
                       name="global-settings"
                       className="lgs--details-hoverable"
            >
                <UnitsSystemSettings/>
            </WaDetails>

            <WaDetails id={'ui-camera-settings'}
                       small
                       name="global-settings"
                       className="lgs--details-hoverable"
            >
                <CameraSettings/>
            </WaDetails>

            <WaDetails id={'journey-statistics-settings-details'}
                       small
                       name="global-settings"
                       className="lgs--details-hoverable"
            >
                <JourneyStatisticsSettings/>
            </WaDetails>

        </div>

    )
})

GlobalSettings.displayName = 'GlobalSettings'
