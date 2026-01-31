/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: NameValueUnit.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-01
 * Last modified: 2026-02-01
 *
 *
 * Copyright © 2026 LGS1920
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
export const NameValueUnit = function TextValueUI({
                                                      value,
                                                      units = ['', ''],
                                                      noUnit = false,
                                                      format = '%\' .1f',
                                                      precision,
                                                      callback,
                                                      className = null,
                                                      id, text,
                                                  }, _ref) {

    let toShow = (typeof value === 'string') ? value : Number(value) ?? null
    let unitsValues = units ?? ['', '']


    // Handle precision logic to override default format
    // If precision is defined (including 0), we construct the sprintf format
    let formatValue = format
    if (precision !== null && precision !== undefined) {
        formatValue = `%' .${precision}f`
    }

    if (unitsValues instanceof Array) {
        if (unitsValues.length === 1) {
            unitsValues = [unitsValues[0], unitsValues[0]]
        }
    }
    else {
        unitsValues = [unitsValues, unitsValues]
    }

    // lgs is a global variable
    const [unitText, setUnit] = useState(unitsValues[lgs.settings?.unitSystem.current])

    if (unitsList.includes(unitsValues[0])) {
        toShow = __.convert(toShow).to(unitsValues[lgs.settings.getUnitSystem.current])
    }

    if (toShow && callback) {
        toShow = callback(toShow)
    }
    else {
        toShow = (typeof toShow === 'number') ? sprintf(formatValue, toShow) : toShow
    }

    const classes = (className) ? className + ' ' : '' + 'lgs-text-value'

    useEffect(() => {
        setUnit(unitsValues[lgs.settings.unitSystem.current])
    }, [lgs.settings.unitSystem.current])

    return (
        <div id={id} className={classes}>
            {text && <span className="lgs-nvu-text">{text}</span>}
            {toShow && <span className="lgs-nvu-value">{toShow}</span>}
            {!noUnit && <span className="lgs-nvu-unit">{unitText}</span>}

        </div>
    )
}