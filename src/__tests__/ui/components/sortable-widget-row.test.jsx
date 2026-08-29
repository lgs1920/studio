/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: sortable-widget-row.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-03
 * Last modified on: 2026-07-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { SortableWidgetRow } from '@Components/MainUI/widgets/ordering/SortableWidgetRow'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, ...props}) => <button {...props}>{children}</button>,
    WaCard: ({children, ...props}) => <div {...props}>{children}</div>,
    WaIcon: props => <span {...props} />,
    WaTooltip: () => null,
}))

describe('SortableWidgetRow', () => {
    beforeEach(() => {
        globalThis.lgs = {
            gutter: {xs: 12},
            settings: {
                widgets: {
                    'test-widget': proxy({
                        icon: 'square',
                        name: 'Test widget',
                        configuration: {
                            default: {},
                            user: {},
                            elements: {},
                        },
                    }),
                },
            },
        }

        globalThis.__ = {
            ui: {
                widgetManager: {
                    getElementById: vi.fn(() => ({})),
                    toCenter: vi.fn(),
                    removeWidget: vi.fn(),
                    editWidget: vi.fn(),
                    toggleWidgetVisibility: vi.fn(),
                },
            },
        }
        globalThis.lgs.stores = {
            ui: proxy({
                widget: {
                    list: new Map(),
                },
            }),
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.lgs = undefined
        globalThis.__ = undefined
    })

    it('opens the widget editor stacked from the edit action', () => {
        render(<SortableWidgetRow widget={{id: 'test-widget#1', type: 'test-widget'}} />)

        fireEvent.click(screen.getByLabelText('Edit'))

        expect(__.ui.widgetManager.editWidget).toHaveBeenCalledWith('test-widget#1', {stacked: true})
    })

    it('does not render a visibility toggle for a non-hideable widget', () => {
        render(<SortableWidgetRow widget={{id: 'test-widget#1', type: 'test-widget', canHide: false, visible: true}} />)

        expect(screen.queryByLabelText('Hide widget')).toBeNull()
        expect(screen.queryByLabelText('Show widget')).toBeNull()
    })

    it('toggles visibility through the shared widget manager action', () => {
        render(<SortableWidgetRow widget={{id: 'test-widget#1', type: 'test-widget', canHide: true, visible: true}} />)

        fireEvent.click(screen.getByLabelText('Hide widget'))

        expect(__.ui.widgetManager.toggleWidgetVisibility).toHaveBeenCalledWith('test-widget#1', false)
    })
})
