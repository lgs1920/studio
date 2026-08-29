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
})
