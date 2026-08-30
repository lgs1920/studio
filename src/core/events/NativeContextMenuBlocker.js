/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: NativeContextMenuBlocker.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Prevents the browser or operating system context menu from opening.
 *
 * @param {Event} event - Native context menu event.
 */
const preventNativeContextMenu = event => {
    event.preventDefault()
}

/**
 * Installs the global native context menu blocker.
 *
 * The listener runs during capture so it also covers context menu events
 * emitted by components that render their controls inside a shadow root.
 * Calling the returned cleanup function removes the listener.
 *
 * @param {Document|EventTarget} [eventTarget=globalThis.document] - Event target to protect.
 * @returns {Function} Cleanup function for the installed listener.
 */
export const installNativeContextMenuBlocker = (eventTarget = globalThis.document) => {
    eventTarget.addEventListener('contextmenu', preventNativeContextMenu, {capture: true})

    return () => {
        eventTarget.removeEventListener('contextmenu', preventNativeContextMenu, {capture: true})
    }
}
