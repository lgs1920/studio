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

import { render } from '@testing-library/react'
import { LGSPopup } from '@Components/LGSPopup'
import { describe, expect, it, vi } from 'vitest'

const {waPopupMock} = vi.hoisted(() => ({
    waPopupMock: vi.fn(),
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaPopup: props => {
        waPopupMock(props)
        return <div data-testid="wa-popup">{props.children}</div>
    },
}))

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
})
