import { faXmark }                    from '@fortawesome/pro-regular-svg-icons'
import { faCheck }                    from '@fortawesome/pro-solid-svg-icons'
import { SlButton, SlDialog, SlIcon } from '@shoelace-style/shoelace/dist/react'
import parse                          from 'html-react-parser'
import { useState }                   from 'react'
import { FA2SL }                      from '../../Utils/FA2SL'

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

    const confirmIcon = confirmButton?.icon ?? faCheck
    const confirmText = confirmButton?.text ?? 'Yes'
    const confirmVariant = confirmButton?.variant ?? 'primary'
    const cancelIcon = cancelButton?.icon ?? faXmark
    const cancelText = cancelButton?.text ?? 'No'
    const cancelVariant = cancelButton?.variant ?? 'default'

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
        <SlDialog open={open} onSlRequestClose={handleRequestClose}
                  onSlAfterHide={() => setOpen(false)}
                  className={'lgs-theme'}
        >
            <div slot="label">{parse(title)}</div>
            <Message/>
            <div slot="footer">
                <div className="buttons-bar">
                    <SlButton onClick={handleCancel} variant={cancelVariant}>
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(cancelIcon)}></SlIcon>
                        {parse(cancelText)}
                    </SlButton>
                    <SlButton variant={confirmVariant} onClick={handleConfirm}>
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(confirmIcon)}></SlIcon>
                        {parse(confirmText)}
                    </SlButton>
                </div>
            </div>
        </SlDialog>
    )
    return [ConfirmationDialog, confirm]
}
