/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CallForActions.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-30
 * Last modified: 2025-06-30
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { faRegularRouteCirclePlus } from '@awesome.me/kit-eb5c406148/icons/kit/custom'
import { faGlobePointer }           from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon }         from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                    from '@Utils/FA2SL'
import { useEffect, useRef }        from 'react'

export const CallForActions = (props) => {
    const cfa = useRef(null)
    const main = lgs.mainProxy

    const loadJourney = () => {
        hide()
        lgs.stores.ui.journeyLoader.visible = true
    }
    const hide = () => {
        cfa.current.style.display = 'none'
    }

    useEffect(() => {
        // We check if we click outside. If it is the case,
        // We hide CFAs
        const handleClickOutside = (event) => {
            if (cfa.current && !cfa.current.contains(event.target)) {
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
                <div className="main-actions call-for-actions lgs-slide-in-from-bottom" ref={cfa}>
                    <div className="buttons-bar">
                        <SlButton onClick={hide} href={__.app.buildUrl(lgs.configuration.website)}
                                  target="_blank"
                                  outline>
                            <SlIcon slot="prefix" library="fa"
                                    name={FA2SL.set(faGlobePointer)}/>
                            {'Visit Our Site'}
                        </SlButton>


                        <SlButton variant="primary" onClick={loadJourney}>
                            <SlIcon slot="prefix" library="fa"
                                    name={FA2SL.set(faRegularRouteCirclePlus)}/>
                            <span>Load your first Journey</span>

                        </SlButton>
                    </div>
                </div>
            }
        </>
    )
}