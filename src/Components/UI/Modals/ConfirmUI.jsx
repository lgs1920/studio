import { SlButton, SlDialog } from '@shoelace-style/shoelace/dist/react'
import { useState }           from 'react'

/**
 * Confirm Dialog
 *
 * From https://medium.com/@kch062522/useconfirm-a-custom-react-hook-to-prompt-confirmation-before-action-f4cb746ebd4e
 *
 * @param title
 * @param message
 * @param confirmLabel
 * @param cancelLabel
 *
 * @return {[function(): *,function(): Promise<unknown>]}
 */
export const useConfirm = (title, message, confirmLabel = 'Yes', cancelLabel = 'No') => {
    const [promise, setPromise] = useState(null)
    const [open, setOpen] = useState(false)

    const confirm = () => new Promise((resolve, reject) => {
        setPromise({resolve})
    })

    // Prevent the dialog from closing when the user clicks on the overlay
    function handleRequestClose(event) {
        if (event.detail.source === 'overlay') {
            event.preventDefault()
        }
    }

    const handleClose = () => {
        setPromise(null)
    }

    const handleConfirm = () => {
        promise?.resolve(true)
        handleClose()
    }

    const handleCancel = () => {
        promise?.resolve(false)
        handleClose()
    }
    const ConfirmationDialog = () => (
        <SlDialog open={promise !== null} label="confirm-dialog" onSlRequestClose={handleRequestClose}
                  onSlAfterHide={() => setOpen(false)}>
            <div slot="label">{title}</div>
            {message}
            <div slot="footer">
                <div className="buttons-bar">
                    <SlButton onClick={handleCancel}>{cancelLabel}</SlButton>
                    <SlButton variant="primary" onClick={handleConfirm}>{confirmLabel}</SlButton>
                </div>
            </div>
        </SlDialog>
    )
    return [ConfirmationDialog, confirm]
}
