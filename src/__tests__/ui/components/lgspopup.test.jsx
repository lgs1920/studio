/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: lgspopup.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-08
 * Last modified: 2026-06-08
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { fireEvent, render } from '@testing-library/react'
import { LGSPopup } from '@Components/LGSPopup'
import { describe, expect, it, vi } from 'vitest'

const {waPopupMock} = vi.hoisted(() => ({
    waPopupMock: vi.fn(),
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', async () => {
    const { forwardRef } = await vi.importActual('react')

    return {
        WaPopup: forwardRef((props, ref) => {
        waPopupMock(props)
        return <div ref={ref} data-testid="wa-popup">{props.children}</div>
        }),
    }
})

describe('LGSPopup', () => {
    it('enables flip and shift by default', () => {
        render(
            <LGSPopup active anchor="popup-anchor">
                <div>Popup content</div>
            </LGSPopup>,
        )

        expect(waPopupMock).toHaveBeenCalledTimes(1)
        expect(waPopupMock.mock.calls[0][0]).toEqual(expect.objectContaining({
            active: true,
            anchor: 'popup-anchor',
            flip:   true,
            shift:  true,
        }))
    })

    it('does not close on pointer down from an additional outside anchor', () => {
        const onRequestClose = vi.fn()
        const view = render(
            <>
                <button id="popup-anchor" type="button">{'Popup anchor'}</button>
                <button id="popup-toggle" type="button">{'Popup toggle'}</button>
                <LGSPopup
                    active
                    anchor="popup-anchor"
                    outsideAnchors={['popup-toggle']}
                    onRequestClose={onRequestClose}
                >
                    <div>Popup content</div>
                </LGSPopup>
            </>,
        )

        fireEvent.pointerDown(view.getByRole('button', {name: 'Popup toggle'}))
        expect(onRequestClose).not.toHaveBeenCalled()

        fireEvent.pointerDown(document.body)
        expect(onRequestClose).toHaveBeenCalledTimes(1)
    })
})
