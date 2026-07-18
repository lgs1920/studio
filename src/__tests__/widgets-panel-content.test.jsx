import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SETTINGS_STORE } from '@Core/constants'
import { SettingsSection } from '@Core/settings/SettingsSection'
import { proxy } from 'valtio'

vi.mock('@Core/ui/widget-manager/dynamic-render/WidgetDynamicRender', () => ({
    WidgetDynamicRenderer: {
        instance: {
            theGroups:     () => new Map(),
            renderWidget:  vi.fn(),
        },
    },
}))

vi.mock('@Components/MainUI/widgets/WidgetGridOverlay', () => ({
    WidgetGridOverlay: () => <div data-testid="widget-grid-overlay"/>,
}))

vi.mock('@Components/MainUI/widgets/openWidgetManagementDrawer', () => ({
    getManageableWidgets:       () => [],
    openWidgetManagementDrawer: vi.fn(),
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaDivider:     props => <hr {...props}/>,
    WaIcon:        ({name}) => <span data-icon={name}/>,
    WaNumberInput: ({children, onInput, ...props}) => (
        <wa-number-input {...props} onInput={onInput}>
            {children}
        </wa-number-input>
    ),
    WaSwitch:      ({children, checked, onInput, ...props}) => (
        <button type="button" aria-pressed={checked} onClick={event => onInput?.({target: {checked: !checked}, currentTarget: event.currentTarget})} {...props}>
            {children}
        </button>
    ),
}))

import { WidgetsPanelContent } from '@Components/MainUI/widgets/WidgetsPanelContent'

describe('WidgetsPanelContent', () => {
    beforeEach(() => {
        globalThis.__ = {
            ui: {
                widgetManager: {
                    getWidgetsByGroup: vi.fn(() => Promise.resolve([])),
                },
            },
        }
        globalThis.lgs = {
            settings: {
                ui: proxy({
                    toolbars: {
                        opacity: 1,
                    },
                    widgets: {
                        grid: {
                            enabled: true,
                            size:    40,
                            snap:    true,
                        },
                    },
                }),
            },
            stores: {
                ui: proxy({
                    widget: {
                        list:  new Map(),
                        cache: new Map(),
                    },
                    video: {},
                }),
            },
            theJourney: true,
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('marks the grid number input as non draggable to prevent widget pseudo double-click handling', async () => {
        render(<WidgetsPanelContent groups={[]}/>)

        await waitFor(() => expect(screen.getByText('Widgets')).not.toBeNull())

        const input = document.querySelector('wa-number-input.widget-grid-size-input')
        expect(input.closest('.widget-grid-setting').classList.contains('lgs-widget-no-drag')).toBe(true)
    })

    it('persists grid visibility changes in UI settings', async () => {
        const settingsPut = vi.fn(() => Promise.resolve())
        const section = new SettingsSection('ui')
        globalThis.lgs.configuration = {
            ui: {
                toolbars: {
                    opacity: 1,
                },
                widgets: {
                    grid: {
                        enabled: false,
                        size:    30,
                        snap:    true,
                    },
                },
            },
        }
        globalThis.lgs.db = {
            settings: {
                get: vi.fn(() => Promise.resolve(null)),
                put: settingsPut,
            },
        }
        await section.init()
        globalThis.lgs.settings.ui = section.content
        settingsPut.mockClear()

        render(<WidgetsPanelContent groups={[]}/>)
        await waitFor(() => expect(screen.getByText('Widgets')).not.toBeNull())

        fireEvent.click(screen.getByText('Grid').closest('button'))

        await waitFor(() => {
            expect(settingsPut).toHaveBeenCalledWith(
                'ui',
                expect.objectContaining({
                    widgets: expect.objectContaining({
                        grid: expect.objectContaining({
                            enabled: true,
                        }),
                    }),
                }),
                SETTINGS_STORE,
            )
        })
    })
})
