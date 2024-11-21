import { faEye, faEyeSlash }          from '@fortawesome/pro-regular-svg-icons'
import { SlIconButton }               from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                      from '@Utils/FA2SL'
import React, { useEffect, useState } from 'react'

export const ToggleStateIcon = (props) => {

    const change = props.change
    const initialState = props.initial ?? true
    const icons = props.icons ?? {shown: faEye, hidden: faEyeSlash}
    const id = props.id ?? ''
    const style = props.style ?? ''

    const [state, setState] = useState(initialState)

    const toggleState = async () => {
        setState(!state)
        change(!state)
    }

    useEffect(() => {
        setState(initialState)
    }, [initialState])

    return (
        <>
            <a className="toggle-state-icon"
               {...(props.id && {id})}
               {...(props.style && {style})}
               onClick={toggleState}>
                {state
                 ? <SlIconButton slot="suffix" library="fa" {...(props.style && {style})}
                                 className={'toggle-state-icon-hidden'}
                           name={FA2SL.set(icons.hidden)}/>
                 : <SlIconButton slot="suffix" library="fa" {...(props.style && {style})}
                                 className={'toggle-state-icon-shown'}
                           name={FA2SL.set(icons.shown)}/>
                }
            </a>
        </>
    )
}
