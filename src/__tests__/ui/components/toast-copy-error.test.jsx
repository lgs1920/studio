/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: toast-copy-error.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-08
 * Last modified: 2026-11-08
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {cleanup, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

vi.mock('@awesome.me/webawesome/dist/react', () => ({
    WaCallout: ({children, ...props}) => <div {...props}>{children}</div>,
    WaCopyButton: ({children, from, copyLabel, ...props}) => (
        <button aria-label={copyLabel} data-copy-from={from} {...props}>{children}</button>
    ),
    WaIcon: ({name}) => <span data-icon={name}/>,
}))

import {CalloutToast, LGS_ERROR_TOAST, LGS_WARNING_TOAST} from '@Components/Toast'
import {UI_ACTIONS} from '@Core/ui/metadata/uiActionCatalog'

describe('error toast copy action', () => {
    afterEach(() => cleanup())

    it('copies the rendered caption and full error detail through the Web Awesome copy control', () => {
        render(<CalloutToast
            type={LGS_ERROR_TOAST}
            message={{caption: 'Replay video', text: 'Imagery tile 8431/5905 failed at level 14.'}}
        />)

        const button = screen.getByRole('button', {name: UI_ACTIONS.copyToastMessage.label})
        const copyTarget = document.getElementById(button.getAttribute('data-copy-from'))

        expect(copyTarget?.textContent).toBe('Replay video\nImagery tile 8431/5905 failed at level 14.')
        expect(button.querySelector('[data-icon="copy"]')).not.toBeNull()
    })

    it('does not add the copy action to non-error toasts', () => {
        render(<CalloutToast
            type={LGS_WARNING_TOAST}
            message={{caption: 'Replay video', text: 'Some tiles are still loading.'}}
        />)

        expect(screen.queryByRole('button', {name: UI_ACTIONS.copyToastMessage.label})).toBeNull()
        expect(screen.getByText('Some tiles are still loading.')).not.toBeNull()
    })
})
