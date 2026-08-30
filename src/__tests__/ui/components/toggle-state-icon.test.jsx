import {fireEvent, render, screen} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, ...props}) => <button type="button" {...props}>{children}</button>,
    WaIcon: ({name, ...props}) => <span data-icon={name} {...props}/>,
}))

import {ToggleStateIcon} from '@Components/ToggleStateIcon'

describe('ToggleStateIcon', () => {
    it('renders a native link without a button in link mode', () => {
        const onChange = vi.fn()

        render(<ToggleStateIcon mode="link" aria-label="Hide widget" onChange={onChange}/>)

        const link = screen.getByRole('link', {name: 'Hide widget'})
        expect(link.tagName).toBe('A')
        expect(screen.queryByRole('button')).toBeNull()
        expect(link.querySelector('[data-icon="eye-slash"]')).not.toBeNull()

        fireEvent.click(link)

        expect(onChange).toHaveBeenCalledWith(false, expect.anything())
    })

    it('keeps the Web Awesome button as the default mode', () => {
        render(<ToggleStateIcon aria-label="Hide widget"/>)

        expect(screen.getByRole('button', {name: 'Hide widget'})).not.toBeNull()
        expect(screen.queryByRole('link')).toBeNull()
    })
})
