/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: journey-toolbar-orbit-toggle.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-14
 * Last modified: 2026-06-14
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { JourneyToolbar } from '@Editor/JourneyToolbar'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

vi.mock('@Components/ToggleStateIcon', () => ({
    ToggleStateIcon: () => <button type="button" data-testid="toggle-state-icon"/>,
}))

vi.mock('@Editor/journey/JourneySelector', () => ({
    JourneySelector: () => <div data-testid="journey-selector"/>,
}))

vi.mock('@Editor/Utils', () => ({
    Utils: {
        updateJourney: vi.fn(async () => undefined),
        renderJourneySettings: vi.fn(),
    },
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, ...props}) => <button type="button" {...props}>{children}</button>,
    WaCard: ({children, ...props}) => <div {...props}>{children}</div>,
    WaIcon: ({name, animation}) => <span data-animation={animation} data-icon={name}/>,
    WaTooltip: () => null,
}))

describe('JourneyToolbar orbit toggle', () => {
    beforeEach(() => {
        globalThis.__ = {
            ui: {
                cameraManager: {
                    stopRotate: vi.fn(async () => undefined),
                },
                replay: {
                    isJourneyToolbarTemporarilyHidden: vi.fn(() => false),
                },
            },
        }

        globalThis.lgs = {
            theJourney: {
                focus: vi.fn(),
                updateVisibility: vi.fn(),
            },
            theJourneyEditorProxy: proxy({
                journey: {
                    visible: true,
                },
            }),
            settings: {
                ui: {
                    journeyToolbar: proxy({
                        show:  true,
                        usage: true,
                        x:     0,
                        y:     0,
                    }),
                    camera: proxy({
                        start: proxy({
                            rotate: proxy({
                                journey: false,
                            }),
                        }),
                    }),
                },
            },
            stores: {
                replay: proxy({
                    active:  false,
                    playing: false,
                    paused:  false,
                    orbitAllowed: true,
                }),
                main: {
                    components: proxy({
                        journeyEditor: proxy({
                            list: [1],
                        }),
                    }),
                },
                ui: proxy({
                    mainUI: proxy({
                        rotate: proxy({
                            running: true,
                            target: {
                                element: 'map-point',
                            },
                        }),
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

    it('stops the running orbit and focuses the journey', async () => {
        const {container} = render(<JourneyToolbar/>)

        expect(container.querySelector('[data-icon="arrows-rotate"][data-animation="spin"]')).toBeTruthy()
        expect(container.querySelector('#focus-journey-toolbar [data-icon="crosshairs-simple"]')).toBeTruthy()
        fireEvent.click(container.querySelector('#focus-journey-toolbar'))

        await waitFor(() => expect(globalThis.__.ui.cameraManager.stopRotate).toHaveBeenCalled())
        await waitFor(() => expect(globalThis.lgs.theJourney.focus).toHaveBeenCalledWith({
            resetCamera: true,
            rotate:      false,
        }))
    })

    it('stops the running orbit from the focus button without relaunching it', async () => {
        const {container} = render(<JourneyToolbar/>)

        fireEvent.click(container.querySelector('#rotate-journey-toolbar'))

        await waitFor(() => expect(globalThis.__.ui.cameraManager.stopRotate).toHaveBeenCalled())
        expect(globalThis.lgs.theJourney.focus).not.toHaveBeenCalled()
    })

    it('keeps both rotation and focus controls visible with automatic rotation enabled', () => {
        globalThis.lgs.settings.ui.camera.start.rotate.journey = true
        globalThis.lgs.stores.ui.mainUI.rotate.running = false
        const {container} = render(<JourneyToolbar/>)

        expect(container.querySelector('#rotate-journey-toolbar')).toBeTruthy()
        expect(container.querySelector('#rotate-journey-toolbar [data-icon="arrows-rotate"][data-animation="none"]')).toBeTruthy()
        expect(container.querySelector('#focus-journey-toolbar')).toBeTruthy()
    })

    it('focuses without starting an orbit when the focus control is clicked while idle', async () => {
        globalThis.lgs.stores.ui.mainUI.rotate.running = false
        const {container} = render(<JourneyToolbar/>)

        fireEvent.click(container.querySelector('#focus-journey-toolbar'))

        await waitFor(() => expect(globalThis.lgs.theJourney.focus).toHaveBeenCalledWith({
            resetCamera: true,
            rotate:      false,
        }))
    })
})
