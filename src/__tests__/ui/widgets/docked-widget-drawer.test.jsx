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
 * Last modified: 2026-09-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'
import {proxyMap} from 'valtio/utils'

const dockManager = vi.hoisted(() => ({
    getDockedWidgetDimensions: vi.fn(() => ({width: 510, height: 270})),
    hydrateDockedWidget: vi.fn(),
    setDockSize: vi.fn(),
    undockWidget: vi.fn(() => true),
}))

const cleanupMocks = vi.hoisted(() => ({
    cancelVideoEditing: vi.fn(),
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

vi.mock('@Components/MainUI/widgets/WidgetWindowActionButton', () => ({
    WidgetWindowActionButton: ({label, onClick}) => <button type="button" onClick={onClick}>{label}</button>,
}))

vi.mock('@Core/ui/widget-manager/WidgetDockManager', () => dockManager)
vi.mock('@Components/MainUI/video/videoEditingCleanup', () => cleanupMocks)

import {DockedWidgetDrawer} from '@Components/MainUI/widgets/DockedWidgetDrawer'

describe('DockedWidgetDrawer host actions', () => {
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

    it('offers reattach and Picture-in-Picture actions from the drawer', () => {
        render(<DockedWidgetDrawer/>)

        fireEvent.click(screen.getByRole('button', {name: 'Reattach to widget'}))
        expect(dockManager.undockWidget).toHaveBeenCalledWith('replay-timeline-widget#1')

        fireEvent.click(screen.getByRole('button', {name: 'Open in Picture-in-Picture'}))
        expect(dockManager.getDockedWidgetDimensions).toHaveBeenCalledWith('replay-timeline-widget#1')
        expect(globalThis.__.ui.widgetWindowManager.detachWidget).toHaveBeenCalledWith(
            'replay-timeline-widget#1',
            {dimensions: {width: 510, height: 270}, useConfigDimensions: true},
        )

        fireEvent.click(screen.getByRole('button', {name: 'Close timeline'}))
        expect(cleanupMocks.cancelVideoEditing).toHaveBeenCalledOnce()
    })
})
