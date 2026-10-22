/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: widgets-panel-content.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-18
 * Last modified: 2026-10-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SCENE_WIDGETS, SCENE_WIDGETS_BOARD, SETTINGS_STORE, TEXT_WIDGET } from '@Core/constants'
import { SettingsSection } from '@Core/settings/SettingsSection'
import { resetTextWidgetPositionSequence } from '@Components/Text/textWidgetPosition'
import { proxy } from 'valtio'

const widgetRendererMock = vi.hoisted(() => ({
    theGroups:    vi.fn(),
    renderWidget: vi.fn(),
}))

vi.mock('@Core/ui/widget-manager/dynamic-render/WidgetDynamicRender', () => ({
    WidgetDynamicRenderer: {
        instance: widgetRendererMock,
    },
}))

vi.mock('@Components/MainUI/widgets/WidgetGridOverlay', () => ({
    WidgetGridOverlay: () => <div data-testid="widget-grid-overlay"/>,
}))

vi.mock('@Components/MainUI/widgets/openWidgetManagementDrawer', () => ({
    getManageableWidgets:       () => [],
    openWidgetManagementDrawer: vi.fn(),
}))

vi.mock('@awesome.me/webawesome/dist/react', () => ({
    WaDivider:     props => <hr {...props}/>,
    WaDropdown:    ({children, className, onWaSelect, placement}) => {
        const childList = Array.isArray(children) ? children : [children]
        const trigger = childList.find(child => child?.props?.slot === 'trigger')
        const options = childList.filter(child => child?.props?.value)

        return (
            <details className={className} data-testid="replay-guide-dropdown" data-placement={placement}>
                <summary>{trigger?.props.children}</summary>
                {options.map(option => (
                    <button
                        key={option.props.value}
                        type="button"
                        disabled={option.props.disabled}
                        onClick={event => {
                            onWaSelect?.({detail: {item: {value: option.props.value}}})
                            event.currentTarget.closest('details').open = false
                        }}
                    >
                        {option.props.children}
                    </button>
                ))}
            </details>
        )
    },
    WaDropdownItem: ({children}) => children,
    WaIcon:        ({name, ...props}) => <span data-icon={name} {...props}/>,
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
            widgets: new Map([
                [SCENE_WIDGETS, {
                    widgets: new Map([
                        [TEXT_WIDGET, {name: 'Text', icon: 'text', max: 10, type: 'lgs-visual-widget'}],
                    ]),
                }],
            ]),
            ui: {
                widgetManager: {
                    defineElementId:   vi.fn((group, key) => `${key}#new`),
                    getWidgetsByGroup: vi.fn(() => Promise.resolve([])),
                    isMaxWidgetsReached: vi.fn(() => false),
                },
            },
        }
        widgetRendererMock.theGroups.mockImplementation(groups => new Map(
            groups.map(group => [group, globalThis.__.widgets.get(group)]),
        ))
        widgetRendererMock.renderWidget.mockClear()
        resetTextWidgetPositionSequence()
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
                replay: proxy({recordingSync: false, basicPreparationActive: false, alignmentGuides: [], guidePlacementOrientation: null}),
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
        resetTextWidgetPositionSequence()
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

    it('updates the grid controls when grid visibility is toggled', async () => {
        render(<WidgetsPanelContent groups={[]}/>)

        await waitFor(() => expect(screen.getByText('Widgets')).not.toBeNull())
        expect(document.querySelector('wa-number-input.widget-grid-size-input')).not.toBeNull()

        fireEvent.click(screen.getByText('Grid').closest('button'))

        await waitFor(() => {
            expect(document.querySelector('wa-number-input.widget-grid-size-input')).toBeNull()
        })
    })

    it('applies the text widget creation sequence from the widget panel', async () => {
        render(<WidgetsPanelContent groups={[SCENE_WIDGETS]}/>)

        const textEntry = await screen.findByText('Text')
        fireEvent.click(textEntry.closest('li'))
        fireEvent.click(textEntry.closest('li'))

        expect(widgetRendererMock.renderWidget).toHaveBeenNthCalledWith(
            1,
            SCENE_WIDGETS,
            'text-widget#new',
            expect.objectContaining({
                attachTo: 'top-left',
                left:     '20%',
                top:      '20%',
            }),
        )
        expect(widgetRendererMock.renderWidget).toHaveBeenNthCalledWith(
            2,
            SCENE_WIDGETS,
            'text-widget#new',
            expect.objectContaining({
                attachTo: 'top-left',
                left:     '25%',
                top:      '25%',
            }),
        )
    })

    it('places a newly created visual widget above existing widgets', async () => {
        globalThis.lgs.stores.ui.widget.list.set('text-widget#existing', {
            widgetsBoard: SCENE_WIDGETS_BOARD,
            zIndex: 4100,
        })

        render(<WidgetsPanelContent groups={[SCENE_WIDGETS]}/>)

        const textEntry = await screen.findByText('Text')
        fireEvent.click(textEntry.closest('li'))

        expect(widgetRendererMock.renderWidget).toHaveBeenCalledWith(
            SCENE_WIDGETS,
            'text-widget#new',
            expect.objectContaining({zIndex: 4101}),
        )
    })

    it('opens the right-side guide menu and offers both orientations only during Expert Replay preparation', async () => {
        globalThis.lgs.settings.ui.replay = proxy({userMode: 'expert'})
        globalThis.lgs.stores.replay.recordingSync = true
        globalThis.lgs.stores.ui.video.editing = true

        render(<WidgetsPanelContent groups={[]}/>)

        const guideDropdown = await screen.findByTestId('replay-guide-dropdown')
        expect(guideDropdown.getAttribute('data-placement')).toBe('right-start')
        expect(guideDropdown.open).toBe(false)
        fireEvent.click(screen.getByText('Add Guide'))
        expect(guideDropdown.open).toBe(true)
        expect(screen.getByText('Horizontal')).not.toBeNull()
        expect(guideDropdown.querySelector('[data-icon="grip-lines"]')).not.toBeNull()
        expect(guideDropdown.querySelector('[data-icon="grip-lines-vertical"]')).not.toBeNull()
        fireEvent.click(screen.getByText('Horizontal'))

        expect(lgs.stores.replay.guidePlacementOrientation).toBe('horizontal')
        expect(guideDropdown.open).toBe(false)

        lgs.settings.ui.replay.userMode = 'basic'
        await waitFor(() => expect(screen.queryByText('Add Guide')).toBeNull())
    })

    it('disables an orientation when it already has twenty guides', async () => {
        globalThis.lgs.settings.ui.replay = proxy({userMode: 'expert'})
        globalThis.lgs.stores.replay.recordingSync = true
        globalThis.lgs.stores.ui.video.editing = true
        globalThis.lgs.stores.replay.alignmentGuides = Array.from({length: 20}, (_, index) => ({
            id: `horizontal-${index}`,
            orientation: 'horizontal',
            position: index / 20,
            blocked: false,
        }))

        render(<WidgetsPanelContent groups={[]}/>)

        await screen.findByTestId('replay-guide-dropdown')
        fireEvent.click(screen.getByText('Add Guide'))

        expect(screen.getByText('Horizontal').closest('button').disabled).toBe(true)
        expect(screen.getByText('Vertical').closest('button').disabled).toBe(false)
    })
})
