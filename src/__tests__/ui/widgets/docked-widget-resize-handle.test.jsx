// @vitest-environment jsdom
/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: docked-widget-resize-handle.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-10
 * Last modified: 2026-09-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {cleanup, fireEvent, render, waitFor} from '@testing-library/react'
import {DockedWidgetResizeHandle} from '@Components/MainUI/widgets/DockedWidgetResizeHandle'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

describe('DockedWidgetResizeHandle', () => {
    let drawer
    let dialog

    beforeEach(() => {
        Object.defineProperty(window, 'innerHeight', {configurable: true, value: 1000})
        drawer = document.createElement('wa-drawer')
        dialog = document.createElement('dialog')
        dialog.setAttribute('part', 'dialog')
        drawer.attachShadow({mode: 'open'}).append(dialog)
        document.body.append(drawer)
    })

    afterEach(() => {
        cleanup()
        drawer.remove()
    })

    it('clamps keyboard resizing between the absolute minimum and 90 percent of the viewport', async () => {
        const onSizeChange = vi.fn()
        render(<DockedWidgetResizeHandle drawer={drawer} size={320} onSizeChange={onSizeChange}/>)

        await waitFor(() => expect(drawer.shadowRoot.querySelector('[role="separator"]')).not.toBeNull())
        const handle = drawer.shadowRoot.querySelector('[role="separator"]')

        expect(handle.getAttribute('aria-valuemin')).toBe('180')
        expect(handle.getAttribute('aria-valuemax')).toBe('900')

        fireEvent.keyDown(handle, {key: 'Home'})
        fireEvent.keyDown(handle, {key: 'End'})

        expect(onSizeChange).toHaveBeenNthCalledWith(1, 180)
        expect(onSizeChange).toHaveBeenNthCalledWith(2, 900)
    })
})
