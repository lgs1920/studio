/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MenuSettings.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-02-27
 * Last modified: 2025-02-27
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import {
    SlDivider, SlRadio, SlRadioButton, SlRadioGroup,
}                       from '@shoelace-style/shoelace/dist/react'
import { CompassFull }  from '@Components/cesium/CompassUI/CompassFull'
import { CompassLight } from '@Components/cesium/CompassUI/CompassLight'
import { useSnapshot }  from 'valtio'

export const CompassSettings = (props) => {

    const settings = useSnapshot(lgs.settings.ui.compass)

    const setCompassMode = (event) => {
        lgs.settings.ui.compass.mode = event.target.value
    }
    return (
        <>
            <span slot="summary">{'Compass Settings'}</span>
            <SlDivider/>
            <div className="compass-settings">
                <SlRadioGroup label="Select a compass" name="compassSelector" align={'right'}
                              value={settings.mode.toString()} onSlChange={setCompassMode}>
                    <SlRadio value="0">{'None'}</SlRadio>
                    <SlRadio value="1"><CompassFull width="30px" height="30px"/></SlRadio>
                    <SlRadio value="2" restrict-margin="true"><CompassLight width="30px" height="30px"/></SlRadio>
                </SlRadioGroup>
            </div>
        </>
    )
}