/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: NameValueUnit.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-05
 * Last modified: 2025-12-05
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import './style.css'
import { units as unitsList }  from '@Utils/UnitUtils'
import { useEffect, useState } from 'react'
import { sprintf }             from 'sprintf-js'

/**
 * TextValueUI Components to display data
 *
 * TODO :rtl
 *
 * @property  {any} value                       The value
 * @property  {string} text                     The text to display on left (no ltr)
 * @property  {string|Array|undefined} units    The units to use
 * - string : use it whatever the units system declared
 * - [x]    : same as string
 * - [x,y]  : use x units in international units system
 * y units in imperial units system
 * - undefined : no unit
 * @property {string} format                    The format to display the Number values (default = '%\' .2f'
 * Should be compliant with sprintf
 * @property {number} precision                 Optional. Number of digits after decimal point.
 * Overrides 'format' if defined (0 to n).
 * @property {Function} callback                Used to format the value instead of sprintf
 *
 */
export const NameValueUnit = function TextValueUI(props, _ref) {

    let toShow = (typeof props.value === 'string') ? props.value : Number(props.value) ?? null
    let units = props.units ?? ['', '']

    // Handle precision logic to override default format
    // If precision is defined (including 0), we construct the sprintf format
    let format = props.format ?? '%\' .2f'
    if (props.precision !== null && props.precision !== undefined) {
        format = `%' .${props.precision}f`
    }

    if (units instanceof Array) {
        if (units.length === 1) {
            units = [units[0], units[0]]
        }
    }
    else {
        units = [units, units]
    }

    // lgs is a global variable
    const [unitText, setUnit] = useState(units[lgs.settings?.unitSystem.current])

    if (unitsList.includes(units[0])) {
        // We assume __ is a global variable for the recorder/helper
        toShow = __.convert(toShow).to(units[lgs.settings.getUnitSystem.current])
    }

    if (toShow && props.callback) {
        toShow = props.callback(toShow)
    }
    else {
        toShow = (typeof toShow === 'number') ? sprintf(format, toShow) : toShow
    }

    const classes = (props.className) ? props.className + ' ' : '' + 'lgs-text-value'

    useEffect(() => {
        setUnit(units[lgs.settings.unitSystem.current])
    }, [lgs.settings.unitSystem.current])

    return (
        <div id={props.id} className={classes}>
            {props.text && <span className="lgs-nvu-text">{props.text}</span>}
            {toShow &&
                <span className="lgs-nvu-value">{toShow}</span>
            }
            <span className="lgs-nvu-unit">{unitText}</span>
        </div>
    )
}