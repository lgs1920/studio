/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: tunnel.test.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-05
 * Last modified: 2026-06-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@Components/LGSPopup', () => ({
    LGSPopup: ({children}) => <>{children}</>,
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, ...props}) => <button type="button" {...props}>{children}</button>,
    WaIcon: ({name}) => <span data-icon={name}/>,
}))

import { Tunnel } from '@Components/Tunnel/Tunnel'

describe('Tunnel', () => {
    afterEach(() => {
        cleanup()
    })

    it('renders standard buttons with app variants', () => {
        render(
            <Tunnel
                steps={[
                    {icon: 'gear', text: 'Step one'},
                    {icon: 'check', text: 'Step two', done: true},
                ]}
                onCancel={vi.fn()}
            />,
        )

        const stepOne = screen.getByRole('button', {name: 'Step one'})
        const stepTwo = screen.getByRole('button', {name: 'Step two'})
        const cancel = screen.getByRole('button', {name: 'Exit'})

        expect(stepOne.className).not.toContain('square-button')
        expect(stepOne.getAttribute('variant')).toBe('neutral')
        expect(stepOne.getAttribute('appearance')).toBe('plain')

        expect(stepTwo.className).not.toContain('square-button')
        expect(stepTwo.getAttribute('variant')).toBe('neutral')
        expect(stepTwo.getAttribute('appearance')).toBe('plain')

        expect(cancel.className).not.toContain('square-button')
        expect(cancel.getAttribute('variant')).toBe('neutral')
        expect(cancel.getAttribute('appearance')).toBe('plain')
    })

    it('marks blocked steps as disabled plain buttons', () => {
        render(
            <Tunnel
                steps={[
                    {icon: 'gear', text: 'Setup', mandatory: true},
                    {icon: 'camera', text: 'Record'},
                ]}
                onCancel={vi.fn()}
            />,
        )

        const blocked = screen.getByRole('button', {name: 'Record'})

        expect(blocked.className).not.toContain('square-button')
        expect(blocked.getAttribute('variant')).toBe('neutral')
        expect(blocked.getAttribute('appearance')).toBe('plain')
        expect(blocked.getAttribute('aria-disabled')).toBe('true')
        expect(blocked.className).toContain('lgs-tunnel-button-disabled')
        expect(blocked.disabled).toBe(false)
    })

    it('lets blocked steps bubble pointer and keyboard events for widget drag', () => {
        const handlePointerDown = vi.fn()
        const handleKeyDown = vi.fn()

        render(
            <div onPointerDown={handlePointerDown} onKeyDown={handleKeyDown}>
                <Tunnel
                    steps={[
                        {icon: 'gear', text: 'Setup', mandatory: true},
                        {icon: 'camera', text: 'Record'},
                    ]}
                    onCancel={vi.fn()}
                />
            </div>,
        )

        const blocked = screen.getByRole('button', {name: 'Record'})

        fireEvent.pointerDown(blocked)
        fireEvent.keyDown(blocked, {key: ' '})

        expect(handlePointerDown).toHaveBeenCalled()
        expect(handleKeyDown).toHaveBeenCalled()
    })

    it('runs the current step action when clicking the selected default step', () => {
        const handleRecord = vi.fn()

        render(
            <Tunnel
                defaultStepIndex={1}
                steps={[
                    {icon: 'gear', text: 'Setup', done: true},
                    {icon: 'camera', text: 'Record', onClick: handleRecord},
                ]}
                onCancel={vi.fn()}
            />,
        )

        fireEvent.click(screen.getByRole('button', {name: 'Record'}))

        expect(handleRecord).toHaveBeenCalledTimes(1)
    })

    it('waits for an asynchronous step action before navigating', async () => {
        let resolveAction
        const handleRecord = vi.fn(() => new Promise(resolve => {
            resolveAction = resolve
        }))

        render(
            <Tunnel
                steps={[
                    {icon: 'gear', text: 'Setup'},
                    {icon: 'camera', text: 'Record', onClick: handleRecord},
                ]}
                onCancel={vi.fn()}
            />,
        )

        const record = screen.getByRole('button', {name: 'Record'})
        fireEvent.click(record)

        expect(handleRecord).toHaveBeenCalledTimes(1)
        expect(record.getAttribute('aria-selected')).toBe('false')

        await act(async () => {
            resolveAction()
        })

        expect(record.getAttribute('aria-selected')).toBe('true')
    })
})
