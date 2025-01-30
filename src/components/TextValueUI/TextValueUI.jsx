import './style.css'
import { INTERNATIONAL, units as unitsList } from '@Utils/UnitUtils'
import { sprintf }                           from 'sprintf-js'

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
export const TextValueUI = function TextValueUI(props, ref) {
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
        toShow = __.convert(toShow).to(units[lgs.settings.getUnitSystem.current])
    }

    if (toShow && props.callback) {
        toShow = props.callback(toShow)
    } else {
        toShow = (typeof toShow === 'number') ? sprintf(props.format ?? '%\' .2f', toShow) : toShow
    }

    const classes = (props.className) ? props.className + ' ' : '' + 'lgs-text-value'

    return (
        <div id={props.id} className={classes}>
            {props.text && <span className="lgs-tv-text">{props.text}</span>}
            <span>
            {toShow && <span className="lgs-tv-value">{toShow}</span>}
                {units[lgs.settings?.getUnitSystem.current !== INTERNATIONAL] !== '' &&
                    <span className="lgs-tv-unit">{units[lgs.settings?.getUnitSystem.current]}</span>}
        </span>
        </div>
    )
}