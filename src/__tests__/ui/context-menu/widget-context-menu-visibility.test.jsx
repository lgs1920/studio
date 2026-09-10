/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: widget-context-menu-visibility.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-29
 * Last modified: 2026-09-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WidgetContextMenu } from '@Components/MainUI/widgets/WidgetContextMenu'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, ...props}) => <button {...props}>{children}</button>,
    WaIcon: ({name}) => <span data-icon={name}/>,
    WaTooltip: () => null,
}))

describe('WidgetContextMenu visibility', () => {
    const widgetId = 'test-widget#1'

    beforeEach(() => {
        globalThis.lgs = {
            settings: {
                ui: proxy({toolbars: {opacity: 1}}),
            },
            stores: {
                ui: proxy({
                    drawers: {
                        open: null,
                        entity: null,
                    },
                    contextMenu: {
                        visible: true,
                    },
                    widget: {
                        list: new Map([[widgetId, {visible: true}]]),
                    },
                }),
            },
        }
        globalThis.__ = {
            ui: {
                contextMenu: {
                    hide: vi.fn(),
                },
                widgetManager: {
                    getElementById: vi.fn(() => document.createElement('div')),
                    getWidgetConfig: vi.fn(() => ({
                        canHide: true,
                        canLock: false,
                        contextMenu: {},
                    })),
                    hasCapabilities: vi.fn(() => false),
                    toggleWidgetVisibility: vi.fn(),
                },
                widgetWindowManager: {
                    canDetachWidget: vi.fn(() => false),
                    detachWidget: vi.fn(),
                },
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.lgs = undefined
        globalThis.__ = undefined
    })

    it('renders a hide action for a hideable widget and delegates the toggle', () => {
        render(<WidgetContextMenu targetId={widgetId} menuRef={{current: null}}/>)

        fireEvent.click(screen.getByText('Hide'))

        expect(__.ui.widgetManager.toggleWidgetVisibility).toHaveBeenCalledWith(widgetId)
        expect(__.ui.contextMenu.hide).toHaveBeenCalled()
    })

    it('does not render a visibility action for a non-hideable widget', () => {
        __.ui.widgetManager.getWidgetConfig.mockReturnValue({
            canHide: false,
            canLock: false,
            contextMenu: {},
        })

        render(<WidgetContextMenu targetId={widgetId} menuRef={{current: null}}/>)

        expect(screen.queryByText('Hide')).toBeNull()
        expect(screen.queryByText('Show')).toBeNull()
    })

    it('renders the top docking action for the dockable Replay Timeline', () => {
        const timelineId = 'replay-timeline-widget#1'
        lgs.stores.ui.widget.list.set(timelineId, {visible: true})
        __.ui.widgetManager.getWidgetConfig.mockReturnValue({
            canHide: false,
            canLock: false,
            contextMenu: {canDockable: true},
        })

        render(<WidgetContextMenu targetId={timelineId} menuRef={{current: null}}/>)
        fireEvent.click(screen.getByText('Dock to bottom'))

        expect(lgs.stores.ui.widget.docked.id).toBe(timelineId)
        expect(__.ui.contextMenu.hide).toHaveBeenCalled()
    })

    it('renders and delegates the detach action when the widget capability is enabled', () => {
        __.ui.widgetManager.getWidgetConfig.mockReturnValue({
            canHide: false,
            canLock: false,
            contextMenu: {canDetach: true},
        })
        __.ui.widgetManager.hasCapabilities.mockReturnValue(true)
        __.ui.widgetWindowManager = {
            canDetachWidget: vi.fn(() => true),
            detachWidget:    vi.fn(() => Promise.resolve(true)),
        }

        render(<WidgetContextMenu targetId={widgetId} menuRef={{current: null}}/>)
        fireEvent.click(screen.getByText('Detach into window'))

        expect(__.ui.widgetWindowManager.detachWidget).toHaveBeenCalledWith(widgetId)
    })

    it('does not render for a docked widget', () => {
        lgs.stores.ui.widget.docked = {id: widgetId, size: 320}
        __.ui.widgetManager.getWidgetConfig.mockReturnValue({
            canHide: false,
            canLock: false,
            contextMenu: {canDockable: true},
        })

        render(<WidgetContextMenu targetId={widgetId} menuRef={{current: null}}/>)

        expect(screen.queryByText('Dock to bottom')).toBeNull()
        expect(__.ui.contextMenu.hide).toHaveBeenCalled()
    })

    it('does not render for a detached widget', () => {
        lgs.stores.ui.widget.undocked = {id: widgetId, mode: 'window'}
        __.ui.widgetManager.getWidgetConfig.mockReturnValue({
            canHide: false,
            canLock: false,
            contextMenu: {canDetach: true},
        })

        render(<WidgetContextMenu targetId={widgetId} menuRef={{current: null}}/>)

        expect(screen.queryByText('Detach into window')).toBeNull()
        expect(__.ui.contextMenu.hide).toHaveBeenCalled()
    })
})
