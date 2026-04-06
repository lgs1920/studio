/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ConfirmUI.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-06
 * Last modified: 2026-04-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { faXmark }                    from '@fortawesome/pro-regular-svg-icons'
import { faCheck }                    from '@fortawesome/pro-solid-svg-icons'
import { SlButton, SlDialog, SlIcon } from '@shoelace-style/shoelace/dist/react'
import { WaButton, WaDialog, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import parse                          from 'html-react-parser'
import { useState }                   from 'react'
import { FA2SL } from '@Utils/FA2SL'

/**
 * Confirm Dialog
 *
 * From https://medium.com/@kch062522/useconfirm-a-custom-react-hook-to-prompt-confirmation-before-action-f4cb746ebd4e
 *
 * @param title
 * @param message
 * @param confirmButton
 * @param cancelButton
 *
 * @return {[function(): *,function(): Promise<unknown>]}
 */
export const useConfirm = (title, Message, confirmButton, cancelButton) => {
    const [queue, setQueue] = useState([])
    const [open, setOpen] = useState(false)

    const confirmIcon = confirmButton?.icon ?? 'check'
    const confirmText = confirmButton?.text ?? 'Yes'
    const confirmVariant = confirmButton?.variant ? confirmButton?.variant : 'brand'
    const cancelIcon = cancelButton?.icon ?? 'xmark'
    const cancelText = cancelButton?.text ?? 'Cancel'
    const cancelVariant = cancelButton?.variant ? cancelButton?.variant : ''

    const confirm = () => new Promise((resolve, reject) => {
        setQueue(prevQueue => [...prevQueue, {resolve}])
        if (!open) {
            setOpen(true)
        }
    })

    // Prevent the dialog from closing when the user clicks on the overlay
    function handleRequestClose(event) {
        if (event.detail.source === 'overlay') {
            event.preventDefault()
        }
    }

    const handleClose = () => {
        setQueue(prevQueue => prevQueue.slice(1))
        if (queue.length > 1) {
            setOpen(true)
        }
        else {
            setOpen(false)
        }
    }

    const handleConfirm = () => {
        queue[0]?.resolve(true)
        handleClose()
    }

    const handleCancel = () => {
        queue[0]?.resolve(false)
        handleClose()
    }
    const ConfirmationDialog = () => (
        <WaDialog open={open} onWaHide={handleRequestClose}
                  onWaAfterHide={() => setOpen(false)}
        >
            <div slot="label">{parse(title)}</div>
            <Message/>
            <div slot="footer">
                <div className="buttons-bar">
                    <WaButton onClick={handleCancel} variant={cancelVariant} appearance="outlined">
                        <WaIcon slot="start" name={cancelIcon} variant="regular"/>
                        {parse(cancelText)}
                    </WaButton>
                    <WaButton variant={confirmVariant} onClick={handleConfirm}>
                        <WaIcon slot="start" name={confirmIcon} variant="regular"/>
                        {parse(confirmText)}
                    </WaButton>
                </div>
            </div>
        </WaDialog>
    )
    return [ConfirmationDialog, confirm]
}
