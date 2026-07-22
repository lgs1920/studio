/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: journey-toolbar-orbit-toggle.test.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
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
    WaIcon: ({name}) => <span data-icon={name}/>,
    WaSpinner: () => <span data-testid="spinner"/>,
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

    it('stops the running orbit without relaunching it', async () => {
        const {container} = render(<JourneyToolbar/>)

        expect(container.querySelector('[data-testid="spinner"]')).toBeTruthy()
        fireEvent.click(container.querySelector('#focus-journey-toolbar'))

        await waitFor(() => expect(globalThis.__.ui.cameraManager.stopRotate).toHaveBeenCalled())
        expect(globalThis.lgs.theJourney.focus).not.toHaveBeenCalled()
    })

    it('stops the running orbit from the focus button without relaunching it', async () => {
        const {container} = render(<JourneyToolbar/>)

        fireEvent.click(container.querySelector('#rotate-journey-toolbar'))

        await waitFor(() => expect(globalThis.__.ui.cameraManager.stopRotate).toHaveBeenCalled())
        expect(globalThis.lgs.theJourney.focus).not.toHaveBeenCalled()
    })
})
