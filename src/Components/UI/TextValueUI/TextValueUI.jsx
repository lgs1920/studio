import {forwardRef} from "react";
import './style.css'

export const TextValueUI = forwardRef(function TextValue(props, ref) {
    let toShow = props.value ?? null
    if (toShow && props.formatter) {
        toShow = props.formatter(toShow)
    }


    const classes = (props.class)?props.class+' ':'' + 'vt3d-text-value'

    return (
        <div id={props.id} className={classes}>
            <span className='vt3d-tv-text'>{props.text}</span><span className='vt3d-tv-value'>{toShow}</span><span
            className='vt3d-tv-unit'>{props.unit}</span>
        </div>)
})

export const update = (props) => {
    const component = document.getElementById(props.id)
    if (component !== undefined) {
        if (props.text) {
            component.querySelector('.vt3d-tv-text').innerHTML = props.text
        }
        if (props.value) {
            component.querySelector('.vt3d-tv-value').innerHTML = props.value
        }
        if (props.unit) {
            component.querySelector('.vt3d-tv-unit').innerHTML = props.unit
        }
    }
}