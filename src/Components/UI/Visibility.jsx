import { faEye, faEyeSlash } from '@fortawesome/pro-regular-svg-icons'
import { SlIcon }            from '@shoelace-style/shoelace/dist/react'
import React, { useState }   from 'react'
import { FA2SL }             from '../../Utils/FA2SL'

export const Visibility = ({change: change, initial = true, icons = {shown: faEye, hidden: faEyeSlash}}) => {
    const [visibility, setVisibility] = useState(initial)

    const toggleVisibility = () => {
        setVisibility(!visibility)
        change(!visibility)
    }

    return (
        <a className="visibility-button" onClick={toggleVisibility}>
            {visibility
             ? <SlIcon slot="suffix" library="fa" name={FA2SL.set(icons.hidden)}/>
             : <SlIcon slot="suffix" library="fa" name={FA2SL.set(icons.shown)}/>
            }
        </a>
    )
}
