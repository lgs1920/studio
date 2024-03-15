import { forwardRef } from 'react'
import './style.css'

export const TextValueUI = forwardRef(function TextValueUI(props, ref) {
    let toShow = props.value ?? null
    if (toShow && props.formatter) {
        toShow = props.formatter(toShow)
    }


    const classes = (props.class) ? props.class + ' ' : '' + 'vt3d-text-value'

    return (
        <div id={props.id} className={classes}>
            <span className="vt3d-tv-text">{props.text}</span><span>
            <span className="vt3d-tv-value">{toShow}</span><span className="vt3d-tv-unit">{props.unit}</span>
        </span>
        </div>
    )
})

export const update = (props) => {
    const component = document.getElementById(props.id)
    if (component !== undefined && component !== null) {
        const text = component.querySelector('.vt3d-tv-text')
        const value = component.querySelector('.vt3d-tv-value')
        const unit = component.querySelector('.vt3d-tv-unit')
        if (props.text && text) {
            text.innerHTML = props.text
        }
        if (props.value && value) {
            value.innerHTML = props.value
        }
        if (props.unit && unit) {
            unit.innerHTML = props.unit
        }
    }
}