/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: widget-mount-error-dialog.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-19
 * Last modified: 2026-10-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@awesome.me/webawesome/dist/react', () => ({
    WaButton: ({children, onClick, slot, variant}) => (
        <button data-slot={slot} data-variant={variant} onClick={onClick}>{children}</button>
    ),
    WaCallout: ({children}) => <div>{children}</div>,
    WaCopyButton: () => null,
    WaDetails: ({children}) => <div>{children}</div>,
    WaDialog: ({children, className, label, onWaHide, open}) => (
        <div aria-label={label} className={className} data-open={open} role="dialog">
            <button aria-label="Close dialog" onClick={onWaHide}/>
            {children}
        </div>
    ),
    WaIcon: ({name, slot}) => <span data-icon={name} data-slot={slot}/>,
    WaTextarea: () => null,
}))

vi.mock('@Components/MainUI/LGSScrollbars', () => ({
    LGSScrollbars: ({children}) => <>{children}</>,
}))

import { WidgetMountErrorDialog } from '@Components/MainUI/video/WidgetMountErrorDialog'

describe('WidgetMountErrorDialog', () => {
    afterEach(() => cleanup())

    it('uses the application Web Awesome theme for the timeout dialog', () => {
        render(
            <WidgetMountErrorDialog
                open
                error={{missing: ['stats-widget'], timeoutMs: 5000}}
                action="record"
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />,
        )

        const dialog = screen.getByRole('dialog', {name: 'Widgets not mounted'})
        expect(dialog.dataset.open).toBe('true')
        expect(dialog.className).toContain('wa-theme-lgs1920')
        expect(dialog.className).toContain('widget-mount-error-dialog')
        expect(screen.getByText('Complete diagnostic report')).not.toBeNull()
        expect(screen.getByText('stats-widget', {exact: true})).not.toBeNull()
    })

    it('routes dialog and action button clicks to their callbacks', () => {
        const onConfirm = vi.fn()
        const onCancel = vi.fn()
        render(
            <WidgetMountErrorDialog
                open
                error={{missing: ['stats-widget'], timeoutMs: 5000}}
                action="record"
                onConfirm={onConfirm}
                onCancel={onCancel}
            />,
        )

        fireEvent.click(screen.getByRole('button', {name: 'Cancel'}))
        fireEvent.click(screen.getByRole('button', {name: 'Record anyway'}))
        fireEvent.click(screen.getByRole('button', {name: 'Close dialog'}))

        expect(onCancel).toHaveBeenCalledTimes(1)
        expect(onConfirm).toHaveBeenCalledTimes(2)
    })
})
