/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: GlobalSettings.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2024-11-18
 * Last modified: 2026-10-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { CameraSettings }      from '@Components/Settings/application/general/CameraSettings'
import { TileCacheSettings } from './TileCacheSettings'
import { JourneyStatisticsSettings } from '@Components/Settings/application/general/JourneyStatisticsSettings'
import { UnitsSystemSettings } from '@Components/Settings/application/general/UnitsSystemSettings'
import { WaDetails } from '@web.awesome.me/webawesome-pro/dist/react'
import { memo, useRef } from 'react'

/** Render general application preferences, including the local tile cache budget. */
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

            <WaDetails id="tile-cache-settings-details" small name="global-settings" className="lgs--details-hoverable">
                <TileCacheSettings/>
            </WaDetails>

        </div>

    )
})

GlobalSettings.displayName = 'GlobalSettings'
