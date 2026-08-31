/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WaDrawerNonModal.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-03-18
 * Last modified: 2026-03-18
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import React, { forwardRef }        from 'react'
import { useCallback, useState }    from 'react'
import { WaDrawer as WaDrawerBase } from '@web.awesome.me/webawesome-pro/dist/react'
import { DrawerResizeHandle }       from '@Components/DrawerResizeHandle'

let patched = false
let pending = false

const patchWaDrawer = () => {
    if (patched || typeof window === 'undefined') {
        return
    }

    const DrawerClass = customElements.get('wa-drawer')
    if (!DrawerClass) {
        if (!pending && typeof customElements.whenDefined === 'function') {
            pending = true
            void customElements.whenDefined('wa-drawer').then(() => {
                pending = false
                patchWaDrawer()
            })
        }
        return
    }

    patched = true

    const proto = DrawerClass.prototype
    if (proto.__nonModalPatched) {
        return
    }

    proto.__nonModalPatched = true
    proto.__nonModalOriginalShow = proto.show
    proto.__nonModalOriginalFirstUpdated = proto.firstUpdated

    const withNonModalDialog = (drawer, handler) => {
        if (!drawer || typeof drawer.showModal !== 'function' || typeof drawer.show !== 'function') {
            return handler()
        }

        const originalShowModal = drawer.showModal.bind(drawer)
        drawer.showModal = drawer.show.bind(drawer)

        try {
            return handler()
        }
        finally {
            drawer.showModal = originalShowModal
        }
    }

    proto.firstUpdated = function (...args) {
        return withNonModalDialog(this.drawer, () => proto.__nonModalOriginalFirstUpdated?.apply(this, args))
    }

    proto.show = function (...args) {
        return withNonModalDialog(this.drawer, () => proto.__nonModalOriginalShow?.apply(this, args))
    }
}

/**
 * Assigns a drawer element to either callback or object refs.
 *
 * @param {Object|Function|null} ref - Forwarded React ref.
 * @param {HTMLElement|null} value - Drawer element.
 * @returns {void}
 */
const assignForwardedRef = (ref, value) => {
    if (typeof ref === 'function') {
        ref(value)
    }
    else if (ref) {
        ref.current = value
    }
}

const WaDrawerNonModal = forwardRef((props, ref) => {
    const {resize = false, resizeMax, ...drawerProps} = props
    const [drawer, setDrawer] = useState(null)
    /**
     * Stores the drawer element locally and forwards it to the consumer ref.
     *
     * @param {HTMLElement|null} element - Drawer custom element.
     * @returns {void}
     */
    const setDrawerElement = useCallback(element => {
        setDrawer(element)
        assignForwardedRef(ref, element)
    }, [ref])

    patchWaDrawer()

    return (
        <>
            <WaDrawerBase ref={setDrawerElement} {...drawerProps} />
            {drawer && resize === true && <DrawerResizeHandle
                drawer={drawer}
                drawerId={drawerProps.id}
                placement={drawerProps.placement}
                resizeMax={resizeMax}
            />}
        </>
    )
})

export default WaDrawerNonModal
