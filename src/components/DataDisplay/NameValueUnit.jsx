/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: NameValueUnit.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-08
 * Last modified: 2026-02-08
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: NameValueUnit.jsx
 *
 ******************************************************************************/

import './style.css'
import { UnitUtils }   from '@Utils/UnitUtils'
import { useMemo }     from 'react'
import { useSnapshot } from 'valtio'

/**
 * NameValueUnit component to display a metric with its unit.
 * Uses the global formatMetric utility for conversion and formatting.
 */
export const NameValueUnit = ({
                                  value,
                                  units,
                                  noUnit = false,
                                  format,
                                  precision,
                                  callback,
                                  className = null,
                                  id,
                                  text,
                              }) => {
    // React to unit system changes
    const unitStore = useSnapshot(lgs.settings.unitSystem)

    const metric = useMemo(() => {
        return UnitUtils.formatMetric(value, {units, format, precision, callback})
    }, [value, units, format, precision, callback, unitStore.current])

    const classes = `${className ?? ''} lgs-text-value`.trim()

    return (
        <div id={id} className={classes}>
            {text && <span className="lgs-nvu-text">{text}</span>}
            {metric.value !== null && <span className="lgs-nvu-value">{metric.value}</span>}
            {!noUnit && metric.unit && <span className="lgs-nvu-unit">{metric.unit}</span>}
        </div>
    )
}