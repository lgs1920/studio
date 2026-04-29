/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CompassSettings.jsx
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

import { CompassFull }                                                from '@Components/MainUI/compass/CompassFull'
import { CompassLight }                     from '@Components/MainUI/compass/CompassLight'
import { CompassWindRose }                                            from '@Components/MainUI/compass/CompassWindRose'
import { COMPASS_FULL, COMPASS_LIGHT, COMPASS_WIND_ROSE, NO_COMPASS } from '@Core/constants'
import { WaDivider, WaIcon, WaOption, WaSelect }                      from '@web.awesome.me/webawesome-pro/dist/react'
import { useSnapshot }                      from 'valtio'

export const CompassSettings = () => {

    const settings = useSnapshot(lgs.settings.ui.compass)

    const setCompassMode = (event) => {
        const mode = Number(event.target.value)
        lgs.settings.ui.compass.mode = Number.isFinite(mode) ? mode : event.target.value
    }
    return (
        <>
            <span slot="summary">{'Compass Settings'}</span>
            <WaDivider/>
            <div className="compass-settings">
                <WaSelect id="compass-selector-settings"
                          size="small"
                          name="compassSelector"
                          label="Select a compass"
                          label-at-start
                          value={settings.mode.toString()}
                          onChange={setCompassMode}>
                    <WaIcon slot="start" size="small" variant="regular" name="compass"/>
                    <WaOption value={NO_COMPASS.toString()} label="None">{'None'}</WaOption>
                    <WaOption value={COMPASS_FULL.toString()} label="Full">
                        <span slot="start" className="compass-select-thumbnail">
                            <CompassFull width="24" height="24"/>
                        </span>
                        {'Full'}
                    </WaOption>
                    <WaOption value={COMPASS_LIGHT.toString()} label="Light">
                        <span slot="start" className="compass-select-thumbnail">
                            <CompassLight width="24" height="24"/>
                        </span>
                        {'Light'}
                    </WaOption>
                    <WaOption value={COMPASS_WIND_ROSE.toString()} label="Rose">
                        <span slot="start" className="compass-select-thumbnail">
                            <CompassWindRose width="24" height="24"/>
                        </span>
                        {'Rose'}
                    </WaOption>
                </WaSelect>
            </div>
        </>
    )
}
