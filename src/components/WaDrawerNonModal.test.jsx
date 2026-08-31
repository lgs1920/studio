/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WaDrawerNonModal.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {cleanup, render} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'
import WaDrawerNonModal from '@Components/WaDrawerNonModal'

vi.mock('@Components/DrawerResizeHandle', () => ({
    DrawerResizeHandle: ({drawerId, placement, resizeMax}) => (
        <div data-testid="drawer-resize-handle"
             data-drawer-id={drawerId}
             data-placement={placement}
             data-resize-max={resizeMax}/>
    ),
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', async () => {
    const {forwardRef} = await import('react')
    return {
        WaDrawer: forwardRef(({children, ...props}, ref) => (
            <div ref={ref} data-testid="wa-drawer" {...props}>{children}</div>
        )),
    }
})

describe('WaDrawerNonModal resize opt-in', () => {
    afterEach(() => {
        cleanup()
    })

    it('keeps resizing disabled by default', () => {
        const {queryByTestId, getByTestId} = render(
            <WaDrawerNonModal id="settings-drawer" placement="end"/>,
        )

        expect(queryByTestId('drawer-resize-handle')).toBeNull()
        expect(getByTestId('wa-drawer').getAttribute('resize')).toBeNull()
    })

    it('renders the resize handle only when explicitly enabled', () => {
        const {getByTestId} = render(
            <WaDrawerNonModal id="journey-editor-drawer" placement="end" resize={true}/>,
        )

        expect(getByTestId('drawer-resize-handle').getAttribute('data-drawer-id')).toBe('journey-editor-drawer')
        expect(getByTestId('drawer-resize-handle').getAttribute('data-placement')).toBe('end')
        expect(getByTestId('wa-drawer').getAttribute('resize')).toBeNull()
    })

    it('passes a drawer-specific maximum only to the resize handle', () => {
        const {getByTestId} = render(
            <WaDrawerNonModal id="journey-editor-drawer"
                              placement="end"
                              resize={true}
                              resizeMax={640}/>,
        )

        expect(getByTestId('drawer-resize-handle').getAttribute('data-resize-max')).toBe('640')
        expect(getByTestId('wa-drawer').getAttribute('resizeMax')).toBeNull()
    })
})
