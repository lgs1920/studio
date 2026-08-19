/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: InitErrorMessage.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-04-15
 * Last modified: 2026-04-15
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { ErrorDiagnosticDetails } from '@Components/Modals/ErrorDiagnosticDetails'
import {
    collectErrorDiagnostic, formatErrorDiagnostic, sanitizeErrorHtml,
} from '@Utils/ErrorDiagnosticUtils'
import {
    WaButton, WaCallout, WaDialog, WaIcon,
}                        from '@web.awesome.me/webawesome-pro/dist/react'

const BACKEND_SUPPORT_EMAIL = 'studio@lgs1920.fr'
const BACKEND_SUPPORT_SUBJECT = '[Studio] Backend stopped'

/**
 * Component to display a modal when the application fails to initialize
 * @param {Object} props
 * @param {Object} props.error - The error object containing message and stack
 * @returns {JSX.Element}
 */
export const InitErrorMessage = ({error}) => {
    const text = 'We\'re sorry for the interruption.'
    const remark = 'Something didn\'t go quite as planned on our end.'
    const errorType = error?.type ? `[${String(error.type)}]` : ''
    const errorMessage = String(error?.message ?? error?.cause?.message ?? error ?? 'Unknown initialization error')
    const errorMessageHtml = sanitizeErrorHtml(errorMessage)
    const errorStack = String(error?.stack ?? '')
    const studioName = lgs?.servers?.studio?.name ?? 'LGS1920'
    const diagnostic = collectErrorDiagnostic({
        error,
        suggestedFix: 'Reload Studio. If the problem persists, contact Studio support.',
    })
    diagnostic.details = formatErrorDiagnostic(diagnostic)
    const backendSupportBody = [
        errorType && `Type: ${errorType}`,
        `Error: ${errorMessage}`,
        errorStack && `Details:\n${errorStack}`,
    ].filter(Boolean).join('\n\n')
    const backendSupportMailto = `mailto:${BACKEND_SUPPORT_EMAIL}?subject=${encodeURIComponent(BACKEND_SUPPORT_SUBJECT)}&body=${encodeURIComponent(backendSupportBody)}`

    return (
        <WaDialog label={`${studioName} stopped!`}
                  open={true}
                  withFooter
                  className="lgs-theme lgs-error-dialog"
                  id={'init-error-modal'}
        >
            <div className="lgs--init-error-message">

                <WaCallout variant="danger" open>
                    <WaIcon slot="icon" name="triangle-exclamation" variant="regular"/>
                    {errorType}{' '}
                    <span dangerouslySetInnerHTML={{__html: errorMessageHtml}}/><br/><br/>

                    <div>
                        <span>{text}</span><br/>
                        <span>{remark}</span>
                    </div>
                </WaCallout>

                <ErrorDiagnosticDetails
                    diagnostic={diagnostic}
                    id="lgs--init-error-details"
                />
            </div>

            <div slot="footer" className="buttons-bar">
                <WaButton variant="neutral" appearance="plain" href={backendSupportMailto}>
                    <WaIcon name="envelope" variant="regular"/>{'Contact Support'}
                </WaButton>
                <WaButton variant="brand" onClick={() => window.location.reload()}>
                    <WaIcon name="arrows-rotate" variant="regular"/>{'Retry'}
                </WaButton>
            </div>
        </WaDialog>
    )
}
