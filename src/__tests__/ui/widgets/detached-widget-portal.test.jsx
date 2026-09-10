// @vitest-environment jsdom
/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: detached-widget-portal.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-10
 * Last modified: 2026-09-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'

const portalMocks = vi.hoisted(() => ({
    mode: 'pip',
}))

vi.mock('@Components/MainUI/widgets/DynamicWidget', () => ({
    DynamicWidget: ({id}) => <div data-testid="detached-widget" data-widget-id={id}/>,
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaCard: ({children, withHeaderActions, ...props}) => (
        <section data-testid="detached-card" data-with-header-actions={withHeaderActions ? 'true' : 'false'}
                 {...props}>
            {children}
        </section>
    ),
    WaButton: ({children, ...props}) => <button {...props}>{children}</button>,
    WaIcon: ({name, library}) => <span data-testid={`icon-${name}`} data-library={library}/>,
}))

import {DetachedWidgetPortal} from '@Components/MainUI/widgets/DetachedWidgetPortal'

describe('DetachedWidgetPortal', () => {
    let container

    beforeEach(() => {
        container = document.createElement('main')
        document.body.appendChild(container)
        globalThis.lgs = {
            stores: {
                ui: {
                    widget: proxy({
                        list:     new Map([['replay-timeline-widget#1', {group: 'journey-widgets'}]]),
                        undocked: {id: 'replay-timeline-widget#1', mode: 'window'},
                    }),
                },
            },
        }
        globalThis.__ = {
            widgets: new Map([
                ['journey-widgets', {
                    widgets: new Map([
                        ['replay-timeline-widget', {
                            name:        'Replay Timeline',
                            canDetach:   true,
                            canDockable: true,
                        }],
                    ]),
                }],
            ]),
            ui: {
                widgetManager: {
                    getWidgetConfig: vi.fn(() => ({
                        contextMenu: {canDetach: true, canDockable: true},
                        group: 'journey-widgets',
                    })),
                },
                widgetWindowManager: {
                    getPortalState: vi.fn(() => ({
                        container,
                        mode: portalMocks.mode,
                    })),
                    reattachWidget: vi.fn(),
                    attachWidgetToDrawer: vi.fn(),
                },
            },
        }
    })

    afterEach(() => {
        cleanup()
        container.remove()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('renders the card actions in Document Picture-in-Picture', () => {
        portalMocks.mode = 'pip'

        render(<DetachedWidgetPortal/>)

        expect(screen.getByTestId('detached-widget')).toBeTruthy()
        expect(screen.getByTestId('detached-card').getAttribute('orientation')).toBe('vertical')
        expect(screen.getByTestId('detached-card').getAttribute('data-with-header-actions')).toBe('true')
        expect(screen.getByText('Replay Timeline')).toBeTruthy()
        expect(screen.getByRole('button', {name: 'Undock'})).toBeTruthy()
        expect(screen.getByRole('button', {name: 'Attach'})).toBeTruthy()
        expect(screen.getByTestId('icon-arrow-up-from-bracket')).toBeTruthy()
        expect(screen.getByTestId('icon-arrow-down-to-bracket')).toBeTruthy()
        expect(screen.getByTestId('icon-arrow-up-from-bracket').getAttribute('data-library')).toBeNull()
        expect(screen.getByTestId('icon-arrow-down-to-bracket').getAttribute('data-library')).toBeNull()

        fireEvent.click(screen.getByRole('button', {name: 'Undock'}))
        fireEvent.click(screen.getByRole('button', {name: 'Attach'}))
        expect(__.ui.widgetWindowManager.reattachWidget).toHaveBeenCalled()
        expect(__.ui.widgetWindowManager.attachWidgetToDrawer).toHaveBeenCalled()
    })

    it('renders the same card actions in a popup window', () => {
        portalMocks.mode = 'window'

        render(<DetachedWidgetPortal/>)

        expect(screen.getByRole('button', {name: 'Undock'})).toBeTruthy()
        expect(screen.getByRole('button', {name: 'Attach'})).toBeTruthy()
    })

    it('does not expose actions disabled by widget capabilities', () => {
        __.widgets = new Map([
            ['journey-widgets', {
                widgets: new Map([['replay-timeline-widget', {
                    canDetach:   false,
                    canDockable: false,
                }]]),
            }],
        ])
        __.ui.widgetManager.getWidgetConfig.mockReturnValue({
            contextMenu: {canDetach: false, canDockable: false},
            group: 'journey-widgets',
        })

        render(<DetachedWidgetPortal/>)

        expect(screen.queryByRole('button', {name: 'Undock'})).toBeNull()
        expect(screen.queryByRole('button', {name: 'Attach'})).toBeNull()
    })
})
