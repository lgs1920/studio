/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-timeline-widget.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-29
 * Last modified: 2026-09-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'
import {proxyMap} from 'valtio/utils'

const widgetMocks = vi.hoisted(() => ({
    config: null,
    childRef: null,
    previewProps: null,
    runtimeConfig: {
        dimensions:       {width: 2160, height: 900},
        min:              {width: 352, height: 156},
        max:              {width: 3840, height: 2160},
        resizeToContent:  undefined,
    },
}))

vi.mock('@Components/MainUI/widgets/Widget', () => ({
    Widget: ({children, childRef, config}) => {
        widgetMocks.config = config
        widgetMocks.childRef = childRef
        return <div data-testid="replay-timeline-widget-host">{children}</div>
    },
}))

vi.mock('@Components/MainUI/video/ReplayTimelinePreview', () => ({
    ReplayTimelinePreview: props => {
        widgetMocks.previewProps = props
        return (
            <div className="replay-timeline-preview" data-testid="replay-timeline-preview">
                {props.headerActions}
            </div>
        )
    },
}))

vi.mock('@Components/MainUI/widgets/WidgetWindowActionButton', () => ({
    WidgetWindowActionButton: ({icon, library, label, onClick, size = 'm'}) => (
        <button type="button" data-icon={icon} data-library={library} data-size={size} aria-label={label} onClick={onClick}>{label}</button>
    ),
}))

import {ReplayTimelineWidget} from '@Components/MainUI/widgets/list/ReplayTimelineWidget'
import {ReplayTimelineContent} from '@Components/MainUI/widgets/list/ReplayTimelineContent'

