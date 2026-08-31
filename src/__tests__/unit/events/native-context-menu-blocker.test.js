/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: native-context-menu-blocker.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-30
 * Last modified: 2026-08-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, describe, expect, it} from 'vitest'
import {installNativeContextMenuBlocker} from '@Core/events/NativeContextMenuBlocker'

describe('installNativeContextMenuBlocker', () => {
    let cleanup

    afterEach(() => {
        cleanup?.()
    })

    it('prevents the native context menu without stopping application handlers', () => {
        const eventTarget = document.createElement('div')
        const child = document.createElement('div')
        const applicationHandler = vi.fn()
        eventTarget.append(child)
        eventTarget.addEventListener('contextmenu', applicationHandler)

        cleanup = installNativeContextMenuBlocker(eventTarget)
        const event = new Event('contextmenu', {bubbles: true, cancelable: true})

        child.dispatchEvent(event)

        expect(event.defaultPrevented).toBe(true)
        expect(applicationHandler).toHaveBeenCalledOnce()
    })

    it('removes the blocker during cleanup', () => {
        const eventTarget = document.createElement('div')
        cleanup = installNativeContextMenuBlocker(eventTarget)
        cleanup()
        cleanup = undefined
        const event = new Event('contextmenu', {cancelable: true})

        eventTarget.dispatchEvent(event)

        expect(event.defaultPrevented).toBe(false)
    })
})
