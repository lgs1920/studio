// @vitest-environment jsdom
/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: docked-widget-drawer.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-10
 * Last modified: 2026-09-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {cleanup, render, screen} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'
import {proxyMap} from 'valtio/utils'

const dockManager = vi.hoisted(() => ({
    hydrateDockedWidget: vi.fn(),
    setDockSize: vi.fn(),
    undockWidget: vi.fn(() => true),
}))

vi.mock('@Components/WaDrawerNonModal', () => ({
    default: ({children, ...props}) => <div data-testid="widget-dock-drawer" {...props}>{children}</div>,
}))

vi.mock('@Components/MainUI/widgets/DynamicWidget', () => ({
    DynamicWidget: () => <div data-testid="docked-widget"/>,
}))

vi.mock('@Components/MainUI/widgets/DockedWidgetResizeHandle', () => ({
    DockedWidgetResizeHandle: () => null,
}))

vi.mock('@Core/ui/widget-manager/WidgetDockManager', () => dockManager)

import {DockedWidgetDrawer} from '@Components/MainUI/widgets/DockedWidgetDrawer'

describe('DockedWidgetDrawer', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        globalThis.__ = {
            ui: {
                drawerManager: {drawerRoot: document.body},
                widgetWindowManager: {
                    canDetachWidget: vi.fn(() => true),
                    detachWidget: vi.fn(async () => true),
                },
            },
        }
        globalThis.lgs = {
            settings: {ui: {widgets: {}}},
            stores: {
                ui: proxy({
                    drawers: proxy({open: null}),
                    widget: proxy({
                        docked: {id: 'replay-timeline-widget#1', size: 320},
                        list: proxyMap([['replay-timeline-widget#1', {group: 'journey-widgets'}]]),
                    }),
                }),
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('leaves the drawer header empty so actions stay inside the timeline', () => {
        render(<DockedWidgetDrawer/>)

        expect(screen.queryByText('Replay Timeline')).toBeNull()
        expect(document.querySelector('[slot="header-actions"]')).toBeNull()
        expect(screen.queryByRole('button', {name: 'Reattach to widget'})).toBeNull()
        expect(screen.queryByRole('button', {name: 'Open in Picture-in-Picture'})).toBeNull()
        expect(screen.queryByRole('button', {name: 'Close timeline'})).toBeNull()
    })
})