describe('ReplayTimelineWidget dimensions', () => {
    beforeEach(() => {
        widgetMocks.config = null
        widgetMocks.childRef = null
        widgetMocks.previewProps = null
        widgetMocks.runtimeConfig = {
            dimensions:      {width: 2160, height: 900},
            min:             {width: 352, height: 156},
            max:             {width: 3840, height: 2160},
            resizeToContent: undefined,
        }
        globalThis.__ = {
            ui: {
                widgetManager: {
                    getElementById: vi.fn(() => screen.queryByTestId('replay-timeline-widget-host')),
                    getMoveable:    vi.fn(() => ({current: {updateRect: vi.fn()}})),
                    getWidgetConfig: vi.fn(() => widgetMocks.runtimeConfig),
                    saveWidgetPosition: vi.fn(),
                    setConfig:      vi.fn(),
                    invalidateRuntimeById: vi.fn(),
                },
                widgetWindowManager: {
                    canDetachWidget: vi.fn(() => true),
                    detachWidget:    vi.fn(async () => true),
                },
                widgetCache: {
                    unmount: vi.fn(),
                },
            },
        }
        globalThis.lgs = {
            canvas: document.createElement('div'),
            stores: {
                ui: {
                    widget: proxy({
                        current: null,
                        docked: {id: null},
                        undocked: {id: null},
                        list: proxyMap([['replay-timeline-widget', {dimensions: {width: 2160, height: 900}}]]),
                    }),
                },
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('restores persisted dimensions while respecting the static widget minimum', async () => {
        const {unmount} = render(<ReplayTimelineWidget id="replay-timeline-widget"/>)
        const content = screen.getByTestId('replay-timeline-preview')
        vi.spyOn(content, 'getBoundingClientRect').mockReturnValue({
            bottom:  114,
            height: 114,
            left:   0,
            right:  720,
            top:    0,
            width:  720,
            x:      0,
            y:      0,
        })

        expect(widgetMocks.config.width).toBeUndefined()
        expect(widgetMocks.config.height).toBeUndefined()
        expect(widgetMocks.config.persist).toBe(true)
        expect(widgetMocks.config.canLock).toBe(false)
        expect(widgetMocks.config.constrainResizeToContent).toBe(true)
        expect(widgetMocks.config.min).toEqual({width: 352, height: 156})
        expect(widgetMocks.config.max).toEqual({width: 3840, height: 2160})
        expect(widgetMocks.config.handle).toBe('lgs1920-timeline')
        expect(widgetMocks.config.resizeToContent).toBeUndefined()
        expect(widgetMocks.childRef).toBeDefined()
        await waitFor(() => expect(widgetMocks.runtimeConfig.dimensions).toEqual({width: 2160, height: 900}))
        expect(__.ui.widgetManager.saveWidgetPosition).not.toHaveBeenCalled()

        unmount()

        expect(lgs.stores.ui.widget.list.has('replay-timeline-widget')).toBe(true)
        expect(__.ui.widgetManager.invalidateRuntimeById).toHaveBeenCalledWith('replay-timeline-widget')
    })

    it('keeps persisted dimensions independent from the track count', async () => {
        widgetMocks.runtimeConfig.dimensions = {width: 320, height: 80}
        const {unmount} = render(<ReplayTimelineWidget id="replay-timeline-widget"/>)
        const content = screen.getByTestId('replay-timeline-preview')
        vi.spyOn(content, 'getBoundingClientRect').mockReturnValue({
            bottom:  80,
            height: 80,
            left:   0,
            right:  320,
            top:    0,
            width:  320,
            x:      0,
            y:      0,
        })

        await waitFor(() => expect(widgetMocks.runtimeConfig.dimensions).toEqual({width: 320, height: 80}))
        expect(__.ui.widgetManager.saveWidgetPosition).not.toHaveBeenCalled()

        unmount()
    })

    it('renders the timeline content without the movable widget host', () => {
        render(<ReplayTimelineContent id="replay-timeline-widget"/>)

        expect(screen.queryByTestId('replay-timeline-widget-host')).toBeNull()
        expect(screen.getByTestId('replay-timeline-preview')).toBeDefined()
    })

    it('renders only the timeline content when detached', () => {
        render(<ReplayTimelineWidget id="replay-timeline-widget" detached/>)

        expect(screen.queryByTestId('replay-timeline-widget-host')).toBeNull()
        expect(document.querySelector('.lgs-detached-widget-host')).toBeDefined()
        expect(screen.getByTestId('replay-timeline-preview')).toBeDefined()
        expect(widgetMocks.previewProps.detached).toBe(true)
        const reattachButton = screen.getByRole('button', {name: 'Reattach to widget'})
        expect(reattachButton.getAttribute('data-icon')).toBe('picture-in-picture-out')
        expect(reattachButton.getAttribute('data-library')).toBe('lgs1920')
        expect(reattachButton.getAttribute('data-size')).toBe('m')
        expect(screen.getByRole('button', {name: 'Open in drawer'}).getAttribute('data-icon')).toBe('arrow-down-to-bracket')
        expect(screen.getByRole('button', {name: 'Open in drawer'}).getAttribute('data-size')).toBe('m')
        expect(screen.queryByRole('button', {name: 'Show widget frame'})).toBeNull()
        expect(screen.queryByRole('button', {name: 'Close timeline'})).toBeNull()
    })

    it('activates timeline keyboard zoom while the widget is selected', async () => {
        lgs.stores.ui.widget.current = {id: 'replay-timeline-widget'}
        render(<ReplayTimelineWidget id="replay-timeline-widget"/>)

        await waitFor(() => expect(widgetMocks.previewProps.keyboardZoomActive).toBe(true))
    })

    it('injects host window and drawer actions from the first timeline render', () => {
        widgetMocks.runtimeConfig.contextMenu = {canDockable: true, canDetach: true}
        render(<ReplayTimelineWidget id="replay-timeline-widget"/>)

        expect(screen.getByRole('button', {name: 'Open in Picture-in-Picture'})).toBeTruthy()
        expect(screen.getByRole('button', {name: 'Open in drawer'})).toBeTruthy()
        expect(screen.queryByRole('button', {name: 'Show widget frame'})).toBeNull()
        expect(screen.queryByRole('button', {name: 'Close timeline'})).toBeNull()

        fireEvent.click(screen.getByRole('button', {name: 'Open in Picture-in-Picture'}))
        expect(__.ui.widgetWindowManager.detachWidget).toHaveBeenCalledWith('replay-timeline-widget')
        fireEvent.click(screen.getByRole('button', {name: 'Open in drawer'}))
    })

    it('keeps the docked timeline actions inside the timeline header', () => {
        render(<ReplayTimelineWidget id="replay-timeline-widget" docked/>)

        expect(screen.getByRole('button', {name: 'Reattach to widget'}).getAttribute('data-icon')).toBe('arrow-up-from-bracket')
        expect(screen.getByRole('button', {name: 'Open in Picture-in-Picture'}).getAttribute('data-icon')).toBe('picture-in-picture')
    })
})
