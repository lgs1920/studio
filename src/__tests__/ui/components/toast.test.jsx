import { render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaIcon: ({children, ...props}) => <wa-icon {...props}>{children}</wa-icon>,
    WaToast: ({children, ...props}) => <wa-toast {...props}>{children}</wa-toast>,
    WaToastItem: ({children, ...props}) => <wa-toast-item {...props}>{children}</wa-toast-item>,
}))

import { showToast, Toast } from '@Components/Toast'

describe('Toast', () => {
    it('renders notifications with Web Awesome toast elements', async () => {
        render(<Toast/>)

        showToast({caption: 'Saved', text: 'The journey was saved.'}, 'success')

        await waitFor(() => {
            const toastItem = document.querySelector('wa-toast-item')

            expect(toastItem).not.toBeNull()
            expect(toastItem?.className).toContain('lgs-toast--success')
            expect(toastItem?.textContent).toContain('The journey was saved.')
        })
    })
})
