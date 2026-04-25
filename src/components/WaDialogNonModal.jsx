/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WaDialogNonModal.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-25
 * Last modified: 2026-04-25
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { WaDialog as WaDialogBase }                           from '@web.awesome.me/webawesome-pro/dist/react'

let patched = false
let pending = false

const patchWaDialog = () => {
    if (patched || typeof window === 'undefined') {
        return
    }

    const DialogClass = customElements.get('wa-dialog')
    if (!DialogClass) {
        if (!pending && typeof customElements.whenDefined === 'function') {
            pending = true
            customElements.whenDefined('wa-dialog').then(() => {
                pending = false
                patchWaDialog()
            })
        }
        return
    }

    patched = true

    const proto = DialogClass.prototype
    if (proto.__nonModalPatched) {
        return
    }

    proto.__nonModalPatched = true
    proto.__nonModalOriginalShow = proto.show
    proto.__nonModalOriginalFirstUpdated = proto.firstUpdated

    const withNonModalDialog = (dialogComponent, handler) => {
        if (!dialogComponent?.dialog || typeof dialogComponent.dialog.showModal !== 'function' || typeof dialogComponent.dialog.show !== 'function') {
            return handler()
        }

        const originalShowModal = dialogComponent.dialog.showModal.bind(dialogComponent.dialog)
        dialogComponent.dialog.showModal = dialogComponent.dialog.show.bind(dialogComponent.dialog)

        try {
            return handler()
        }
        finally {
            dialogComponent.dialog.showModal = originalShowModal
        }
    }

    proto.firstUpdated = function (...args) {
        return withNonModalDialog(this, () => proto.__nonModalOriginalFirstUpdated?.apply(this, args))
    }

    proto.show = function (...args) {
        return withNonModalDialog(this, () => proto.__nonModalOriginalShow?.apply(this, args))
    }
}

const applyNonModalLayout = (instance) => {
    const dialog = instance?.dialog
    if (!dialog) {
        return false
    }

    Object.assign(dialog.style, {
        position:  'static',
        inset:     'auto',
        margin:    '0',
        maxWidth:  '100%',
        maxHeight: '100%',
        overflow:  'hidden',
        transform: 'none',
    })

    return true
}

const WaDialogNonModal = forwardRef(function WaDialogNonModal(props, ref) {
    const {lightDismiss = true, ...restProps} = props
    const innerRef = useRef(null)

    patchWaDialog()

    useImperativeHandle(ref, () => innerRef.current, [])

    useEffect(() => {
        if (applyNonModalLayout(innerRef.current)) {
            return
        }

        const raf = requestAnimationFrame(() => {
            applyNonModalLayout(innerRef.current)
        })

        return () => cancelAnimationFrame(raf)
    }, [props.open])

    useEffect(() => {
        if (!props.open || !lightDismiss) {
            return
        }

        const handlePointerDown = (event) => {
            const host = innerRef.current
            if (!host) {
                return
            }

            const path = event.composedPath?.() ?? []
            if (path.includes(host) || path.includes(host.dialog)) {
                return
            }

            if (typeof host.requestClose === 'function') {
                host.requestClose(event.target)
                return
            }

            host.open = false
        }

        document.addEventListener('pointerdown', handlePointerDown, true)
        return () => document.removeEventListener('pointerdown', handlePointerDown, true)
    }, [props.open, lightDismiss])

    return <WaDialogBase ref={innerRef} lightDismiss={lightDismiss} {...restProps} />
})

export default WaDialogNonModal
