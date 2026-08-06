/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetMountErrorDialog.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-01-28
 * Last modified: 2026-01-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { faXmark, faClapperboardPlay, faImagePolaroid } from '@fortawesome/pro-regular-svg-icons'
import { SlAlert, SlButton, SlDialog, SlIcon }          from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                        from '@Utils/FA2SL'
import React                                            from 'react'

export const WidgetMountErrorDialog = ({open, error, action, onConfirm, onCancel}) => {
    const missing = Array.isArray(error?.missing) ? error.missing : []
    const timeoutMs = typeof error?.timeoutMs === 'number' ? error.timeoutMs : null
    return (
        <SlDialog
            open={open}
            label={'Widgets not mounted'}
            onSlRequestClose={onConfirm}
            className={'lgs-theme'}
        >
            <SlAlert variant="warning" open>
                <p>{`Some widgets could not be mounted in time for the ${action === 'record' ? 'record' : 'snapshot'}.`}</p>
                {missing.length > 0 && (
                    <ul style={{listStyleType: '-', marginLeft: '0'}}>
                        {missing.map(id => (
                            <li key={id}>{id}</li>
                        ))}
                    </ul>
                )}
            </SlAlert>

            <div slot="footer">
                <div className="buttons-bar">
                    <SlButton variant="default" onClick={onCancel}>
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faXmark)}></SlIcon>
                        {'Cancel'}
                    </SlButton>
                    <SlButton variant="primary" onClick={onConfirm}>
                        <SlIcon slot="prefix" library="fa"
                                name={FA2SL.set(action === 'record' ? faClapperboardPlay : faImagePolaroid)}/>
                        {`${action === 'record' ? 'Record' : 'Snap it'} anyway`}
                    </SlButton>
                </div>
            </div>
        </SlDialog>
    )
}
