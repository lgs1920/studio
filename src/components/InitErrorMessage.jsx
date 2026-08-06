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

import { LGSScrollbars } from '@Components/MainUI/LGSScrollbars'
import {
    WaButton, WaCallout, WaCopyButton, WaDetails, WaDialog, WaIcon,
}                        from '@web.awesome.me/webawesome-pro/dist/react'
import { useState }      from 'react'

/**
 * Component to display a modal when the application fails to initialize
 * @param {Object} props
 * @param {Object} props.error - The error object containing message and stack
 * @returns {JSX.Element}
 */
export const InitErrorMessage = ({error}) => {
    const [isOpen, setIsOpen] = useState(false)
    const text = 'We\'re sorry for the interruption.'
    const remark = 'Something didn\'t go quite as planned on our end.'
    const errorType = error?.type ? `[${String(error.type)}]` : ''
    const errorMessage = String(error?.message ?? error?.cause?.message ?? error ?? 'Unknown initialization error')
    const errorStack = String(error?.stack ?? '')
    const studioName = lgs?.servers?.studio?.name ?? 'LGS1920'

    return (
        <WaDialog label={`${studioName} stopped!`}
                  open={true}
                  withFooter
                  id={'init-error-modal'}
        >
            <div className="lgs--init-error-message">

                <WaCallout variant="danger" open>
                    <WaIcon slot="icon" name="triangle-exclamation" variant="regular"/>
                    {errorType} {errorMessage}<br/><br/>

                    <div>
                        <span>{text}</span><br/>
                        <span>{remark}</span>
                    </div>
                </WaCallout>

                <WaDetails
                    icon-placement="start"
                    onWaShow={() => setIsOpen(true)}
                    onWaHide={() => setIsOpen(false)}
                >
                    <span slot="summary">
                        {'More Information'}
                        <WaCopyButton
                            style={{visibility: isOpen ? 'visible' : 'hidden'}}
                            feedback-duration="1000"
                            from="lgs--init-error-stack"
                            success-label={'Error copied to clipboard!'}
                            error-label={'Whoops, your browser doesn\'t support this!'}
                        ></WaCopyButton>
                    </span>
                    <WaIcon slot="expand-icon" name="square-plus" variant="regular"/>
                    <WaIcon slot="collapse-icon" name="square-minus" variant="regular" rotate="90"/>
                    <pre id="lgs--init-error-stack">
                        <LGSScrollbars>
                            {errorStack}
                        </LGSScrollbars>
                    </pre>
                </WaDetails>
            </div>

            <div slot="footer" className="buttons-bar">
                <WaButton variant="brand" onClick={() => window.location.reload()}>
                    <WaIcon name="arrows-rotate" variant="regular"/>{'Retry'}
                </WaButton>
            </div>
        </WaDialog>
    )
}
