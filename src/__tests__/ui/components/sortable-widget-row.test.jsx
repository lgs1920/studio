/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: sortable-widget-row.test.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
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
                },
            },
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
})
