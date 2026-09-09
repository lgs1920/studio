/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: shortcuts-panel.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-09
 * Last modified: 2026-09-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {cleanup, fireEvent, render, screen, within} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

vi.mock('@Core/constants', () => ({
    OS_ICONS: {
        unknown: ['font', 'regular'],
    },
}))

vi.mock('@Core/events/appShortcuts', () => ({
    SHORTCUTS: [
        {
            action:      'Simple alternatives',
            description: 'Uses a simple alternative binding.',
            id:          'simple-alternatives',
            keys:        ['ArrowLeft', 'ArrowRight'],
            scope:       'Replay timeline',
        },
        {
            action:      'Composed alternatives',
            description: 'Uses composed alternative bindings.',
            id:          'composed-alternatives',
            keys:        ['Shift+ArrowLeft', 'Alt+ArrowLeft'],
            scope:       'Replay timeline clips',
        },
    ],
}))

vi.mock('@Components/MainUI/LGSScrollbars', () => ({
    LGSScrollbars: ({autoHide = true, children}) => <div data-auto-hide={String(autoHide)}>{children}</div>,
}))

vi.mock('@Components/LGSPopup', () => ({
    LGSPopup: ({active, children, ...props}) => active ? <div {...props}>{children}</div> : null,
}))

vi.mock('@Utils/UIToast', () => ({
    UIToast: {
        error: vi.fn(),
        success: vi.fn(),
    },
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, ...props}) => <button {...props}>{children}</button>,
    WaCard: ({children, ...props}) => <div {...props}>{children}</div>,
    WaIcon: props => <span {...props}/>,
    WaTooltip: () => null,
}))

import {ShortcutsPanel} from '@Components/InformationPanel/ShortcutsPanel'

describe('ShortcutsPanel', () => {
    afterEach(() => {
        cleanup()
    })

    it('separates composed alternatives and pipes simple alternatives', () => {
        render(<ShortcutsPanel/>)

        const simpleRow = screen.getByText('Simple alternatives').closest('.lgs--shortcuts-row')
        const composedRow = screen.getByText('Composed alternatives').closest('.lgs--shortcuts-row')

        expect(within(simpleRow).getByText('|')).not.toBeNull()
        expect(simpleRow.querySelectorAll('.lgs--shortcut-alternative.is-separate-line')).toHaveLength(0)
        expect(within(composedRow).queryByText('|')).toBeNull()
        expect(composedRow.querySelectorAll('.lgs--shortcut-alternative.is-separate-line')).toHaveLength(2)
    })

    it('navigates to a section and closes the table of contents', () => {
        const scrollIntoView = vi.fn()
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
            configurable: true,
            value:        scrollIntoView,
        })

        render(<ShortcutsPanel/>)
        fireEvent.click(screen.getByRole('button', {name: 'Shortcut sections'}))

        const sectionsPopup = screen.getByRole('dialog', {name: 'Shortcut sections'})

        expect(sectionsPopup).not.toBeNull()
        expect(sectionsPopup.querySelector('[data-auto-hide="false"]')).not.toBeNull()
        fireEvent.click(screen.getByRole('button', {name: 'Replay timeline clips'}))

        expect(scrollIntoView).toHaveBeenCalledWith({behavior: 'smooth', block: 'start'})
        expect(screen.queryByRole('dialog', {name: 'Shortcut sections'})).toBeNull()
        delete HTMLElement.prototype.scrollIntoView
    })
})
