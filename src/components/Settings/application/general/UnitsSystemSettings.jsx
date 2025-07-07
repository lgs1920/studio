/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: UnitsSystemSettings.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-04
 * Last modified: 2025-07-04
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { faGlobe, faRuler, faRulerCombined }      from '@fortawesome/pro-regular-svg-icons'
import { FontAwesomeIcon }                        from '@fortawesome/react-fontawesome'
import { SlDivider, SlRadioButton, SlRadioGroup } from '@shoelace-style/shoelace/dist/react'
import { DD, DMS, IMPERIAL, INTERNATIONAL }       from '@Utils/UnitUtils'
import { useSnapshot }                            from 'valtio/index'

export const UnitsSystemSettings = (props) => {

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
        lgs.settings.coordinateSystem.current = event.target.value
    }

    return (
        <>
            <span slot="summary"><FontAwesomeIcon icon={faRuler}/>{'Units System'}</span>
            <SlDivider/>
            <div className="horizontal-alignment two-columns">

                <SlRadioGroup value={us.current} align-right
                              size={'small'} onSlChange={handleDistanceUnits}
                >
                    <label slot="label">{'Distances/Elevations:'}</label>
                    <SlRadioButton value={INTERNATIONAL}>{'Metric'}</SlRadioButton>
                    <SlRadioButton value={IMPERIAL}>{'Impérial'}</SlRadioButton>
                </SlRadioGroup>
            </div>

            <div className="horizontal-alignment two-columns">
                <SlRadioGroup value={cs.current} align-right
                              size={'small'} onSlChange={handleCoordinateUnits}
                >
                    <label slot="label">{'Coordinates:'}</label>
                    <SlRadioButton value={DD}>{'Digital Degrees'}</SlRadioButton>
                    <SlRadioButton value={DMS}>{'Degrees Minutes Seconds'}</SlRadioButton>
                </SlRadioGroup>
            </div>

        </>
    )
}