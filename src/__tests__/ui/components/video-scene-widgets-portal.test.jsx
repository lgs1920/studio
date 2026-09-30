// @vitest-environment jsdom
/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: video-scene-widgets-portal.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-27
 * Last modified: 2026-09-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {act, cleanup, render, waitFor} from '@testing-library/react'
import {proxy} from 'valtio'
import {proxyMap} from 'valtio/utils'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const portalHarness = vi.hoisted(() => ({
    renderWidget: vi.fn(),
}))

vi.mock('@Components/MainUI/widgets/DynamicWidget', () => ({
    DynamicWidget: ({id}) => <div data-testid="dynamic-widget" data-widget-id={id}/>,
}))

vi.mock('@Components/MainUI/widgets/Widget', () => ({
    WidgetPreviewContext: {
        Provider: ({children}) => children,
    },
}))

vi.mock('@Core/ui/widget-manager/dynamic-render/WidgetDynamicRender', () => ({
    WidgetDynamicRenderer: {
        instance: portalHarness,
    },
}))

import {VideoSceneWidgetsPortal} from '@Components/MainUI/video/VideoSceneWidgetsPortal'

describe('VideoSceneWidgetsPortal', () => {
    let board

    beforeEach(() => {
        board = document.createElement('div')
        board.id = 'video-crop-zone'
        board.className = 'defined'
        board.getBoundingClientRect = () => ({
            bottom: 360,
            height: 360,
            left:   0,
            right:  640,
            top:    0,
            width:  640,
            x:      0,
            y:      0,
        })
        document.body.append(board)

        globalThis.__ = {
            ui: {
                widgetManager: {
                    invalidateRuntimeByBoard:         vi.fn(),
                    rehydrateWidgetsByBoard:          vi.fn(),
                    resolveWidgetsBoardBoundsContainer: vi.fn(() => board),
                },
            },
        }
        globalThis.lgs = {
            stores: {
                replay: proxy({recordingSync: false}),
                ui: {
                    video: proxy({
                        editing:      true,
                        finalizing:   false,
                        preRecording: false,
                        recording:    false,
                        snapshot:     false,
                        cropper:      proxy({resizing: false}),
                    }),
                    widget: {
                        list: proxyMap([
                            ['credits-widget#video', {widgetsBoard: 'video-crop-zone', zIndex: 10000}],
                            ['text-widget#title', {widgetsBoard: 'video-crop-zone', zIndex: 4000}],
                            ['replay-timeline-widget', {widgetsBoard: 'video-crop-zone', zIndex: 3000}],
                            ['video-crop-zone', {widgetsBoard: 'video-crop-zone', zIndex: 1}],
                        ]),
                    },
                },
            },
        }
        portalHarness.renderWidget.mockReset()
        portalHarness.renderWidget.mockResolvedValue(null)
    })

    afterEach(() => {
        cleanup()
        board?.remove()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('keeps every content widget while filtering capture infrastructure', async () => {
        render(<VideoSceneWidgetsPortal context={proxy({})}/>)

        await waitFor(() => {
            expect(Array.from(document.querySelectorAll('[data-testid="dynamic-widget"]'))
                .map(element => element.dataset.widgetId)
                .sort((left, right) => left.localeCompare(right)))
                .toEqual(['credits-widget#video', 'text-widget#title'])
        })

        expect(portalHarness.renderWidget).not.toHaveBeenCalledWith(
            'multi-purpose-widgets',
            'compass-widget',
            expect.anything(),
        )
        expect(portalHarness.renderWidget).toHaveBeenCalledWith(
            'multi-purpose-widgets',
            'logo-widget',
            {
                forceRefresh: true,
                widgetsBoard: 'video-crop-zone',
            },
        )
    })

    it('keeps only Compass, Credits, and Logo during Simple Replay', async () => {
        globalThis.lgs.stores.replay.simplePreparationActive = true

        render(<VideoSceneWidgetsPortal context={proxy({})}/>)

        await waitFor(() => {
            expect(Array.from(document.querySelectorAll('[data-testid="dynamic-widget"]'))
                .map(element => element.dataset.widgetId)
                .sort((left, right) => left.localeCompare(right)))
                .toEqual(['credits-widget#video'])
        })

        expect(portalHarness.renderWidget).toHaveBeenCalledWith(
            'multi-purpose-widgets',
            'compass-widget',
            {
                forceRefresh: true,
                widgetsBoard: 'video-crop-zone',
            },
        )
    })

    it('hides crop-board widgets while the crop zone is resizing', async () => {
        const cropperContext = lgs.stores.ui.video.cropper
        cropperContext.resizing = true

        render(<VideoSceneWidgetsPortal context={cropperContext}/>)

        await waitFor(() => {
            expect(document.querySelector('.video-scene-widgets-portal-resizing')).not.toBeNull()
        })

        act(() => {
            cropperContext.resizing = false
        })

        await waitFor(() => {
            expect(document.querySelector('.video-scene-widgets-portal-resizing')).toBeNull()
        })
    })

    it('renders Compass in Expert Replay when it is already on the video board', async () => {
        globalThis.lgs.stores.ui.widget.list.set('compass-widget#video', {
            widgetsBoard: 'video-crop-zone',
            zIndex: 5000,
        })

        render(<VideoSceneWidgetsPortal context={proxy({})}/>)

        await waitFor(() => {
            expect(Array.from(document.querySelectorAll('[data-testid="dynamic-widget"]'))
                .map(element => element.dataset.widgetId))
                .toContain('compass-widget#video')
        })
        expect(portalHarness.renderWidget).not.toHaveBeenCalledWith(
            'multi-purpose-widgets',
            'compass-widget',
            expect.anything(),
        )
    })

    it('rehydrates the video board during deterministic HQ recording', async () => {
        globalThis.lgs.stores.ui.video.editing = false
        globalThis.lgs.stores.ui.video.recordingHQ = true
        globalThis.lgs.stores.replay.recordingSync = true

        render(<VideoSceneWidgetsPortal context={proxy({})}/>)

        await waitFor(() => {
            expect(globalThis.__.ui.widgetManager.rehydrateWidgetsByBoard)
                .toHaveBeenCalledWith('video-crop-zone')
        })
        expect(document.querySelector('.video-scene-widgets-portal-capture')).not.toBeNull()
        expect(document.querySelector('.video-scene-widgets-portal-input-blocked')).not.toBeNull()
    })

    it.each(['active', 'playing', 'paused'])('keeps video widget input available while Replay is %s', async replayState => {
        globalThis.lgs.stores.replay[replayState] = true

        render(<VideoSceneWidgetsPortal context={proxy({})}/>)

        await waitFor(() => {
            expect(document.querySelector('.video-scene-widgets-portal [data-testid="dynamic-widget"]')).not.toBeNull()
        })
        expect(document.querySelector('.video-scene-widgets-portal [data-testid="dynamic-widget"]')
            ?.parentElement?.style.pointerEvents)
            .toBe('auto')
        expect(document.querySelector('.video-scene-widgets-portal-input-blocked')).toBeNull()
    })

    it('registers required Replay widgets on a fresh Expert crop board without forcing Compass', async () => {
        globalThis.lgs.stores.ui.widget.list.clear()

        render(<VideoSceneWidgetsPortal context={proxy({})}/>)

        await waitFor(() => {
            expect(portalHarness.renderWidget).toHaveBeenCalledWith(
                'multi-purpose-widgets',
                'credits-widget',
                {
                    forceRefresh: true,
                    widgetsBoard: 'video-crop-zone',
                },
            )
        })
        expect(portalHarness.renderWidget).not.toHaveBeenCalledWith(
            'multi-purpose-widgets',
            'compass-widget',
            expect.anything(),
        )
    })

})
