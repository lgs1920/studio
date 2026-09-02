/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: sortable-widget-group-row.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-02
 * Last modified: 2026-09-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {SortableWidgetGroupRow} from '@Components/MainUI/widgets/ordering/SortableWidgetGroupRow'
import {cleanup, render, screen} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, ...props}) => <button {...props}>{children}</button>,
    WaCard: ({children, ...props}) => <div {...props}>{children}</div>,
    WaDetails: ({children, open, ...props}) => <wa-details open={open} {...props}>{children}</wa-details>,
    WaIcon: props => <span {...props}/>,
    WaTooltip: () => null,
}))

describe('SortableWidgetGroupRow', () => {
    beforeEach(() => {
        globalThis.lgs = {
            gutter: {xs: 12},
            settings: {
                widgets: {
                    'text-widget': proxy({
                        icon: 'font',
                        name: 'Text',
                        configuration: {
                            default: {},
                            user: {},
                            elements: {},
                        },
                    }),
                },
            },
            stores: {
                ui: proxy({
                    widget: {
                        list: new Map(),
                    },
                }),
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
    })

    afterEach(() => {
        cleanup()
        globalThis.lgs = undefined
        globalThis.__ = undefined
    })

    it('opens the group and exposes each member widget menu', () => {
        render(
            <SortableWidgetGroupRow
                group={{
                    id: 'text-widget#one',
                    label: 'Track',
                    members: [
                        {id: 'text-widget#one', type: 'text-widget', label: 'Text', canHide: false},
                        {id: 'text-widget#two', type: 'text-widget', label: 'Second text', canHide: false},
                    ],
                }}
            />,
        )

        expect(document.querySelector('wa-details')).not.toBeNull()
        expect(document.querySelector('wa-details').getAttribute('iconplacement')).toBe('end')
        expect(document.querySelector('.widget-ordering-group-summary .sortable-widget-info').textContent).toBe('Track')
        expect(screen.getAllByLabelText('Edit')).toHaveLength(2)
    })
})
