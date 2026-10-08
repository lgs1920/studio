/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: camera-adjustment-overlay.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-27
 * Last modified: 2026-10-08
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { act, render, waitFor } from '@testing-library/react'
import { CameraAdjustmentOverlay } from '@Components/MainUI/CameraAdjustmentOverlay'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

const widgetMock = vi.hoisted(() => ({childRef: null}))
const CAMERA_ADJUSTMENT_HIDE_DELAY = 2000

vi.mock('@Components/MainUI/widgets/Widget', () => ({
    Widget: ({children, className, childRef, isVisible = true}) => {
        widgetMock.childRef = childRef
        return isVisible ? <div className={className}>{children}</div> : null
    },
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaIcon: ({name, ...props}) => <span data-icon={name} {...props}/>,
}))

afterEach(() => {
    vi.useRealTimers()
    widgetMock.childRef = null
    globalThis.lgs = undefined
})

describe('CameraAdjustmentOverlay', () => {
    it('shares the camera metrics and renders the replay camera angle', () => {
        globalThis.lgs = {
            stores: {
                replay: proxy({
                    userMode: 'expert',
                    camera: {
                        cameraAngle: -30,
                    },
                }),
                ui: {
                    video: proxy({editing: true}),
                },
            },
        }

        const view = render(
            <CameraAdjustmentOverlay
                config={{id: 'camera-adjustment-widget'}}
                isVisible
                values={{height: '1 200 m', level: 'L12', pitch: '-45°'}}
                visible
            />,
        )

        expect(view.container.querySelectorAll('.camera-adjustment-overlay')).toHaveLength(1)
        expect(view.getByText('1 200 m')).toBeTruthy()
        expect(view.getByText('-45°')).toBeTruthy()
        expect(view.getByText('L12')).toBeTruthy()
        const angleMetric = view.getByLabelText('Replay camera angle')
        expect(angleMetric.textContent).toContain('30°')
        expect([...angleMetric.children].map(element => element.tagName)).toEqual(['SPAN', 'STRONG'])
        expect(angleMetric.querySelector('[data-icon="video"]')).not.toBeNull()
        expect(view.container.querySelector('.camera-adjustment-angle-direction')).toBeNull()
    })

    it('hides the replay camera angle outside video preparation', () => {
        globalThis.lgs = {
            stores: {
                replay: proxy({
                    camera: {cameraAngle: -30},
                }),
                ui: {
                    video: proxy({editing: false}),
                },
            },
        }

        const view = render(
            <CameraAdjustmentOverlay
                config={{id: 'camera-adjustment-widget'}}
                isVisible
                values={{height: '1 200 m', level: 'L12', pitch: '-45°'}}
                visible
            />,
        )

        expect(view.queryByLabelText('Replay camera angle')).toBeNull()
    })

    it('shows the replay camera angle in Basic Replay preparation', () => {
        globalThis.lgs = {
            stores: {
                replay: proxy({
                    userMode: 'basic',
                    camera: {cameraAngle: -30},
                }),
                ui: {
                    video: proxy({editing: true}),
                },
            },
        }

        const view = render(
            <CameraAdjustmentOverlay
                config={{id: 'camera-adjustment-widget'}}
                isVisible
                values={{height: '1 200 m', level: 'L12', pitch: '-45°'}}
                visible
            />,
        )

        expect(view.getByLabelText('Replay camera angle').textContent).toContain('-30°')
    })

    it('hides the Replay camera angle metric during linked Replay dry run', () => {
        globalThis.lgs = {
            stores: {
                replay: proxy({
                    active: true,
                    recordingSync: true,
                    userMode: 'expert',
                    camera: {cameraAngle: -30},
                }),
                ui: {
                    video: proxy({
                        editing: true,
                        preRecording: false,
                        exporting: false,
                        snapshot: false,
                        finalizing: false,
                    }),
                },
            },
        }

        const view = render(
            <CameraAdjustmentOverlay
                config={{id: 'camera-adjustment-widget'}}
                isVisible
                values={{height: '1 200 m', level: 'L12', pitch: '-45°'}}
                visible
            />,
        )

        expect(view.getByText('1 200 m')).toBeTruthy()
        expect(view.queryByLabelText('Replay camera angle')).toBeNull()
    })

    it('does not display a separate Ahead or Behind direction', () => {
        globalThis.lgs = {
            stores: {
                replay: proxy({
                    userMode: 'expert',
                    camera: {
                        cameraAngle: 30,
                    },
                }),
                ui: {
                    video: proxy({editing: true}),
                },
            },
        }

        const view = render(
            <CameraAdjustmentOverlay
                config={{id: 'camera-adjustment-widget'}}
                isVisible
                values={{height: '1 200 m', level: 'L12', pitch: '-45°'}}
                visible
            />,
        )

        expect(view.getByLabelText('Replay camera angle').textContent).toContain('30°')
        expect(view.container.querySelector('.camera-adjustment-angle-direction')).toBeNull()
    })

    it('shows the widget after any camera change', async () => {
        const cameraChangedListeners = []
        globalThis.lgs = {
            camera: {
                heading: 0,
                pitch: -0.5,
                roll: 0,
                positionCartographic: {height: 1000, latitude: 2, longitude: 1},
                changed: {
                    addEventListener: listener => {
                        cameraChangedListeners.push(listener)
                        return () => {}
                    },
                },
            },
            scene: {},
            settings: {unitSystem: proxy({current: 'metric'})},
            stores: {
                replay: proxy({camera: {cameraAngle: 180}}),
                ui: {video: proxy({preRecording: false})},
            },
        }

        const view = render(
            <CameraAdjustmentOverlay
                config={{id: 'camera-adjustment-widget'}}
                isVisible
                values={{height: '1 000 m', level: 'L12', pitch: '-29°'}}
            />,
        )

        globalThis.lgs.camera.positionCartographic.height = 1200
        cameraChangedListeners[0]()

        await waitFor(() => {
            expect(view.container.querySelector('.camera-adjustment-widget-shell.adjustment-visible')).not.toBeNull()
            expect(view.getByText('1200')).toBeTruthy()
        })
    })

    it('keeps the overlay visible while dragging and restarts its timer after release', async () => {
        vi.useFakeTimers()
        const cameraChangedListeners = []
        globalThis.lgs = {
            camera: {
                heading: 0,
                pitch: -0.5,
                roll: 0,
                positionCartographic: {height: 1000, latitude: 2, longitude: 1},
                changed: {
                    addEventListener: listener => {
                        cameraChangedListeners.push(listener)
                        return () => {}
                    },
                },
            },
            scene: {},
            settings: {unitSystem: proxy({current: 'metric'})},
            stores: {
                replay: proxy({camera: {cameraAngle: 180}}),
                ui: {video: proxy({preRecording: false})},
            },
        }

        const view = render(
            <CameraAdjustmentOverlay
                config={{id: 'camera-adjustment-widget'}}
                isVisible
                values={{height: '1 000 m', level: 'L12', pitch: '-29°'}}
            />,
        )

        globalThis.lgs.camera.positionCartographic.height = 1200
        await act(async () => cameraChangedListeners[0]())
        expect(view.container.querySelector('.camera-adjustment-widget-shell.adjustment-visible')).not.toBeNull()

        await act(async () => widgetMock.childRef.current.onDragStart())
        await act(async () => vi.advanceTimersByTime(CAMERA_ADJUSTMENT_HIDE_DELAY))
        expect(view.container.querySelector('.camera-adjustment-widget-shell.adjustment-visible')).not.toBeNull()

        await act(async () => widgetMock.childRef.current.onDragEnd())
        await act(async () => vi.advanceTimersByTime(CAMERA_ADJUSTMENT_HIDE_DELAY - 1))
        expect(view.container.querySelector('.camera-adjustment-widget-shell.adjustment-visible')).not.toBeNull()

        await act(async () => vi.advanceTimersByTime(1))
        expect(view.container.querySelector('.camera-adjustment-widget-shell.adjustment-visible')).toBeNull()
    })
})
