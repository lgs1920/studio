/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: init-error-message.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-07
 * Last modified: 2026-08-19
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@Components/MainUI/LGSScrollbars', () => ({
    LGSScrollbars: ({children}) => <>{children}</>,
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, ...props}) => <a {...props}>{children}</a>,
    WaCallout: ({children}) => <div>{children}</div>,
    WaCopyButton: () => null,
    WaDetails: ({children}) => <div>{children}</div>,
    WaDialog: ({children}) => <div role="dialog">{children}</div>,
    WaIcon: () => null,
    WaTextarea: () => null,
}))

import { InitErrorMessage } from '@Components/InitErrorMessage'

describe('InitErrorMessage', () => {
    afterEach(() => {
        cleanup()
        globalThis.lgs = undefined
    })

    it('provides a backend support mailto link with the expected subject', () => {
        globalThis.lgs = {
            servers: {
                studio: {
                    name: 'LGS1920 Studio',
                },
            },
        }

        render(<InitErrorMessage error={{
            message: 'Backend server is unreachable',
            stack: 'Backend stack trace',
        }}/>)

        expect(screen.getByRole('link', {name: 'Contact Support'}).getAttribute('href')).toBe(
            `mailto:studio@lgs1920.fr?subject=${encodeURIComponent('[Studio] Backend stopped')}&body=${encodeURIComponent('Error: Backend server is unreachable\n\nDetails:\nBackend stack trace')}`,
        )
    })

    it('renders safe HTML in the error callout', () => {
        const {container} = render(<InitErrorMessage error={{message: '<strong>Backend failed</strong><script>alert(1)</script>'}}/>)

        expect(container.querySelector('strong')?.textContent).toBe('Backend failed')
        expect(container.querySelector('script')).toBeNull()
    })
})
