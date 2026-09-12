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
 * Last modified: 2026-09-12
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {act, cleanup, render, screen, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {forwardRef} from 'react'
import {proxy} from 'valtio'
import {proxyMap} from 'valtio/utils'

const dockManager = vi.hoisted(() => ({
    setDockSize: vi.fn(),
    undockWidget: vi.fn(() => true),
}))

const drawerMocks = vi.hoisted(() => ({setAfterHide: vi.fn()}))
const timelineMocks = vi.hoisted(() => ({render: vi.fn()}))

vi.mock('@Components/WaDrawerNonModal', () => ({
    default: forwardRef(({children, onWaAfterHide, withoutHeader, open, ...props}, ref) => {
        drawerMocks.setAfterHide(onWaAfterHide)
        return <div ref={ref} data-testid="widget-dock-drawer"
                    data-open={open} data-without-header={withoutHeader} {...props}>{children}</div>
    }),
}))

vi.mock('@Components/MainUI/widgets/list/ReplayTimelineWidget', () => ({
    ReplayTimelineWidget: props => {
        timelineMocks.render(props)
        return <div data-testid="docked-timeline"/>
    },
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
                    video: proxy({
                        editing:               false,
                        timelinePreviewActive: false,
                    }),
                    widget: proxy({
                        docked: {id: null, size: 320},
                        list: proxyMap([['replay-timeline-widget#1', {group: 'journey-widgets'}]]),
                    }),
                }),
                replay: proxy({recordingSync: false}),
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('does not mount the drawer before a timeline is docked', () => {
        render(<DockedWidgetDrawer/>)

        expect(screen.queryByText('Replay Timeline')).toBeNull()
        expect(document.querySelector('[slot="header-actions"]')).toBeNull()
        expect(screen.queryByTestId('widget-dock-drawer')).toBeNull()
        expect(screen.queryByTestId('docked-timeline')).toBeNull()
        expect(screen.queryByRole('button', {name: 'Reattach to widget'})).toBeNull()
        expect(screen.queryByRole('button', {name: 'Open in Picture-in-Picture'})).toBeNull()
        expect(screen.queryByRole('button', {name: 'Close timeline'})).toBeNull()
    })

    it('does not mount a persisted drawer outside video preparation', async () => {
        render(<DockedWidgetDrawer/>)

        await act(async () => {
            lgs.stores.ui.widget.docked = {id: 'replay-timeline-widget#1', size: 320}
        })

        expect(screen.queryByTestId('widget-dock-drawer')).toBeNull()
        expect(screen.queryByTestId('docked-timeline')).toBeNull()
    })

    it('reuses the drawer through repeated dock and undock transitions', async () => {
        render(<DockedWidgetDrawer/>)

        for (let cycle = 0; cycle < 2; cycle += 1) {
            await act(async () => {
                lgs.stores.ui.video.editing = true
                lgs.stores.ui.video.timelinePreviewActive = true
                lgs.stores.replay.recordingSync = true
                lgs.stores.ui.widget.docked = {id: 'replay-timeline-widget#1', size: 320}
            })
            const drawer = screen.getByTestId('widget-dock-drawer')
            await waitFor(() => expect(drawer.dataset.open).toBe('true'))
            expect(drawer.contains(screen.getByTestId('docked-timeline'))).toBe(true)
            expect(screen.getByTestId('docked-timeline').closest('.widget-dock-surface')).not.toBeNull()
            expect(timelineMocks.render).toHaveBeenLastCalledWith(expect.objectContaining({
                id:     'replay-timeline-widget#1',
                docked: true,
            }))

            await act(async () => {
                lgs.stores.ui.video.editing = false
                lgs.stores.ui.video.timelinePreviewActive = false
                lgs.stores.replay.recordingSync = false
                lgs.stores.ui.widget.docked = {id: null, size: 320}
            })
            expect(screen.queryByTestId('widget-dock-drawer')).toBeNull()
            expect(screen.queryByTestId('docked-timeline')).toBeNull()
        }
    })

    it('returns the widget to the scene only when the owning drawer finishes closing', async () => {
        render(<DockedWidgetDrawer/>)
        await act(async () => {
            lgs.stores.ui.video.editing = true
            lgs.stores.ui.video.timelinePreviewActive = true
            lgs.stores.replay.recordingSync = true
            lgs.stores.ui.widget.docked = {id: 'replay-timeline-widget#1', size: 320}
        })
        const drawer = screen.getByTestId('widget-dock-drawer')
        const afterHide = drawerMocks.setAfterHide.mock.lastCall[0]
        const nestedDrawer = document.createElement('wa-drawer')
        act(() => void afterHide({target: nestedDrawer, currentTarget: drawer}))
        expect(dockManager.undockWidget).not.toHaveBeenCalled()

        drawer.open = true
        act(() => void afterHide({target: drawer, currentTarget: drawer}))
        expect(dockManager.undockWidget).not.toHaveBeenCalled()

        drawer.open = false
        act(() => void afterHide({target: drawer, currentTarget: drawer}))
        expect(dockManager.undockWidget).toHaveBeenCalledWith('replay-timeline-widget#1')
    })
})
