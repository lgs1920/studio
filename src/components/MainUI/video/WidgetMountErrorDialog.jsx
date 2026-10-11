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
 * Last modified: 2026-10-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { ErrorDiagnosticDetails } from '@Components/Modals/ErrorDiagnosticDetails'
import { collectErrorDiagnostic, formatErrorDiagnostic } from '@Utils/ErrorDiagnosticUtils'
import {
    WaButton, WaCallout, WaDialog, WaIcon,
}                                                       from '@awesome.me/webawesome/dist/react'
import React                                            from 'react'
import { createPortal }                                 from 'react-dom'
import './style.css'

export const WidgetMountErrorDialog = ({open, error, action, onConfirm, onCancel}) => {
    const missing = Array.isArray(error?.missing) ? error.missing : []
    const timeoutMs = typeof error?.timeoutMs === 'number' ? error.timeoutMs : null
    const timeoutError = new Error(
        `The following widgets did not mount within ${timeoutMs ?? 'the requested'} milliseconds: ${missing.join(', ') || 'Unavailable'}`,
    )
    timeoutError.name = 'WidgetMountTimeoutError'
    timeoutError.code = 'WIDGET_MOUNT_TIMEOUT'
    const diagnostic = collectErrorDiagnostic({
        error:        timeoutError,
        suggestedFix: 'Wait for the widgets to finish mounting, then retry the recording or snapshot.',
    })
    diagnostic.details = formatErrorDiagnostic(diagnostic)
    const dialog = (
        <WaDialog
            open={open}
            label={'Widgets not mounted'}
            onWaHide={onConfirm}
            className={'wa-theme-lgs1920 lgs-error-dialog widget-mount-error-dialog'}
            style={{pointerEvents: 'auto'}}
        >
            <WaCallout variant="warning" open>
                <WaIcon slot="icon" name="triangle-exclamation" variant="regular"/>
                <p>{`Some widgets could not be mounted in time for the ${action === 'record' ? 'record' : 'snapshot'}.`}</p>
                {missing.length > 0 && (
                    <ul style={{listStyleType: '-', marginLeft: '0'}}>
                        {missing.map(id => (
                            <li key={id}>{id}</li>
                        ))}
                    </ul>
                )}
            </WaCallout>

            <ErrorDiagnosticDetails
                diagnostic={diagnostic}
                id="widget-mount-error-details"
            />

            <div slot="footer" className="buttons-bar">
                <WaButton variant="neutral" onClick={onCancel}>
                    <WaIcon slot="start" name="xmark" variant="regular"/>
                    {'Cancel'}
                </WaButton>
                <WaButton variant="brand" onClick={onConfirm}>
                    <WaIcon slot="start" name={action === 'record' ? 'clapperboard-play' : 'image-polaroid'} variant="regular"/>
                    {`${action === 'record' ? 'Record' : 'Snap it'} anyway`}
                </WaButton>
            </div>
        </WaDialog>
    )

    // VideoRecordingScreenArea is rendered inside #lgs-tools-ui, whose
    // pointer-events:none is required for map interaction. A native modal
    // dialog inherits that hit-testing behavior, so portal it outside that
    // subtree to keep its controls clickable.
    return typeof document === 'undefined' ? dialog : createPortal(dialog, document.body)
}
