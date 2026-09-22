/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: RestartBackend.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2024-09-22
 * Last modified: 2026-09-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { SlAlert, SlDialog }         from '@shoelace-style/shoelace/dist/react'
import { WaIcon }                    from '@web.awesome.me/webawesome-pro/dist/react'
import { useProxyValue }              from '@Utils/ValtioUtils'


/**
 *
 * @param props
 *
 * @prop message  error message
 *
 * @return {JSX.Element}
 */
export const RestartBackend = () => {

    const handleRequestClose = (event) => {
        if (event.detail.source === 'overlay') {
            event.preventDefault()
        }
    }

    const backendRestart = useProxyValue(lgs.stores.main, main => main.backendRestart === true, false)
    return (
        <SlDialog label={`Trying to restart the backend...`}
                  open={backendRestart}
                  id={'restart-backend'}
                  className={'lgs-theme'}
                  noHeader onSlRequestClose={handleRequestClose}
                  style={{'--body-spacing': 0}}
        >
            <SlAlert variant="warning" open>
                <WaIcon slot="icon" name="triangle-exclamation" variant="regular"/>
                {'Restarting the backend...'}
            </SlAlert>
        </SlDialog>

    )
}
