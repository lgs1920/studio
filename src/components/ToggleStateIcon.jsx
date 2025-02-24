/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ToggleStateIcon.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-02-24
 * Last modified: 2025-02-24
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { faEye, faEyeSlash }          from '@fortawesome/pro-regular-svg-icons'
import { SlIconButton }               from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                      from '@Utils/FA2SL'
import React, { useEffect, useState } from 'react'

export const ToggleStateIcon = (props) => {

    const change = props.onChange
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
            <div className="toggle-state-icon" {...(props.id && {id})}>
                {state
                 ? <SlIconButton slot="suffix" library="fa" {...(props.style && {style})}
                                 className={'toggle-state-icon-hidden'}
                                 onClick={toggleState}
                                 name={FA2SL.set(icons.hidden)}/>
                 : <SlIconButton slot="suffix" library="fa" {...(props.style && {style})}
                                 className={'toggle-state-icon-shown'}
                                 onClick={toggleState}
                                 name={FA2SL.set(icons.shown)}/>
                }
            </div>
        </>
    )
}
