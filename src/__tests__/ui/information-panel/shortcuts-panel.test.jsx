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
 * Last modified: 2026-10-21
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
            action:      'General command',
            description: 'Uses a general application command.',
            id:          'general-command',
            keys:        ['Escape'],
            scope:       'App',
        },
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
        {
            action:      'Open Fix Path',
            description: 'Opens the Fix Path editor.',
            id:          'fix-path-show',
            keys:        ['F'],
            scope:       'App',
        },
        {
            action:      'Select Fix Path points',
            description: 'Selects correction points on the map.',
            id:          'fix-path-point-multiselect',
            keys:        ['Shift+Drag'],
            scope:       'Fix Path map',
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

vi.mock('@awesome.me/webawesome/dist/react', () => ({
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

        expect([...document.querySelectorAll('.lgs--shortcuts-section h3')].map(element => element.textContent))
            .toEqual(['General', 'Timeline', 'Clips', 'Fix Path'])

        const simpleRow = screen.getByText('Simple alternatives').closest('.lgs--shortcuts-row')
        const composedRow = screen.getByText('Composed alternatives').closest('.lgs--shortcuts-row')

        expect(within(simpleRow).getByText('|')).not.toBeNull()
        expect(simpleRow.querySelectorAll('.lgs--shortcut-alternative.is-separate-line')).toHaveLength(0)
        expect(within(composedRow).queryByText('|')).toBeNull()
        expect(composedRow.querySelectorAll('.lgs--shortcut-alternative.is-separate-line')).toHaveLength(2)
    })

    it('groups Fix Path gestures in their own section', () => {
        render(<ShortcutsPanel/>)

        const section = [...document.querySelectorAll('.lgs--shortcuts-section')]
            .find(element => element.querySelector('h3')?.textContent === 'Fix Path')

        expect(section).not.toBeUndefined()
        expect(within(section).getByText('Open Fix Path')).not.toBeNull()
        expect(within(section).getByText('Select Fix Path points')).not.toBeNull()
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
        fireEvent.click(screen.getByRole('button', {name: 'Clips'}))

        expect(scrollIntoView).toHaveBeenCalledWith({behavior: 'smooth', block: 'start'})
        expect(screen.queryByRole('dialog', {name: 'Shortcut sections'})).toBeNull()
        delete HTMLElement.prototype.scrollIntoView
    })
})
