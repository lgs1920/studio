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
 * Last modified: 2026-08-19
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, ...props}) => <button {...props}>{children}</button>,
    WaCopyButton: () => null,
    WaDetails: ({children}) => <div>{children}</div>,
    WaTextarea: () => null,
}))

vi.mock('@Components/MainUI/LGSScrollbars', () => ({
    LGSScrollbars: ({children}) => <>{children}</>,
}))

vi.mock('@shoelace-style/shoelace/dist/react', () => ({
    SlAlert: ({children}) => <div>{children}</div>,
    SlButton: ({children, ...props}) => <button {...props}>{children}</button>,
    SlDialog: ({children, className, style}) => <div className={className} role="dialog" style={style}>{children}</div>,
    SlIcon: () => null,
}))

vi.mock('@Utils/FA2SL', () => ({
    FA2SL: {set: value => value},
}))

import { WidgetMountErrorDialog } from '@Components/MainUI/video/WidgetMountErrorDialog'

describe('WidgetMountErrorDialog', () => {
    afterEach(() => cleanup())

    it('keeps the timeout dialog in the dedicated topmost error layer', () => {
        render(
            <WidgetMountErrorDialog
                open
                error={{missing: ['stats-widget'], timeoutMs: 5000}}
                action="record"
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />,
        )

        expect(screen.getByRole('dialog').style.getPropertyValue('--sl-z-index-dialog')).toBe('var(--lgs-error-dialog-zindex)')
        expect(screen.getByRole('dialog').className).toContain('widget-mount-error-dialog')
        expect(screen.getByText('Complete diagnostic report')).not.toBeNull()
        expect(screen.getByText('stats-widget', {exact: true})).not.toBeNull()
    })
})
