/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ToggleStateIcon.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-02-25
 * Last modified: 2025-02-25
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
    const icons = {false: faEye, true: faEyeSlash}
    if (props.icon) {
        icons.true = props.icon.hidden ?? props.icon.true
        icons.false = props.icon.shown ?? props.icon.false
    }
    const id = props.id ?? ''
    const style = props.style ?? ''
    const size = props.size ?? ''

    const [state, setState] = useState(initialState)

    const toggleState = async (event) => {
        setState(!state)
        if (change) {
            change(!state, event)
        }
    }

    useEffect(() => {
        setState(initialState)
    }, [initialState])

    return (
        <>
            <div className={`toggle-state-icon ${props.className} ${size}`}>
                {state
                 ? <SlIconButton slot="suffix" library="fa" {...(props.style && {style})}
                                 className={'toggle-state-icon-true'}
                                 onClick={toggleState}
                                 name={FA2SL.set(icons.true)} {...(props.id && {id})}/>
                 : <SlIconButton slot="suffix" library="fa" {...(props.style && {style})}
                                 className={'toggle-state-icon-false'}
                                 onClick={toggleState}
                                 name={FA2SL.set(icons.false)}  {...(props.id && {id})}/>
                }
            </div>
        </>
    )
}
