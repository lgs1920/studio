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
import { WaDrawer as WaDrawerBase } from '@web.awesome.me/webawesome-pro/dist/react'

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
            customElements.whenDefined('wa-drawer').then(() => {
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

const WaDrawerNonModal = forwardRef(function WaDrawerNonModal(props, ref) {
    patchWaDrawer()
    return <WaDrawerBase ref={ref} {...props} />
})

export default WaDrawerNonModal
