import { forwardRef }                        from 'react'
import './style.css'
import { sprintf }                           from 'sprintf-js'
import { INTERNATIONAL, units as unitsList } from '../../Utils/UnitUtils'

/**
 * TextValueUI Components to display data
 *
 * TODO :rtl
 *
 * @property  {any} value                       The value
 * @property  {string} text                     The text to display on left (no ltr)
 * @property  {string|Array|undefined} units    The units to use
 *                                              - string : use it whatever the units system declared
 *                                              - [x]    : same as string
 *                                              - [x,y]  : use x units in international units system
 *                                                             y units in imperial units system
 *                                              - undefined : no unit
 * @property {string} format                    The format to display the Number values (default = '%\' .2f'
 *                                              Should be compliant with sprintf
 * @property {Function} callback                Used to format the value instead of sprintf
 *
 */
export const TextValueUI = forwardRef(function TextValueUI(props, ref) {
    let toShow = (typeof props.value === 'string') ? props.value : Number(props.value) ?? null
    let units = props.units ?? ['', '']
    if (units instanceof Array) {
        if (units.length === 1) {
            units = [units[0], units[0]]
        }
    } else {
        units = [units, units]
    }

    if (unitsList.includes(units[0])) {
        toShow = __.convert(toShow).to(units[vt3d.configuration.unitsSystem])
    }

    if (toShow && props.callback) {
        toShow = props.callback(toShow)
    } else {
        toShow = (typeof toShow === 'number') ? sprintf(props.format ?? '%\' .2f', toShow) : toShow
    }

    const classes = (props.class) ? props.class + ' ' : '' + 'vt3d-text-value'

    return (
        <div id={props.id} className={classes}>
            {props.text && <span className="vt3d-tv-text">{props.text}</span>}
            <span>
            {toShow && <span className="vt3d-tv-value">{toShow}</span>}
                {units[vt3d.configuration.unitsSystem !== INTERNATIONAL] !== '' &&
                    <span className="vt3d-tv-unit">{units[vt3d.configuration.unitsSystem]}</span>}
        </span>
        </div>
    )
})