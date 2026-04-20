/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CallForActions.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-20
 * Last modified: 2026-04-20
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaAnimation, WaButton, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import { useEffect, useRef, useState }   from 'react'

/**
 * Component displaying initial actions with triggered animation
 * @param {Object} props - Component properties
 * @returns {JSX.Element}
 */
export const CallForActions = (props) => {
    // Refs must start with _ and avoid 'Ref' suffix
    const _cfa = useRef(null)
    const [isLoaded, setIsLoaded] = useState(false)
    const main = lgs.stores.main

    /**
     * Hides the call to action and triggers the journey loader
     */
    const loadJourney = () => {
        hide()
        lgs.stores.ui.mainUI.journeyLoader.visible = true
    }

    /**
     * Hides the main container using direct DOM manipulation
     */
    const hide = () => {
        if (_cfa.current) {
            _cfa.current.style.display = 'none'
        }
    }

    useEffect(() => {
        // Trigger animation after mount
        setIsLoaded(true)

        /**
         * Closes the panel if a click occurs outside the reference element
         * @param {MouseEvent} event
         */
        const handleClickOutside = (event) => {
            if (_cfa.current && !_cfa.current.contains(event.target)) {
                hide()
                document.removeEventListener('mousedown', handleClickOutside)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    return (
        <>
            {main.readyForTheShow && !main.theJourney &&
                <div className="main-actions call-for-actions" ref={_cfa}>
                    <div className="buttons-bar">
                        <WaButton
                            onClick={hide}
                            id="cfa-visit-site"
                            href={__.app.buildUrl(lgs.configuration.website)}
                            target="_blank"
                            appearance="outlined"
                            variant="brand"
                        >
                            <WaIcon slot="start" variant="regular" name="globe-pointer"/>
                            {'Visit Our Site'}
                        </WaButton>

                        <WaButton variant="brand" onClick={loadJourney}>
                            <WaIcon slot="start" variant="regular" name="circle-plus"/>
                            <span>Load your first Journey</span>
                        </WaButton>
                    </div>
                </div>
            }
        </>
    )
}