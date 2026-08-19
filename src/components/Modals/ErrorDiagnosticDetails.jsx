/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ErrorDiagnosticDetails.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGSScrollbars } from '@Components/MainUI/LGSScrollbars'
import { WaCopyButton, WaDetails } from '@web.awesome.me/webawesome-pro/dist/react'
import { useState } from 'react'
import './style.css'

/**
 * Renders an expandable and copyable diagnostic report inside an error dialog.
 * @param {Object} props
 * @param {Object} props.diagnostic
 * @param {string} props.id
 * @param {string} [props.summary]
 * @returns {JSX.Element}
 */
export const ErrorDiagnosticDetails = ({diagnostic, id, summary = 'Complete diagnostic report'}) => {
    const [open, setOpen] = useState(false)
    const details = diagnostic?.details ?? ''

    return (
        <WaDetails
            open={open}
            summary={summary}
            onWaShow={() => setOpen(true)}
            onWaHide={() => setOpen(false)}
            className="error-diagnostic-details"
        >
            <span slot="summary" className="error-diagnostic-summary">
                <span>{summary}</span>
                {open && (
                    <WaCopyButton
                        from={id}
                        copy-label="Copy error details"
                        success-label="Error details copied"
                        error-label="Unable to copy error details"
                        onClick={event => event.stopPropagation()}
                    />
                )}
            </span>
            <div className="error-diagnostic-report">
                <LGSScrollbars>
                    <pre id={id}>{details}</pre>
                </LGSScrollbars>
            </div>
        </WaDetails>
    )
}
