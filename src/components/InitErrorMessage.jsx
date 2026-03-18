/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: InitErrorMessage.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-18
 * Last modified: 2026-03-18
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGSScrollbars } from '@Components/MainUI/LGSScrollbars'
import {
    WaButton, WaCallout, WaCopyButton, WaDetails, WaDialog, WaIcon,
}                        from '@web.awesome.me/webawesome-pro/dist/react'
import parse             from 'html-react-parser'
import { useState }      from 'react'

/**
 * Component to display a modal when the application fails to initialize
 * @param {Object} props
 * @param {Object} props.error - The error object containing message and stack
 * @returns {JSX.Element}
 */
export const InitErrorMessage = ({error}) => {
    const [isOpen, setIsOpen] = useState(false)

    console.log(error)

    return (
        <WaDialog label={`${lgs.servers.studio.name} stopped!`}
                  open={true}
                  id={'init-error-modal'}
                  className={'lgs-theme'}
        >
            <div className="lgs--init-error-message">

                <div>
                    <span>{'We\’re sorry for the interruption.'}</span><br/>
                    <span>{'Something didn\'t go quite as planned on our end.'}</span>
                </div>
                <WaCallout variant="danger" open>
                    <WaIcon slot="icon" name="triangle-exclamation" variant="regular"/>
                    {error.type && `[${error?.type}]`} {parse(error.message)}
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
                            {error.stack}
                        </LGSScrollbars>
                    </pre>
                </WaDetails>

            </div>
            <div slot="footer">
                <div id={'footer'}>
                    <div className="buttons-bar">
                        <WaButton autofocus variant="brand" onClick={() => window.location.reload()}>
                            <WaIcon name="arrows-rotate" variant="regular"></WaIcon>{'Retry'}
                        </WaButton>
                    </div>
                </div>
            </div>

        </WaDialog>
    )
}