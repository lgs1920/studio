import { faXmark }                    from '@fortawesome/pro-regular-svg-icons'
import { faCheck, faFileCircleCheck } from '@fortawesome/pro-solid-svg-icons'
import { SlButton, SlDialog, SlIcon } from '@shoelace-style/shoelace/dist/react'
import { useState }                   from 'react'
import { FA2SL }                      from '../../Utils/FA2SL'

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
export const useConfirm = (title, message, confirmLabel, cancelLabel) => {
    const [promise, setPromise] = useState(null)
    const [open, setOpen] = useState(false)

    const confirmIcon = confirmLabel?.icon??faCheck
    const confirmText = confirmLabel?.text??'Yes'
    const cancelIcon = cancelLabel?.icon??faXmark
    const cancelText = cancelLabel?.text??'No'

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
                    <SlButton onClick={handleCancel}>
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(cancelIcon)}></SlIcon>
                        {cancelText}
                    </SlButton>
                    <SlButton variant="primary" onClick={handleConfirm}>
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(confirmIcon)}></SlIcon>
                        {confirmText}
                    </SlButton>
                </div>
            </div>
        </SlDialog>
    )
    return [ConfirmationDialog, confirm]
}
