import React, { useEffect, useRef } from 'react'
import { CameraSettings }           from './CameraSettings'

export const Style = () => {
    const styleSettings = useRef(null)

    useEffect(() => {
        __.ui.ui.initDetailsGroup(styleSettings.current)
    }, [])

    const checkClose = (event) => {
        // If we're over the drawer, ok else, stop event
        if (window.isOK(event) && __.ui.drawerManager.over) {
            return
        }
        event.preventDefault()
    }


    return (

        <div ref={styleSettings}>
            <CameraSettings onClose={checkClose}/>
        </div>

    )
}