import { SlDetails }                from '@shoelace-style/shoelace/dist/react'
import React, { useEffect, useRef } from 'react'
import { CameraSettings }           from './CameraSettings'
import { WelcomeModal }             from './WelcomeModal'

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

        <div ref={styleSettings} id={'style-settings'}>
            <SlDetails id={'ui-welcome-modal-settings'}
                       small open={false}
                       className={'lgs-theme'}
                       onSlHide={checkClose}
            >
                <WelcomeModal onClose={checkClose}/>
            </SlDetails>
            <CameraSettings onClose={checkClose}/>
        </div>

    )
}