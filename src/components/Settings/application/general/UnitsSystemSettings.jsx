/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: UnitsSystemSettings.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-14
 * Last modified: 2026-03-14
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { faGlobe, faRuler, faRulerCombined }      from '@fortawesome/pro-regular-svg-icons'
import { FontAwesomeIcon }                        from '@fortawesome/react-fontawesome'
import { DD, DMS, IMPERIAL, INTERNATIONAL }         from '@Utils/UnitUtils'
import { WaDivider, WaIcon, WaRadio, WaRadioGroup } from '@web.awesome.me/webawesome-pro/dist/react'
import { useSnapshot }                              from 'valtio/index'

export const UnitsSystemSettings = (props) => {

    const us = useSnapshot(lgs.settings.unitSystem)
    const cs = useSnapshot(lgs.settings.coordinateSystem)

    const handleDistanceUnits = (event) => {
        lgs.settings.unitSystem.current = parseInt(event.target.value, 10)
        __.ui.profiler?.draw()
    }
    const handleCoordinateUnits = (event) => {
        lgs.settings.coordinateSystem.current = event.target.value
    }

    return (
        <>
            <span slot="summary"><WaIcon name="ruler" variant="regular"/> {'Units System'}</span>
            <WaDivider/>
            <div className="drawer-horizontal-line">
                <WaRadioGroup value={us.current}
                              label-at-start
                              orientation="horizontal"
                              size="xsmall"
                              onChange={handleDistanceUnits}
                >
                    <label slot="label">{'Distances/Elevations:'}</label>
                    <WaRadio value={INTERNATIONAL.toString()}>{'Metric'}</WaRadio>
                    <WaRadio value={IMPERIAL.toString()}>{'Impérial'}</WaRadio>
                </WaRadioGroup>
            </div>

            <div className="drawer-horizontal-line">
                <WaRadioGroup value={cs.current}
                              label-at-start
                              orientation="horizontal"
                              className="label-at-start"
                              size={'xsmall'}
                              onChange={handleCoordinateUnits}
                >
                    <label slot="label">{'Coordinates:'}</label>
                    <WaRadio value={DD}>{'DD (decimal)'}</WaRadio>
                    <WaRadio value={DMS}>{'DMS (sexagesimal)'}</WaRadio>
                </WaRadioGroup>
            </div>

        </>
    )
}
