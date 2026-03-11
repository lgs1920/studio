/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CompassSettings.jsx
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

import { CompassFull }  from '@Components/MainUI/compass/CompassFull'
import { CompassLight }                     from '@Components/MainUI/compass/CompassLight'
import { WaDivider, WaRadio, WaRadioGroup } from '@web.awesome.me/webawesome-pro/dist/react'
import { useSnapshot }                      from 'valtio'

export const CompassSettings = (props) => {

    const settings = useSnapshot(lgs.settings.ui.compass)

    const setCompassMode = (event) => {
        lgs.settings.ui.compass.mode = event.target.value
    }
    return (
        <>
            <span slot="summary">{'Compass Settings'}</span>
            <WaDivider/>
            <div className="compass-settings">
                <WaRadioGroup id="compass-selector-settings"
                              size="xsmall"
                              name="compassSelector"
                              label-at-start
                              orientation="horizontal"
                              appearance="button"
                              value={settings.mode.toString()}
                              onChange={setCompassMode}>
                    <span slot="label">{'Select a compass'}</span>
                    <WaRadio value="0">{'None'}</WaRadio>
                    <WaRadio value="1"><CompassFull width="30" height="30"/></WaRadio>
                    <WaRadio value="2" restrict-margin="true"><CompassLight height="30" width="30"/></WaRadio>
                </WaRadioGroup>
            </div>
        </>
    )
}