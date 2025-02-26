/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: UnitsSystem.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-02-26
 * Last modified: 2025-02-26
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { SlDivider, SlRadioButton, SlRadioGroup } from '@shoelace-style/shoelace/dist/react'
import { DD, DMS, IMPERIAL, INTERNATIONAL }       from '@Utils/UnitUtils'
import { useSnapshot }                            from 'valtio/index'

export const UnitsSystem = (props) => {

    const switchValue = (event) => {
        if (window.isOK(event)) {
            return event.target.checked
        }
    }

    const us = useSnapshot(lgs.settings.unitSystem)
    const cs = useSnapshot(lgs.settings.coordinateSystem)

    const handleDistanceUnits = (event) => {
        lgs.settings.unitSystem.current = event.target.value * 1
    }
    const handleCoordinateUnits = (event) => {
        lgs.settings.coordinateSystem.current = event.target.value * 1
    }

    return (
        <>
            <span slot="summary">{'Units System'}</span>
            <SlDivider/>
            <div className="horizontal-alignment two-columns">
                <SlRadioGroup value={us.current} align-right
                              size={'small'} onSlChange={handleDistanceUnits}
                >
                    <label slot="label">{'Distance Units:'}</label>
                    <SlRadioButton value={INTERNATIONAL}>{'Metric'}</SlRadioButton>
                    <SlRadioButton value={IMPERIAL}>{'Impérial'}</SlRadioButton>
                </SlRadioGroup>
            </div>
            <div className="horizontal-alignment two-columns">
                <SlRadioGroup value={cs.current} align-right
                              size={'small'} onSlChange={handleCoordinateUnits}
                >
                    <label slot="label">{'Coordinate Units:'}</label>
                    <SlRadioButton value={DD}>{'Digital Degres'}</SlRadioButton>
                    <SlRadioButton value={DMS}>{'Degres Minutes Seconds'}</SlRadioButton>
                </SlRadioGroup>
            </div>

        </>
    )
}