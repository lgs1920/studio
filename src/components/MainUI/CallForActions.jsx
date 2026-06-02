/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CallForActions.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-23
 * Last modified: 2026-04-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaButton, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import { useEffect, useRef } from 'react'

/**
 * Component displaying initial actions with triggered animation
 * @returns {JSX.Element}
 */
export const CallForActions = () => {
    const _cfa = useRef(null)
    const _mainUI = useRef(lgs.stores.ui.mainUI)

    /**
     * Hides the call to action for the current app session.
     */
    const hide = () => {
        _mainUI.current.callForActions.active = false
    }

    /**
     * Hides the call to action and triggers the journey loader
     */
    const loadJourney = () => {
        hide()
        _mainUI.current.journeyLoader.visible = true
    }

    useEffect(() => {
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

                <WaTooltip for="cfa-import-journey" placement="top">{'Import journey'}</WaTooltip>
                <WaButton id="cfa-import-journey" variant="brand" onClick={loadJourney}>
                    <WaIcon slot="start" variant="regular" name="file-import"/>
                    <span>Import</span>
                </WaButton>
            </div>
        </div>
    )
}
