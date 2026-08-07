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

        render(<InitErrorMessage error={new Error('Backend server is unreachable')}/>)

        expect(screen.getByRole('link', {name: 'Contact Support'}).getAttribute('href')).toBe(
            'mailto:studio@lgs1920.fr?subject=%5BStudio%5D%20Backend%20stopped',
        )
    })
})
