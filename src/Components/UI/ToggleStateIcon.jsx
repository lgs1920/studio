import { faEye, faEyeSlash } from '@fortawesome/pro-regular-svg-icons'
import { SlIcon }            from '@shoelace-style/shoelace/dist/react'
import React, { useState }   from 'react'
import { FA2SL }             from '../../Utils/FA2SL'

export const ToggleStateIcon = (props) => {

    const change = props.change
    const initial = props.initial ?? true
    const icons = props.icons ?? {shown: faEye, hidden: faEyeSlash}
    const id = props.id ?? ''
    const style = props.style ?? ''

    const [visibility, setVisibility] = useState(initial)
    const toggleVisibility = () => {
        setVisibility(!visibility)
        change(!visibility)
    }

    return (
        <a className="visibility-button"
           {...(props.id && {id})}
           {...(props.style && {style})}
           onClick={toggleVisibility}>
            {visibility
             ? <SlIcon slot="suffix" library="fa" name={FA2SL.set(icons.hidden)}/>
             : <SlIcon slot="suffix" library="fa" name={FA2SL.set(icons.shown)}/>
            }
        </a>
    )
}
